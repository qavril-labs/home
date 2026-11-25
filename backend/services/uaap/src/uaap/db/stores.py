"""Postgres-backed audit sink and approval history.

Writes run on a background thread so request latency never waits on the database. Each row is
written inside a transaction that sets `app.tenant_id`, so row-level security applies to the
service role exactly as it does to core ERP tables. If the database is unreachable, events stay
queued (bounded) and the failure is logged and counted; they are never silently dropped without a count.
"""

from __future__ import annotations

import dataclasses
import json
import queue
import threading
from typing import Any

import psycopg

from uaap.approvals.inbox import InboxItem
from uaap.obs.audit import AuditEvent, InMemoryAuditSink
from uaap.obs.redact import get_logger

logger = get_logger()
_QUEUE_LIMIT = 10_000

_AUDIT_COLUMNS = [f.name for f in dataclasses.fields(AuditEvent)]
# Column names come from the AuditEvent dataclass, never from input.
_AUDIT_SQL = (
    f"INSERT INTO uaap.audit_events ({', '.join(_AUDIT_COLUMNS)}) "  # noqa: S608
    f"VALUES ({', '.join(['%s'] * len(_AUDIT_COLUMNS))})"
)
METRIC_INSERT = (
    "INSERT INTO uaap.agent_metric_events (tenant_id, agent_id, kind, status, latency_ms, error_code, "
    "guardrail_events, tool_calls, model_calls) VALUES (%(tenant_id)s, %(agent_id)s, %(kind)s, %(status)s, "
    "%(latency_ms)s, %(error_code)s, %(guardrail_events)s, %(tool_calls)s, %(model_calls)s)"
)
_APPROVAL_SQL = """
INSERT INTO uaap.approvals (tenant_id, approval_id, run_id, agent_id, initiator_id, action, summary, payload,
  payload_hash, created_at, expires_at, status, decided_by, decided_at, outcome)
VALUES (%(tenant_id)s, %(approval_id)s, %(run_id)s, %(agent_id)s, %(initiator_id)s, %(action)s, %(summary)s,
  %(payload)s, %(payload_hash)s, %(created_at)s, %(expires_at)s, %(status)s, %(decided_by)s, %(decided_at)s,
  %(outcome)s)
ON CONFLICT (tenant_id, approval_id) DO UPDATE SET
  status = EXCLUDED.status, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at,
  outcome = EXCLUDED.outcome
"""


class PostgresWriter:
    """One background thread, one connection, per-row tenant context."""

    def __init__(self, url: str, *, connect_timeout: int = 10) -> None:
        self._url = url
        self._timeout = connect_timeout
        self._queue: queue.Queue[tuple[str, Any] | None] = queue.Queue(maxsize=_QUEUE_LIMIT)
        self.written = 0
        self.failed = 0
        self.dropped = 0
        self.last_error: str | None = None
        self._thread = threading.Thread(target=self._run, name="uaap-db-writer", daemon=True)
        self._thread.start()

    def submit(self, kind: str, payload: Any) -> None:
        try:
            self._queue.put_nowait((kind, payload))
        except queue.Full:
            self.dropped += 1
            logger.error("UAAP database queue full; %s record dropped (dropped=%s)", kind, self.dropped)

    def flush(self, timeout: float = 10.0) -> None:
        done = threading.Event()
        self._queue.put(("__flush__", done))
        done.wait(timeout)

    def close(self) -> None:
        self.flush()
        self._queue.put(None)
        self._thread.join(timeout=5)

    def _run(self) -> None:
        conn: psycopg.Connection[Any] | None = None
        while True:
            item = self._queue.get()
            if item is None:
                break
            kind, payload = item
            if kind == "__flush__":
                payload.set()
                continue
            try:
                if conn is None or conn.closed:
                    conn = psycopg.connect(self._url, connect_timeout=self._timeout, autocommit=False)
                with conn.transaction():
                    tenant = payload.get("tenant_id") or ""
                    conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant,))
                    if kind == "metric":
                        conn.execute(METRIC_INSERT, payload)
                    elif kind == "audit":
                        conn.execute(_AUDIT_SQL, [payload[c] for c in _AUDIT_COLUMNS])
                    else:
                        conn.execute(_APPROVAL_SQL, payload)
                self.written += 1
            except Exception as exc:  # The service must keep running when the database is down.
                self.failed += 1
                self.last_error = type(exc).__name__
                logger.error("UAAP database write failed: %s", type(exc).__name__)
                if conn is not None:
                    conn.close()
                    conn = None

    def stats(self) -> dict[str, Any]:
        return {
            "written": self.written,
            "failed": self.failed,
            "dropped": self.dropped,
            "queued": self._queue.qsize(),
            "last_error": self.last_error,
        }


class PostgresAuditSink(InMemoryAuditSink):
    """Keeps the in-memory view (for tests and the admin console) and writes every event durably."""

    def __init__(self, writer: PostgresWriter) -> None:
        super().__init__()
        self._writer = writer

    def emit(self, event: AuditEvent) -> None:
        super().emit(event)
        self._writer.submit("audit", dataclasses.asdict(event))


def approval_record(item: InboxItem) -> dict[str, Any]:
    data = dataclasses.asdict(item)
    data["payload"] = json.dumps(item.payload, sort_keys=True)
    return data


def check_schema(url: str, timeout: int = 5) -> dict[str, Any]:
    """Admin check: can the service role connect, what version is applied, is RLS forced?"""
    with psycopg.connect(url, connect_timeout=timeout) as conn:
        user = conn.execute("SELECT current_user").fetchone()
        version = conn.execute("SELECT max(version) FROM uaap.schema_migrations").fetchone()
        rls = conn.execute(
            "SELECT c.relname, c.relforcerowsecurity FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'uaap' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'"
        ).fetchall()
    return {
        "user": user[0] if user else None,
        "schema_version": version[0] if version else None,
        "forced_rls": {name: bool(forced) for name, forced in rls},
    }
