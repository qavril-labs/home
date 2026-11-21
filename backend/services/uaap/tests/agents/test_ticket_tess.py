"""Ticket Tess agent tests for AGT-05."""

from __future__ import annotations

from typing import Any

from uaap.agents.base import AgentInput
from uaap.agents.ticket_tess import SupportStore, SupportTicket, TicketTess
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


def _agent(model: Any, store: SupportStore | None = None) -> TicketTess:
    runner = AgentRunner(InMemoryCheckpointStore(), ApprovalEngine())
    return TicketTess(model, runner, store or SupportStore(), metrics=AgentMetrics())


def _req(message: str) -> AgentInput:
    return AgentInput(message=message, today=TODAY, company_id=COMPANY)


def _ctx(token: str = ACCOUNTANT_TOKEN) -> Any:
    return caller(token, agent_id=None)


async def test_tess_answers_from_knowledge_base() -> None:
    agent = _agent(ScriptedModel({"intent": "faq_answer", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("How do I reset my password?"))
    assert reply.status == "answered"
    assert "reset your password" in reply.text


async def test_tess_checks_existing_ticket_status() -> None:
    store = SupportStore()
    store.add_ticket(
        TENANT,
        SupportTicket(
            ticket_id="TIK-1001",
            tenant_id=TENANT,
            customer_id="cust-1",
            subject="Invoice tax discrepancy",
            category="billing",
            status="IN_PROGRESS",
            created_at=f"{TODAY}T08:00:00Z",
            updated_at=f"{TODAY}T09:00:00Z",
        ),
    )
    agent = _agent(ScriptedModel({"intent": "check_ticket", "ticket_id": "TIK-1001", "reply": ""}), store)
    reply = await agent.respond(_ctx(), _req("What is the status of ticket TIK-1001?"))
    assert reply.status == "answered"
    assert "TIK-1001" in reply.text
    assert "IN_PROGRESS" in reply.text


async def test_tess_ticket_status_requires_id() -> None:
    agent = _agent(ScriptedModel({"intent": "check_ticket", "ticket_id": "", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("What is the status of my ticket?"))
    assert reply.status == "needs_clarification"
    assert "provide the ticket identifier" in reply.text


async def test_tess_unknown_ticket_not_found() -> None:
    agent = _agent(ScriptedModel({"intent": "check_ticket", "ticket_id": "TIK-9999", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("Status of ticket TIK-9999?"))
    assert reply.status == "failed"
    assert reply.error_code == "NOT_FOUND"


async def test_tess_hands_over_to_human_agent() -> None:
    agent = _agent(ScriptedModel({"intent": "escalate_human", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("I want to speak with a human support agent immediately."))
    assert reply.status == "answered"
    assert "escalated your request to a human support agent" in reply.text
    assert reply.data.get("escalated") is True


async def test_tess_refuses_out_of_scope_financial_posts() -> None:
    agent = _agent(ScriptedModel({"intent": "out_of_scope", "reply": ""}))
    reply = await agent.respond(_ctx(), _req("Post a journal entry of 5000 USD to debit 1000."))
    assert reply.status == "refused"
    assert "knowledge base" in reply.text
