"""Onboard Ola agent tests for HRM-10."""

from __future__ import annotations

from typing import Any

from uaap.agents.base import AgentInput
from uaap.agents.onboard_ola import OnboardingRecord, OnboardingStore, OnboardOla
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner

from ..tools.fakes import (
    ACCOUNTANT_TOKEN,
    COMPANY,
    TENANT,
    caller,
)
from .test_finance_agent import ScriptedModel

TODAY = "2026-11-19"


def _agent(model: Any, store: OnboardingStore | None = None) -> OnboardOla:
    runner = AgentRunner(InMemoryCheckpointStore(), ApprovalEngine())
    return OnboardOla(model, runner, store or OnboardingStore(), metrics=AgentMetrics())


def _req(message: str) -> AgentInput:
    return AgentInput(message=message, today=TODAY, company_id=COMPANY)


def _ctx(token: str = ACCOUNTANT_TOKEN) -> Any:
    return caller(token, agent_id=None)


async def test_ola_generates_role_specific_checklist() -> None:
    agent = _agent(ScriptedModel({"intent": "generate_checklist", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("Create onboarding checklist for new hire in finance."))
    assert reply.status == "answered"
    assert "onboarding checklist for finance" in reply.text
    assert "workstation" in reply.text or "accounting" in reply.text


async def test_ola_proposes_access_requires_approval() -> None:
    agent = _agent(
        ScriptedModel(
            {
                "intent": "propose_access",
                "employee_name": "Jane Doe",
                "department": "engineering",
                "reply": "",
            }
        )
    )
    reply = await agent.respond(_ctx(), _req("Propose engineering access for Jane Doe."))
    assert reply.status == "answered"
    assert "Manager approval is required" in reply.text
    assert reply.data.get("proposed") is True


async def test_ola_checks_onboarding_status() -> None:
    store = OnboardingStore()
    store.add_record(
        TENANT,
        OnboardingRecord(
            employee_id="EMP-101",
            tenant_id=TENANT,
            full_name="Alice Smith",
            department="engineering",
            role_title="Senior Developer",
            start_date=TODAY,
            checklist_status="IN_PROGRESS",
            tasks=["Setup laptop", "Badge access"],
        ),
    )
    agent = _agent(
        ScriptedModel({"intent": "check_status", "employee_id": "EMP-101", "reply": ""}), store
    )
    reply = await agent.respond(_ctx(), _req("What is the onboarding status for employee EMP-101?"))
    assert reply.status == "answered"
    assert "EMP-101" in reply.text
    assert "Alice Smith" in reply.text
    assert "IN_PROGRESS" in reply.text


async def test_ola_missing_role_asks_clarification() -> None:
    agent = _agent(ScriptedModel({"intent": "clarify", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("Start onboarding."))
    assert reply.status == "needs_clarification"


async def test_ola_unknown_employee_not_found() -> None:
    agent = _agent(
        ScriptedModel({"intent": "check_status", "employee_id": "EMP-999", "reply": ""})
    )
    reply = await agent.respond(_ctx(), _req("Status for employee EMP-999?"))
    assert reply.status == "failed"
    assert reply.error_code == "NOT_FOUND"


async def test_ola_refuses_direct_permission_elevation() -> None:
    agent = _agent(ScriptedModel({"intent": "out_of_scope", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("Grant superadmin and platform root privileges directly."))
    assert reply.status == "refused"
    assert "privilege elevation" in reply.text
