"""Synchronous access to `uaap.state`, `uaap.approvals` and the metrics summary.

Every call opens a transaction that sets `app.tenant_id`, so row-level security decides what is
visible. One connection is shared behind a lock (reconnecting after failures); callers on the event
loop use `asyncio.to_thread`. This is sized for one service instance; a pool comes with A6 scale-out.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

APPROVAL_UPSERT = """
INSERT INTO uaap.approvals (tenant_id, approval_id, run_id, agent_id, initiator_id, action, summary, payload,
  payload_hash, created_at, expires_at, status, decided_by, decided_at, outcome)
VALUES (%(tenant_id)s, %(approval_id)s, %(run_id)s, %(agent_id)s, %(initiator_id)s, %(action)s, %(summary)s,
  %(payload)s, %(payload_hash)s, %(created_at)s, %(expires_at)s, %(status)s, %(decided_by)s, %(decided_at)s,
  %(outcome)s)
ON CONFLICT (tenant_id, approval_id) DO UPDATE SET
  status = EXCLUDED.status, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at,
  outcome = EXCLUDED.outcome
"""


class PgState:
    def __init__(self, url: str, *, connect_timeout: int = 10) -> None:
        self._url = url
        self._timeout = connect_timeout
        self._conn: psycopg.Connection[Any] | None = None
        self._lock = threading.Lock()

    @contextmanager
    def _tx(self, tenant_id: str) -> Iterator[psycopg.Connection[Any]]:
        with self._lock:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg.connect(self._url, connect_timeout=self._timeout, autocommit=False)
            conn = self._conn
            try:
                with conn.transaction():
                    conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))
                    yield conn
            except psycopg.OperationalError:
                conn.close()
                self._conn = None
                raise

    # ---- generic state -----------------------------------------------------------------------
    def put(self, tenant_id: str, kind: str, key: str, value: dict[str, Any]) -> None:
        with self._tx(tenant_id) as conn:
            conn.execute(
                "INSERT INTO uaap.state (tenant_id, kind, key, value) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (tenant_id, kind, key) DO UPDATE SET value = EXCLUDED.value, "
                "updated_at = clock_timestamp()",
                (tenant_id, kind, key, Jsonb(value)),
            )

    def get(self, tenant_id: str, kind: str, key: str) -> dict[str, Any] | None:
        with self._tx(tenant_id) as conn:
            row = conn.execute(
                "SELECT value FROM uaap.state WHERE tenant_id = %s AND kind = %s AND key = %s",
                (tenant_id, kind, key),
            ).fetchone()
        return dict(row[0]) if row else None

    def list_prefix(self, tenant_id: str, kind: str, prefix: str) -> list[tuple[str, dict[str, Any]]]:
        """Rows whose key starts with `prefix`, newest first."""
        with self._tx(tenant_id) as conn:
            rows = conn.execute(
                "SELECT key, value FROM uaap.state "
                "WHERE tenant_id = %s AND kind = %s AND starts_with(key, %s) "
                "ORDER BY updated_at DESC, key DESC",
                (tenant_id, kind, prefix),
            ).fetchall()
        return [(k, dict(v)) for k, v in rows]

    # ---- approvals inbox history -------------------------------------------------------------
    def approvals(self, tenant_id: str, approval_id: str | None = None) -> list[dict[str, Any]]:
        sql = "SELECT * FROM uaap.approvals WHERE tenant_id = %s"
        params: list[Any] = [tenant_id]
        if approval_id is not None:
            sql += " AND approval_id = %s"
            params.append(approval_id)
        sql += " ORDER BY created_at DESC LIMIT 500"
        with self._tx(tenant_id) as conn:
            cur = conn.execute(sql, params)  # Fixed text plus bound parameters.
            cols = [c.name for c in cur.description or []]
            rows = cur.fetchall()
        out = []
        for row in rows:
            rec = dict(zip(cols, row, strict=True))
            if isinstance(rec.get("payload"), str):
                rec["payload"] = json.loads(rec["payload"])
            out.append(rec)
        return out

    def save_approval(self, record: dict[str, Any]) -> None:
        with self._tx(record["tenant_id"]) as conn:
            conn.execute(APPROVAL_UPSERT, record)

    # ---- metrics -----------------------------------------------------------------------------
    def metrics_summary(self, since: datetime) -> dict[str, Any]:
        with self._tx("") as conn:
            cur = conn.execute("SELECT * FROM uaap.agent_metrics_summary(%s)", (since,))
            cols = [c.name for c in cur.description or []]
            rows = cur.fetchall()
        out: dict[str, Any] = {}
        for row in rows:
            r = dict(zip(cols, row, strict=True))
            requests = int(r["requests"])
            statuses = dict(r["statuses"])
            out[r["agent_id"]] = {
                "requests": requests,
                "tenants": int(r["tenants"]),
                "statuses": statuses,
                "errors": dict(r["errors"]),
                "guardrail_events": dict(r["guardrail_events"]),
                "approvals": dict(r["approvals"]),
                "tool_calls": int(r["tool_calls"] or 0),
                "model_calls": int(r["model_calls"] or 0),
                "answer_rate": round(statuses.get("answered", 0) / requests, 4) if requests else 0.0,
                "failure_rate": round(statuses.get("failed", 0) / requests, 4) if requests else 0.0,
                "latency_ms": {
                    "p50": r["p50_ms"] or 0,
                    "p95": r["p95_ms"] or 0,
                    "max": r["max_ms"] or 0,
                    "window": requests,
                },
                "source": "postgres",
            }
        return out
