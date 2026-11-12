"""Postgres integration: runs only when UAAP_TEST_DATABASE_URL is set (the uaap_service role).

Uses unique tenant ids per run. Audit rows are append-only, so test rows remain by design.
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

import psycopg
import pytest

from uaap.approvals.inbox import InboxItem
from uaap.db.migrate import LATEST
from uaap.db.stores import PostgresWriter, approval_record, check_schema
from uaap.obs.audit import AuditEvent

URL = os.environ.get("UAAP_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="UAAP_TEST_DATABASE_URL not set")


def _count(conn: psycopg.Connection, tenant: str, table: str) -> int:
    with conn.transaction():
        conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant,))
        row = conn.execute(f"SELECT count(*) FROM uaap.{table}").fetchone()  # noqa: S608 - fixed table names
    return int(row[0]) if row else 0


def test_schema_is_current_and_rls_forced() -> None:
    assert URL
    info = check_schema(URL)
    assert info["schema_version"] == LATEST
    assert info["forced_rls"] == {
        "audit_events": True,
        "approvals": True,
        "state": True,
        "agent_metric_events": True,
    }
    assert info["user"] == "uaap_service"


def test_audit_and_approvals_are_durable_and_tenant_isolated() -> None:
    assert URL
    tenant_a, tenant_b = f"test-{uuid.uuid4()}", f"test-{uuid.uuid4()}"
    writer = PostgresWriter(URL)
    now = datetime.now(UTC)
    writer.submit(
        "audit",
        AuditEvent(
            at=now,
            request_id="r1",
            tenant_id=tenant_a,
            actor_id="u1",
            action="agent.reply",
            outcome="answered",
        ).__dict__,
    )
    item = InboxItem(
        approval_id="appr_test",
        tenant_id=tenant_a,
        run_id="run_1",
        agent_id="a",
        initiator_id="u1",
        action="ledger_post_journal_entry",
        summary="s",
        payload={"x": 1},
        payload_hash="h",
        created_at=now,
        expires_at=now + timedelta(hours=1),
    )
    writer.submit("approval", approval_record(item))
    writer.flush()
    assert writer.stats()["failed"] == 0, writer.stats()

    with psycopg.connect(URL) as conn:
        assert _count(conn, tenant_a, "audit_events") == 1
        assert _count(conn, tenant_a, "approvals") == 1
        assert _count(conn, tenant_b, "audit_events") == 0  # RLS: other tenants see nothing
        assert _count(conn, tenant_b, "approvals") == 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
            conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_a,))
            conn.execute("DELETE FROM uaap.audit_events")
    writer.close()


def test_writing_another_tenants_row_is_refused() -> None:
    assert URL
    with (
        psycopg.connect(URL) as conn,
        pytest.raises(psycopg.errors.InsufficientPrivilege),
        conn.transaction(),
    ):
        conn.execute("SELECT set_config('app.tenant_id', 'test-mine', true)")
        conn.execute(
            "INSERT INTO uaap.audit_events (at, request_id, tenant_id, action, outcome) "
            "VALUES (now(), 'r', 'test-someone-else', 'x', 'y')"
        )
