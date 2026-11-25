"""Approval Reminder (B4): a deterministic check of the approvals inbox that flags what needs a nudge.

Two fixed rules over pending proposals:
- urgent: the proposal expires within a day;
- stale: the proposal has waited longer than two days (and is not already urgent).

It only reports. Sending a reminder to a person needs the notification provider (PLT-10), which is not
built yet, so for now the reminders appear in the reply and the admin console, and nothing is sent.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from uaap.agents.base import AgentCard, AgentInput, AgentReply, CaseStory, EdgeCase, Kpi, Trace, UseCase
from uaap.agents.deterministic import DeterministicBot
from uaap.agents.guardrails import MANDATORY_GUARDRAILS
from uaap.approvals.inbox import ApprovalInbox
from uaap.runtime.runner import AgentRunner
from uaap.tools.agents import AgentPrincipal
from uaap.tools.types import CallerContext

AGENT_ID = "approval-reminder"
URGENT_WITHIN = timedelta(hours=24)
STALE_AFTER = timedelta(days=2)

PRINCIPAL = AgentPrincipal(
    agent_id=AGENT_ID, display_name="Approval Reminder", grants=frozenset(), tools=frozenset()
)

_ERRORS: dict[str, str] = {
    "INTERNAL": "Something went wrong on our side. Nothing was sent or decided. Please try again.",
    "VALIDATION": "I could not use that request as written. Please check it and try again.",
    "UNAUTHENTICATED": "Your session has ended. Please sign in again.",
    "FORBIDDEN": "You do not have permission to see these approvals.",
    "NOT_FOUND": "I could not find the approvals for your organisation.",
    "CONFLICT": "The approvals changed while I was checking them. Please check again.",
    "TOOL_BLOCKED": "That action is not allowed for agents.",
    "RATE_LIMITED": "Too many requests right now. Please try again shortly.",
    "QUOTA_EXCEEDED": "The check limit for this period has been reached. Please try again later.",
    "UPSTREAM_FAILED": "The approvals service is unavailable. Nothing was sent or decided.",
    "UPSTREAM_TIMEOUT": "The approvals service took too long to respond. Please try again.",
    "UPSTREAM_INVALID_RESPONSE": (
        "The approvals service returned data I could not verify, so I have not reported on it."
    ),
    "UNGROUNDED_REPLY": "I could not verify my report against the approvals, so I have not shown it.",
    "AGENT_DISABLED": "This reminder check has been switched off by an administrator.",
}


def classify(pending: list[dict[str, Any]], now: datetime) -> list[tuple[str, dict[str, Any]]]:
    """Return (level, proposal) for each pending proposal that needs a nudge. Deterministic."""
    out: list[tuple[str, dict[str, Any]]] = []
    for view in pending:
        expires = datetime.fromisoformat(view["expires_at"])
        created = datetime.fromisoformat(view["created_at"])
        if expires - now <= URGENT_WITHIN:
            out.append(("urgent", view))
        elif now - created > STALE_AFTER:
            out.append(("stale", view))
    return out


CARD = AgentCard(
    agent_id=AGENT_ID,
    name="Approval Reminder",
    version="1.0.0",
    owner="Platform team",
    purpose=(
        "Flag pending approvals that expire within a day or have waited more than two days, so someone "
        "can decide them in time. It reports only; it sends nothing and decides nothing."
    ),
    use_cases=(
        UseCase(
            "Find approvals that need a nudge",
            "Which approvals need a reminder?",
            "The pending proposals that expire within a day or have waited over two days.",
            None,
            None,
        ),
        UseCase(
            "Check after a quiet day",
            "Is anything about to lapse?",
            "The same check; urgent items come first in the list.",
            None,
            None,
        ),
    ),
    case_stories=(
        CaseStory(
            title="Morning nudge",
            actor="Platform operator",
            situation="A proposal has sat unanswered and the operator wants it raised before it lapses.",
            steps=(
                "The check runs and finds a proposal that expires within a day.",
                "It is listed as urgent with its id and expiry date.",
                "The operator tells the approver; delivery to the approver arrives with PLT-10.",
            ),
            outcome="The lapsing proposal is seen in time; no reminder is sent automatically yet.",
        ),
        CaseStory(
            title="A proposal forgotten for days",
            actor="Financial controller",
            situation="A proposal has waited for several days without a decision.",
            steps=(
                "The check finds it has waited longer than two days.",
                "It is listed as stale, not urgent, so the order of work stays clear.",
            ),
            outcome="The controller sees the backlog and decides it in the inbox.",
        ),
    ),
    edge_cases=(
        EdgeCase("Nothing pending", "Says so plainly.", "test_nothing_to_remind_says_so"),
        EdgeCase(
            "Proposal expiring within a day",
            "Flagged urgent.",
            "test_expiring_within_a_day_is_urgent",
        ),
        EdgeCase(
            "Proposal waiting over two days",
            "Flagged stale.",
            "test_waiting_over_two_days_is_stale",
        ),
        EdgeCase(
            "Recent, far-from-expiry proposal",
            "Not flagged.",
            "test_recent_proposal_is_not_flagged",
        ),
        EdgeCase(
            "Decided proposal",
            "Ignored.",
            "test_decided_proposals_are_ignored",
        ),
        EdgeCase(
            "Another organisation's proposal",
            "Never checked or shown.",
            "test_other_tenants_items_are_not_checked",
        ),
        EdgeCase(
            "Inbox unavailable",
            "Reports the failure; never a clean result.",
            "test_inbox_failure_is_not_reported_as_clean",
        ),
        EdgeCase(
            "Anything that would send or decide",
            "Nothing is sent or decided by this bot.",
            "test_nothing_is_sent_or_decided",
        ),
    ),
    out_of_scope=(
        "Sending reminders to people (needs the notification provider, PLT-10)",
        "Approving, rejecting or extending proposals",
        "Escalating to other people automatically",
    ),
    guardrails=MANDATORY_GUARDRAILS,
    error_handling=_ERRORS,
    kpis=(
        Kpi(
            "Proposals that lapse",
            "Pending proposals that expire without a decision.",
            "Zero; any lapse is reviewed",
        ),
    ),
    data_sources=("The approvals inbox for the caller's organisation (status, creation and expiry times)",),
)


class ApprovalReminder(DeterministicBot):
    card = CARD
    principal = PRINCIPAL

    def __init__(self, runner: AgentRunner, inbox: ApprovalInbox, **kwargs: Any) -> None:
        super().__init__(runner, **kwargs)
        self._inbox = inbox

    async def _handle(self, caller: CallerContext, inp: AgentInput, trace: Trace) -> AgentReply:
        items = await asyncio.to_thread(self._inbox.list, caller.tenant_id)
        views = [item.public(caller.actor_id) for item in items]
        trace.sources.add(views)
        pending = [v for v in views if v["status"] == "PENDING"]
        flagged = classify(pending, datetime.now(UTC))
        if not flagged:
            return AgentReply("answered", "No approval needs a reminder right now.", data={"findings": []})

        lines = ["These approvals need a reminder:"]
        for level, view in flagged:
            reason = (
                "expires within the next day"
                if level == "urgent"
                else "has been waiting longer than two days"
            )
            lines.append(
                f"- {view['summary']} (approval {view['approval_id']}, {reason}, "
                f"expires {view['expires_at'][:10]})"
            )
        findings = [{"approval_id": v["approval_id"], "level": level} for level, v in flagged]
        return AgentReply("answered", "\n".join(lines), data={"findings": findings})
