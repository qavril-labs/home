"""Approval Reminder: deterministic flags over the inbox; reports only, never sends or decides."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from uaap.agents.approval_reminder import ApprovalReminder
from uaap.agents.base import AgentCatalog, AgentInput
from uaap.approvals.inbox import ApprovalInbox, InboxItem
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner
from uaap.tools.types import CallerContext

from ..tools.fakes import ACCOUNTANT_TOKEN, COMPANY, OTHER_TENANT_TOKEN, TENANT, caller

TODAY = "2026-11-09"


def _item(
    approval_id: str,
    *,
    expires_in: timedelta = timedelta(days=3),
    created_ago: timedelta = timedelta(0),
    status: str = "PENDING",
    tenant: str = TENANT,
) -> InboxItem:
    now = datetime.now(UTC)
    return InboxItem(
        approval_id=approval_id,
        tenant_id=tenant,
        run_id=f"run_{approval_id}",
        agent_id="universal-finance-agent",
        initiator_id="user-accountant",
        action="ledger_post_journal_entry",
        summary=f"Proposed entry {approval_id} dated 2026-11-30 in USD:\n- debit 6100 1250.00",
        payload={"tool_name": "ledger_post_journal_entry", "arguments": {"companyId": COMPANY}},
        payload_hash="b" * 64,
        created_at=now - created_ago,
        expires_at=now + expires_in,
        status=status,  # type: ignore[arg-type]
    )


def _bot(inbox: ApprovalInbox) -> ApprovalReminder:
    runner = AgentRunner(InMemoryCheckpointStore(), ApprovalEngine())
    bot = ApprovalReminder(runner, inbox, metrics=AgentMetrics())
    from uaap.tools.agents import AgentRegistry

    AgentCatalog(AgentRegistry(), None).add(bot)
    return bot


def _req() -> AgentInput:
    return AgentInput(message="Which approvals need a reminder?", today=TODAY, company_id=COMPANY)


def _ctx(token: str = ACCOUNTANT_TOKEN) -> CallerContext:
    return caller(token, agent_id=None)


async def test_nothing_to_remind_says_so() -> None:
    reply = await _bot(ApprovalInbox()).respond(_ctx(), _req())
    assert reply.status == "answered"
    assert reply.text == "No approval needs a reminder right now."
    assert reply.data == {"findings": []}


async def test_expiring_within_a_day_is_urgent() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_urgent1", expires_in=timedelta(hours=3)), "t")
    reply = await _bot(inbox).respond(_ctx(), _req())
    assert reply.data["findings"] == [{"approval_id": "appr_urgent1", "level": "urgent"}]
    assert "expires within the next day" in reply.text


async def test_waiting_over_two_days_is_stale() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_stale1", expires_in=timedelta(days=5), created_ago=timedelta(days=3)), "t")
    reply = await _bot(inbox).respond(_ctx(), _req())
    assert reply.data["findings"] == [{"approval_id": "appr_stale1", "level": "stale"}]
    assert "longer than two days" in reply.text


async def test_recent_proposal_is_not_flagged() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_fresh1", expires_in=timedelta(days=5), created_ago=timedelta(hours=1)), "t")
    reply = await _bot(inbox).respond(_ctx(), _req())
    assert reply.data["findings"] == []


async def test_decided_proposals_are_ignored() -> None:
    inbox = ApprovalInbox()
    inbox.add(
        _item("appr_done1", expires_in=timedelta(hours=2), created_ago=timedelta(days=5), status="APPROVED"),
        "t",
    )
    reply = await _bot(inbox).respond(_ctx(), _req())
    assert reply.data["findings"] == []


async def test_other_tenants_items_are_not_checked() -> None:
    inbox = ApprovalInbox()
    inbox.add(
        _item("appr_theirs1", expires_in=timedelta(hours=2), tenant="0193a000-0000-7000-8000-000000000002"),
        "t",
    )
    reply = await _bot(inbox).respond(_ctx(), _req())
    assert "appr_theirs1" not in reply.text
    mine = await _bot(inbox).respond(_ctx(OTHER_TENANT_TOKEN), _req())
    assert "appr_theirs1" in mine.text


async def test_inbox_failure_is_not_reported_as_clean() -> None:
    class Broken(ApprovalInbox):
        def list(self, tenant_id: str, status: str | None = None) -> list[InboxItem]:
            raise RuntimeError("connection refused")

    reply = await _bot(Broken()).respond(_ctx(), _req())
    assert reply.status == "failed" and reply.error_code == "INTERNAL"
    assert "No approval needs a reminder" not in reply.text


async def test_nothing_is_sent_or_decided() -> None:
    inbox = ApprovalInbox()
    inbox.add(_item("appr_keep1", expires_in=timedelta(hours=2)), "t")
    bot = _bot(inbox)
    await bot.respond(_ctx(), _req())
    assert inbox.get(TENANT, "appr_keep1").status == "PENDING"
    assert bot.principal.grants == frozenset() and bot.principal.tools == frozenset()
    assert bot.deterministic is True


async def test_deterministic_bot_refuses_any_model_call() -> None:
    import pytest

    from uaap.agents.base import Trace
    from uaap.errors import UaapError

    bot = _bot(ApprovalInbox())
    with pytest.raises(UaapError) as exc:
        await bot.ask_model(_ctx(), _req(), Trace(), {"type": "object"})
    assert exc.value.code == "INTERNAL"
