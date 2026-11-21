"""Ledger Invariant Checker: fixed rules over the trial balance; reports, never corrects."""

from __future__ import annotations

from typing import Any

from uaap.agents.base import AgentCatalog, AgentInput
from uaap.agents.ledger_invariants import LedgerInvariantChecker
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner

from ..tools.fakes import ACCOUNTANT_TOKEN, COMPANY, FakeCoreSaas, build_stack, caller

TODAY = "2026-11-09"


def _money(amount: str, currency: str = "USD") -> dict[str, str]:
    return {"amount": amount, "currency": currency}


def _balance(
    rows: list[tuple[str, str, str]],
    total_debit: str,
    total_credit: str,
    currency: str = "USD",
) -> dict[str, Any]:
    return {
        "asOf": TODAY,
        "baseCurrency": "USD",
        "rows": [
            {"account": acc, "name": acc, "debit": _money(d, currency), "credit": _money(c, currency)}
            for acc, d, c in rows
        ],
        "totalDebit": _money(total_debit),
        "totalCredit": _money(total_credit),
    }


def _bot(fake: FakeCoreSaas) -> LedgerInvariantChecker:
    executor, _ = build_stack(fake)
    runner = AgentRunner(InMemoryCheckpointStore(), ApprovalEngine(), tool_executor=executor)
    bot = LedgerInvariantChecker(runner, metrics=AgentMetrics())
    AgentCatalog(executor.agents, executor.registry).add(bot)
    return bot


def _req(company: str | None = COMPANY) -> AgentInput:
    return AgentInput(message="Check the ledger.", today=TODAY, company_id=company)


def _ctx() -> Any:
    return caller(ACCOUNTANT_TOKEN, agent_id=None)


async def test_balanced_ledger_passes() -> None:
    fake = FakeCoreSaas()
    reply = await _bot(fake).respond(_ctx(), _req())
    assert reply.status == "answered"
    assert "passes every check" in reply.text
    assert reply.data["findings"] == []
    assert reply.guardrail_events == ()


async def test_unbalanced_totals_are_reported_with_difference() -> None:
    fake = FakeCoreSaas()
    fake.trial_balance = _balance([("1000", "10.00", "0.00"), ("4000", "0.00", "9.00")], "10.00", "9.00")
    reply = await _bot(fake).respond(_ctx(), _req())
    assert reply.status == "answered"
    assert "differ by 1.00" in reply.text
    assert "UNGROUNDED_REPLY" not in reply.guardrail_events


async def test_row_sums_must_match_totals() -> None:
    fake = FakeCoreSaas()
    # Totals say 10.00 each, but the rows only add up to 9.00 on the debit side.
    fake.trial_balance = _balance([("1000", "9.00", "0.00"), ("4000", "0.00", "10.00")], "10.00", "10.00")
    reply = await _bot(fake).respond(_ctx(), _req())
    assert "do not add up to the total debit" in reply.text
    assert "passes every check" not in reply.text


async def test_negative_amount_is_flagged() -> None:
    fake = FakeCoreSaas()
    fake.trial_balance = _balance([("1000", "-5.00", "0.00"), ("4000", "0.00", "-5.00")], "-5.00", "-5.00")
    reply = await _bot(fake).respond(_ctx(), _req())
    assert "negative" in reply.text
    assert "passes every check" not in reply.text


async def test_unreadable_amount_is_flagged_not_guessed() -> None:
    fake = FakeCoreSaas()
    fake.trial_balance = _balance([("1000", "ten", "0.00"), ("4000", "0.00", "10.00")], "10.00", "10.00")
    reply = await _bot(fake).respond(_ctx(), _req())
    assert "could not be read" in reply.text
    assert "passes every check" not in reply.text


async def test_other_currency_is_flagged() -> None:
    fake = FakeCoreSaas()
    fake.trial_balance = _balance(
        [("1000", "10.00", "0.00"), ("4000", "0.00", "10.00")], "10.00", "10.00", currency="EUR"
    )
    reply = await _bot(fake).respond(_ctx(), _req())
    assert "not in the base currency" in reply.text


async def test_missing_company_is_asked_for() -> None:
    fake = FakeCoreSaas()
    reply = await _bot(fake).respond(_ctx(), _req(company=None))
    assert reply.status == "needs_clarification"
    assert fake.requests == []


async def test_ledger_failure_is_reported_not_as_a_pass() -> None:
    fake = FakeCoreSaas()
    fake.fail_with = 500
    reply = await _bot(fake).respond(_ctx(), _req())
    assert reply.status == "failed"
    assert reply.error_code == "UPSTREAM_FAILED"
    assert "passes" not in reply.text
