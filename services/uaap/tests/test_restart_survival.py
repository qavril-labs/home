"""A pending approval, its run, idempotency keys and metrics survive a service restart (Neon).

"Restart" = brand-new engine, inbox, runner, checkpoint store and executor objects sharing nothing in
memory with the first set; only Postgres connects them. Runs only with UAAP_TEST_DATABASE_URL.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from uaap.agents.base import AgentCatalog, AgentInput
from uaap.agents.finance import AGENT_ID, UniversalFinanceAgent
from uaap.approvals.inbox import ApprovalInbox, InboxItem
from uaap.db.durable import (
    DurableCheckpointStore,
    DurableIdempotencyStore,
    PgApprovalRecords,
    PgInboxHistory,
)
from uaap.db.state import PgState
from uaap.db.stores import PostgresWriter
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.runner import AgentRunner
from uaap.tools.types import ToolCall

from .agents.test_finance_agent import ENTRY_MESSAGE, ENTRY_PLAN, ScriptedModel
from .tools.fakes import ACCOUNTANT_TOKEN, COMPANY, CONTROLLER_TOKEN, FakeCoreSaas, build_stack, caller

URL = os.environ.get("UAAP_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="UAAP_TEST_DATABASE_URL not set")
SECRET = b"t" * 40


class Process:
    """Everything one UAAP process would hold, wired to the shared database only."""

    def __init__(self, fake: FakeCoreSaas, model: Any, writer: PostgresWriter | None = None) -> None:
        assert URL
        pg = PgState(URL)
        executor, _ = build_stack(fake)
        executor.idempotency = DurableIdempotencyStore(pg)
        self.engine = ApprovalEngine(records=PgApprovalRecords(pg), token_secret=SECRET)
        self.inbox = ApprovalInbox(history=PgInboxHistory(pg), token_for=self.engine.token_for)
        runner = AgentRunner(
            DurableCheckpointStore(pg), self.engine, tool_executor=executor, approval_ttl_seconds=3600
        )
        catalog = AgentCatalog(executor.agents, executor.registry)
        metrics = AgentMetrics(
            on_record=(lambda t, row: writer.submit("metric", {**row, "tenant_id": t})) if writer else None
        )
        self.agent = UniversalFinanceAgent(model, runner, metrics=metrics)
        catalog.add(self.agent)
        self.executor = executor
        self.pg = pg


async def test_pending_approval_survives_restart_and_posts_once() -> None:
    fake = FakeCoreSaas()
    assert URL
    writer = PostgresWriter(URL)

    first = Process(fake, ScriptedModel(ENTRY_PLAN), writer)
    reply = await first.agent.respond(
        caller(ACCOUNTANT_TOKEN, agent_id=None), AgentInput(ENTRY_MESSAGE, "2026-11-09", COMPANY)
    )
    assert reply.status == "awaiting_approval" and reply.approval and reply.approval_token, (
        reply.error_code,
        reply.text,
    )
    a = reply.approval
    first.inbox.add(
        InboxItem(
            approval_id=a.approval_id,
            tenant_id=a.tenant_id,
            run_id=a.run_id,
            agent_id=AGENT_ID,
            initiator_id="user-accountant",
            action=a.action_name,
            summary=a.summary,
            payload=a.proposed_payload,
            payload_hash=a.payload_hash,
            created_at=a.created_at,
            expires_at=a.expires_at,
        ),
        reply.approval_token,
    )
    del first  # The "process" ends; nothing in memory carries over.

    second = Process(fake, ScriptedModel(), writer)
    pending = [i for i in second.inbox.list(a.tenant_id, "PENDING") if i.approval_id == a.approval_id]
    assert len(pending) == 1, "the inbox lost the pending approval across the restart"
    item, token = second.inbox.claim(a.tenant_id, a.approval_id)
    assert token == reply.approval_token  # Derived again from the secret; never stored.
    posted = await second.agent.approve(
        caller(CONTROLLER_TOKEN, agent_id=None),
        run_id=item.run_id,
        approval_id=item.approval_id,
        approval_token=token,
        confirmed_payload=item.payload,
    )
    assert posted.status == "answered", posted.text
    second.inbox.resolve(item, "APPROVED", "user-controller", "answered")
    assert len([r for r in fake.requests if r.url.path == "/v1/ledger/journal-entries"]) == 1

    # A third process sees the decision and cannot approve again.
    third = Process(fake, ScriptedModel(), writer)
    assert third.inbox.get(a.tenant_id, a.approval_id).status == "APPROVED"
    stored = await third.engine.get_approval(a.tenant_id, a.approval_id)
    assert stored is not None and stored.status.value == "APPROVED" and stored.single_use_token_hash == ""

    # No raw token anywhere in the stored approval record.
    raw = third.pg.get(a.tenant_id, "approval", a.approval_id)
    assert raw is not None and reply.approval_token not in json.dumps(raw)

    writer.flush()
    assert writer.stats()["failed"] == 0, writer.stats()
    summary = third.pg.metrics_summary(datetime.now(UTC) - timedelta(hours=1))
    assert summary[AGENT_ID]["requests"] >= 1
    assert summary[AGENT_ID]["approvals"].get("approved", 0) >= 1
    writer.close()


async def test_idempotent_replay_survives_restart() -> None:
    fake = FakeCoreSaas()
    key = f"idem-{datetime.now(UTC).timestamp()}"
    call = ToolCall("ledger_get_trial_balance", {"companyId": COMPANY, "asOf": "2026-11-30"}, key)

    first = Process(fake, ScriptedModel())
    await first.executor.execute(caller(), call)
    second = Process(fake, ScriptedModel())
    replay = await second.executor.execute(caller(), call)
    assert replay.replayed and len(fake.requests) == 1
