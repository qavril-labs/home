"""Ledger Invariant Checker (B3): a deterministic check that the books still balance.

It reads the trial balance through the tool boundary (Tier 1, read only) and applies fixed rules:
totals agree, rows add up to the totals, every amount is readable and non-negative, and everything is
in the base currency. It reports; it never corrects. Every figure it states is either read from the
ledger or computed here with decimal arithmetic, and the computed figures are registered as sources.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from uaap.agents.base import AgentCard, AgentInput, AgentReply, CaseStory, EdgeCase, Kpi, Trace, UseCase
from uaap.agents.deterministic import DeterministicBot
from uaap.agents.guardrails import MANDATORY_GUARDRAILS
from uaap.runtime.state import AgentStatus
from uaap.tools.agents import AgentPrincipal
from uaap.tools.types import CallerContext

AGENT_ID = "ledger-invariant-checker"
TOOL = "ledger_get_trial_balance"

PRINCIPAL = AgentPrincipal(
    agent_id=AGENT_ID,
    display_name="Ledger Invariant Checker",
    grants=frozenset({"fin.report.read"}),
    tools=frozenset({TOOL}),
)

_ERRORS: dict[str, str] = {
    "INTERNAL": "Something went wrong on our side. The ledger was not changed. Please try again.",
    "VALIDATION": "I could not use that request as written. Please check it and try again.",
    "UNAUTHENTICATED": "Your session has ended. Please sign in again.",
    "FORBIDDEN": "You do not have permission to read the ledger, so I did not check it.",
    "NOT_FOUND": "I could not find that company.",
    "CONFLICT": "The ledger changed while I was checking it. Please run the check again.",
    "TOOL_BLOCKED": "That action is not allowed for agents.",
    "RATE_LIMITED": "Too many requests right now. Please try again shortly.",
    "QUOTA_EXCEEDED": "The check limit for this period has been reached. Please try again later.",
    "UPSTREAM_FAILED": "The ledger is unavailable, so I could not check it.",
    "UPSTREAM_TIMEOUT": "The ledger took too long to respond, so I could not check it.",
    "UPSTREAM_INVALID_RESPONSE": "The ledger returned data I could not verify, so I have not reported on it.",
    "UNGROUNDED_REPLY": "I could not verify my report against the ledger, so I have not shown it.",
    "AGENT_DISABLED": "This check has been switched off by an administrator.",
}


def _money(value: Any) -> Decimal | None:
    if not isinstance(value, dict) or not isinstance(value.get("amount"), str):
        return None
    try:
        return Decimal(value["amount"])
    except InvalidOperation:
        return None


def check_trial_balance(output: dict[str, Any], trace: Trace) -> list[str]:
    """Apply the fixed rules. Returns one line per failed rule; an empty list means all hold."""
    findings: list[str] = []
    base = output.get("baseCurrency")
    rows = output.get("rows") or []
    row_debit = Decimal(0)
    row_credit = Decimal(0)

    for row in rows:
        account = row.get("account", "?")
        for side in ("debit", "credit"):
            money = row.get(side)
            amount = _money(money)
            if amount is None:
                findings.append(f"Account {account}: the {side} amount could not be read.")
                continue
            if amount < 0:
                findings.append(f"Account {account}: the {side} amount is negative.")
            if isinstance(money, dict) and money.get("currency") != base:
                findings.append(f"Account {account}: the {side} is not in the base currency.")
            if side == "debit":
                row_debit += amount
            else:
                row_credit += amount

    total_debit = _money(output.get("totalDebit"))
    total_credit = _money(output.get("totalCredit"))
    if total_debit is None or total_credit is None:
        findings.append("The totals could not be read.")
        return findings

    if row_debit != total_debit:
        trace.sources.add(str(row_debit))
        findings.append("The rows' debits do not add up to the total debit.")
    if row_credit != total_credit:
        trace.sources.add(str(row_credit))
        findings.append("The rows' credits do not add up to the total credit.")
    if total_debit != total_credit:
        difference = abs(total_debit - total_credit)
        trace.sources.add(str(difference))  # Deterministic calculation: cited so it can be stated.
        findings.append(f"Total debit and total credit differ by {difference}.")
    return findings


CARD = AgentCard(
    agent_id=AGENT_ID,
    name="Ledger Invariant Checker",
    version="1.0.0",
    owner="Finance platform team",
    purpose=(
        "Check that the general ledger still balances as of a date: totals agree, rows add up, amounts are "
        "readable and non-negative, and everything is in the base currency. It reports findings and never "
        "changes the ledger."
    ),
    use_cases=(
        UseCase(
            "Check the books as of a date",
            "Check the ledger as of 2026-11-30.",
            "A pass, or the list of failed checks with the exact difference.",
            TOOL,
            1,
        ),
        UseCase(
            "Check before close",
            "Does the ledger balance before I close the period?",
            "The same check, phrased for the period close.",
            TOOL,
            1,
        ),
    ),
    case_stories=(
        CaseStory(
            title="Pre-close balance check",
            actor="Financial controller",
            situation="Before closing the month the controller needs to know the books balance.",
            steps=(
                "The controller asks the checker to check the ledger as of the period end.",
                "The checker reads the trial balance through the read-only tool and applies its fixed rules.",
                "The checker reports a pass, or lists each failed rule with the exact difference.",
            ),
            outcome="The controller knows whether the books balance, with the reason if they do not.",
        ),
        CaseStory(
            title="A row that does not add up",
            actor="Accountant",
            situation="A total in the ledger does not match the rows beneath it.",
            steps=(
                "The checker finds the rows do not add up to the total debit.",
                "It reports the rule that failed and does not guess which row is wrong.",
            ),
            outcome="The accountant is told exactly which rule failed; the fix is theirs to make.",
        ),
    ),
    edge_cases=(
        EdgeCase("Balanced ledger", "Passes every check.", "test_balanced_ledger_passes"),
        EdgeCase(
            "Total debit differs from total credit",
            "Reports the exact difference.",
            "test_unbalanced_totals_are_reported_with_difference",
        ),
        EdgeCase(
            "Rows do not add up to the totals",
            "Reports which total does not match its rows.",
            "test_row_sums_must_match_totals",
        ),
        EdgeCase(
            "Negative amount on a row",
            "Flagged.",
            "test_negative_amount_is_flagged",
        ),
        EdgeCase(
            "Amount that cannot be read",
            "Flagged; no value is guessed.",
            "test_unreadable_amount_is_flagged_not_guessed",
        ),
        EdgeCase(
            "Amount in another currency",
            "Flagged as not in the base currency.",
            "test_other_currency_is_flagged",
        ),
        EdgeCase(
            "No company selected",
            "Asks for the company; the ledger is not read.",
            "test_missing_company_is_asked_for",
        ),
        EdgeCase(
            "Ledger unavailable",
            "Reports that it could not check; never a pass.",
            "test_ledger_failure_is_reported_not_as_a_pass",
        ),
    ),
    out_of_scope=(
        "Correcting, reversing or editing any ledger entry",
        "Posting, approving or closing periods",
        "Checks other than the trial balance (sub-ledgers and bank reconciliation are separate bots)",
    ),
    guardrails=MANDATORY_GUARDRAILS,
    error_handling=_ERRORS,
    kpis=(
        Kpi(
            "Failed checks found",
            "Share of runs that report at least one failed rule.",
            "Tracked; every failure investigated",
        ),
        Kpi("Withheld replies", "Replies blocked by the grounding check.", "Zero shown to users"),
    ),
    data_sources=(
        "Core SaaS ledger trial balance (read through the tool boundary, Tier 1)",
        "Figures computed by the checker's own decimal arithmetic, cited as sources",
    ),
)


class LedgerInvariantChecker(DeterministicBot):
    card = CARD
    principal = PRINCIPAL

    async def _handle(self, caller: CallerContext, inp: AgentInput, trace: Trace) -> AgentReply:
        if not inp.company_id:
            return AgentReply("needs_clarification", "Please choose the company to check first.")
        state, _ = await self.run_tool(
            caller,
            inp,
            trace,
            {"tool_name": TOOL, "arguments": {"companyId": inp.company_id, "asOf": inp.today}},
        )
        if state.status != AgentStatus.COMPLETED:
            return self.failure_from_state(state)
        results = state.working_context.get("tool_results") or []
        if not results:
            return self.error_reply("UPSTREAM_INVALID_RESPONSE", run_id=state.run_id)

        findings = check_trial_balance(results[-1]["output"], trace)
        if not findings:
            text = (
                f"The ledger as of {inp.today} passes every check: totals agree and every amount is readable."
            )
        else:
            text = "\n".join(
                [f"The ledger as of {inp.today} fails these checks:", *(f"- {f}" for f in findings)]
            )
        return AgentReply("answered", text, run_id=state.run_id, data={"findings": findings})
