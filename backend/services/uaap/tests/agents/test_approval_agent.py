"""Approval Agent: read-only over the inbox; never decides; never shows another organisation's items."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

from uaap.agents.approval import ApprovalAgent
from uaap.agents.base import AgentInput
from uaap.approvals.inbox import ApprovalInbox, InboxItem
from uaap.errors import UaapError
from uaap.gateway.types import Message
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner

from ..tools.fakes import (
    ACCOUNTANT_TOKEN,
    COMPANY,
    OTHER_TENANT_TOKEN,
    TENANT,
    caller,
)
from .test_finance_agent import ScriptedModel

TODAY = "2026-11-09"


def _item(
    approval_id: str,
    *,
    tenant: str = TENANT,
    summary: str = "Proposed entry UFA-AAAA dated 2026-11-30 in USD:\n- debit 6100 1250.00",
    expires_in: timedelta = timedelta(days=3),
    status: str = "PENDING",
    initiator: str = "user-accountant",
) -> InboxItem:
    now = datetime.now(UTC)
    return InboxItem(
        approval_id=approval_id,
        tenant_id=tenant,
        run_id=f"run_{approval_id}",
        agent_id="universal-finance-agent",
        initiator_id=initiator,
        action="ledger_post_journal_entry",
        summary=summary,
        payload={"tool_name": "ledger_post_journal_entry", "arguments": {"companyId": COMPANY}},
        payload_hash="a" * 64,
        created_at=now,
        expires_at=now + expires_in,
        status=status,  # type: ignore[arg-type]
    )


def _agent(model: Any, inbox: ApprovalInbox) -> ApprovalAgent:
    runner = AgentRunner(InMemoryCheckpointStore(), ApprovalEngine())
    agent = ApprovalAgent(model, runner, inbox, metrics=AgentMetrics())
    return agent


def _req(message: str) -> AgentInput:
    return AgentInput(message=message, today=TODAY, company_id=COMPANY)


def _ctx(token: str = ACCOUNTANT_TOKEN) -> Any:
    return caller(token, agent_id=None)


async def test_empty_inbox_says_none() -> None:
    agent = _agent(ScriptedModel({"intent": "list_pending", "reply": ""}), ApprovalInbox())
    reply = await agent.respond(_ctx(), _req("What is waiting for me?"))
    assert reply.status == "answered"
    assert reply.text == "There are no approvals waiting for a decision."


async def test_only_pending_items_are_listed() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_pending1"), "t1")
    decided = replace(_item("appr_done1"), status="APPROVED", outcome="answered")
    inbox.add(decided, "t2")
    agent = _agent(ScriptedModel({"intent": "list_pending", "reply": ""}), inbox)
    reply = await agent.respond(_ctx(), _req("What is waiting for me?"))
    assert "appr_pending1" in reply.text
    assert "appr_done1" not in reply.text


async def test_expiring_lists_only_items_due_within_a_day() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_soon1", expires_in=timedelta(hours=2)), "t1")
    inbox.add(_item("appr_later1", expires_in=timedelta(days=3)), "t2")
    agent = _agent(ScriptedModel({"intent": "list_expiring", "reply": ""}), inbox)
    reply = await agent.respond(_ctx(), _req("Which approvals expire soon?"))
    assert "appr_soon1" in reply.text and "appr_later1" not in reply.text
    assert reply.data["approval_ids"] == ["appr_soon1"]


async def test_explain_needs_the_id_in_the_message() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_explain1"), "t1")
    # The model names an id the user never wrote: the agent must not look it up.
    agent = _agent(ScriptedModel({"intent": "explain", "reply": "", "approval_id": "appr_explain1"}), inbox)
    reply = await agent.respond(_ctx(), _req("Explain the proposal from yesterday."))
    assert reply.status == "needs_clarification"
    assert "UNGROUNDED_IDENTIFIER" in reply.guardrail_events


async def test_explain_unknown_id_is_not_found() -> None:
    agent = _agent(
        ScriptedModel({"intent": "explain", "reply": "", "approval_id": "appr_nope01"}), ApprovalInbox()
    )
    reply = await agent.respond(_ctx(), _req("Explain approval appr_nope01."))
    assert reply.status == "failed" and reply.error_code == "NOT_FOUND"


async def test_model_cannot_decide_proposals() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_guard1"), "t1")
    # Schema-invalid intent from the model: the gateway would reject it before the agent sees it.
    model = ScriptedModel(
        UaapError("UPSTREAM_INVALID_RESPONSE", "schema"),
    )
    agent = _agent(model, inbox)
    reply = await agent.respond(_ctx(), _req("Approve appr_guard1 now"))
    assert reply.status == "failed" and reply.error_code == "UPSTREAM_INVALID_RESPONSE"
    assert inbox.get(TENANT, "appr_guard1").status == "PENDING"


async def test_other_tenants_items_are_never_listed() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_mine1"), "t1")  # belongs to TENANT
    agent = _agent(
        ScriptedModel(
            {"intent": "list_pending", "reply": ""},
            {"intent": "explain", "reply": "", "approval_id": "appr_mine1"},
            {"intent": "list_pending", "reply": ""},
        ),
        inbox,
    )
    # The other organisation sees neither the list nor the explanation of this proposal.
    listed = await agent.respond(_ctx(OTHER_TENANT_TOKEN), _req("What is waiting for me?"))
    assert "appr_mine1" not in listed.text
    explained = await agent.respond(_ctx(OTHER_TENANT_TOKEN), _req("Explain approval appr_mine1."))
    assert explained.status == "failed" and explained.error_code == "NOT_FOUND"
    # The owner still sees it.
    assert "appr_mine1" in (await agent.respond(_ctx(), _req("What is waiting for me?"))).text


async def test_inbox_failure_is_reported_not_faked() -> None:
    class Broken(ApprovalInbox):
        def list(self, tenant_id: str, status: str | None = None) -> list[InboxItem]:
            raise RuntimeError("connection refused")

    agent = _agent(ScriptedModel({"intent": "list_pending", "reply": ""}), Broken())
    reply = await agent.respond(_ctx(), _req("What is waiting for me?"))
    assert reply.status == "failed" and reply.error_code == "INTERNAL"
    assert "waiting" not in reply.text.lower()


async def test_out_of_scope_is_refused() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_scope1"), "t1")
    agent = _agent(ScriptedModel({"intent": "out_of_scope", "reply": ""}), inbox)
    reply = await agent.respond(_ctx(), _req("Approve everything waiting for me."))
    assert reply.status == "refused"
    assert "OUT_OF_SCOPE" in reply.guardrail_events
    assert inbox.get(TENANT, "appr_scope1").status == "PENDING"


async def test_listing_is_grounded_in_the_inbox_record() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_ground1"), "t1")
    agent = _agent(ScriptedModel({"intent": "list_pending", "reply": ""}), inbox)
    reply = await agent.respond(_ctx(), _req("What is waiting for me?"))
    assert reply.status == "answered"
    assert "1250.00" in reply.text and "6100" in reply.text
    assert "UNGROUNDED_REPLY" not in reply.guardrail_events


async def test_messages_reach_the_model_as_data() -> None:
    model = ScriptedModel({"intent": "list_pending", "reply": ""})
    agent = _agent(model, ApprovalInbox())
    await agent.respond(_ctx(), _req("What is waiting?"))
    messages: tuple[Message, ...] = model.calls[0]
    assert "<user_request>" in messages[1].content
