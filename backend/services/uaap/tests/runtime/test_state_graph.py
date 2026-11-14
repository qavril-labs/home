"""Unit tests for LangGraph StateGraph, lifecycle transitions, step limits, and risk tiers."""

from __future__ import annotations

import pytest

from uaap.errors import UaapError
from uaap.runtime.graph import RuntimeGraphState, build_runtime_graph
from uaap.runtime.state import (
    CANONICAL_TIERS,
    AgentStatus,
    validate_state_transition,
)


def test_canonical_tiers_frozen_definition() -> None:
    """Verify that the 5 canonical risk tiers match the frozen UAAP specification."""
    assert len(CANONICAL_TIERS) == 5
    assert 1 in CANONICAL_TIERS
    assert "Read-Only" in CANONICAL_TIERS[1]
    assert 2 in CANONICAL_TIERS
    assert "Non-Binding Draft" in CANONICAL_TIERS[2]
    assert 3 in CANONICAL_TIERS
    assert "Approval-Required" in CANONICAL_TIERS[3]
    assert 4 in CANONICAL_TIERS
    assert "Operational Write" in CANONICAL_TIERS[4]
    assert 5 in CANONICAL_TIERS
    assert "Permanently Blocked" in CANONICAL_TIERS[5]


def test_valid_state_transitions() -> None:
    """Ensure permitted state transitions pass validation without error."""
    validate_state_transition(AgentStatus.PENDING, AgentStatus.RUNNING)
    validate_state_transition(AgentStatus.PENDING, AgentStatus.FAILED)
    validate_state_transition(AgentStatus.PENDING, AgentStatus.CANCELLED)

    validate_state_transition(AgentStatus.RUNNING, AgentStatus.AWAITING_APPROVAL)
    validate_state_transition(AgentStatus.RUNNING, AgentStatus.COMPLETED)
    validate_state_transition(AgentStatus.RUNNING, AgentStatus.FAILED)
    validate_state_transition(AgentStatus.RUNNING, AgentStatus.CANCELLED)

    validate_state_transition(AgentStatus.AWAITING_APPROVAL, AgentStatus.RUNNING)
    validate_state_transition(AgentStatus.AWAITING_APPROVAL, AgentStatus.REJECTED)
    validate_state_transition(AgentStatus.AWAITING_APPROVAL, AgentStatus.CANCELLED)
    validate_state_transition(AgentStatus.AWAITING_APPROVAL, AgentStatus.FAILED)


def test_invalid_state_transitions_rejected() -> None:
    """Ensure disallowed transitions raise typed UaapError('VALIDATION')."""
    with pytest.raises(UaapError) as exc_info:
        validate_state_transition(AgentStatus.COMPLETED, AgentStatus.RUNNING)
    assert exc_info.value.code == "VALIDATION"
    assert "Invalid agent state transition" in exc_info.value.message

    with pytest.raises(UaapError) as exc_info:
        validate_state_transition(AgentStatus.PENDING, AgentStatus.AWAITING_APPROVAL)
    assert exc_info.value.code == "VALIDATION"

    with pytest.raises(UaapError) as exc_info:
        validate_state_transition(AgentStatus.REJECTED, AgentStatus.RUNNING)
    assert exc_info.value.code == "VALIDATION"


@pytest.mark.asyncio
async def test_stategraph_normal_completion() -> None:
    """Graph advances from start through initialize and reason to COMPLETED."""
    workflow = build_runtime_graph()
    app = workflow.compile()

    state: RuntimeGraphState = {
        "run_id": "run_test_1",
        "tenant_id": "tenant_alpha",
        "actor_id": "user_1",
        "step_count": 0,
        "max_steps": 25,
        "status": AgentStatus.PENDING.value,
        "messages": [{"role": "user", "content": "Hello agent"}],
    }

    result = await app.ainvoke(state)
    assert result["status"] == AgentStatus.COMPLETED.value
    assert result["step_count"] == 1
    assert len(result["messages"]) == 2
    assert "Acknowledged: Hello agent" in result["messages"][-1]["content"]


@pytest.mark.asyncio
async def test_stategraph_tier_3_interrupt() -> None:
    """A Tier-3 pending action causes the graph to halt at AWAITING_APPROVAL."""
    workflow = build_runtime_graph()
    app = workflow.compile()

    state: RuntimeGraphState = {
        "run_id": "run_test_t3",
        "tenant_id": "tenant_alpha",
        "actor_id": "user_1",
        "step_count": 0,
        "max_steps": 25,
        "status": AgentStatus.PENDING.value,
        "messages": [{"role": "user", "content": "Trigger wire transfer"}],
        "pending_action": {
            "action_name": "transfer_funds",
            "risk_tier": 3,
            "payload": {"amount": 50000, "recipient": "ACME Corp"},
        },
    }

    result = await app.ainvoke(state)
    assert result["status"] == AgentStatus.AWAITING_APPROVAL.value
    assert result["step_count"] == 1


@pytest.mark.asyncio
async def test_stategraph_tier_5_permanently_blocked() -> None:
    """A Tier-5 action is rejected immediately, halting the graph in FAILED state."""
    workflow = build_runtime_graph()
    app = workflow.compile()

    state: RuntimeGraphState = {
        "run_id": "run_test_t5",
        "tenant_id": "tenant_alpha",
        "actor_id": "user_1",
        "step_count": 0,
        "max_steps": 25,
        "status": AgentStatus.PENDING.value,
        "messages": [{"role": "user", "content": "Drop table"}],
        "pending_action": {
            "action_name": "drop_table",
            "risk_tier": 5,
            "payload": {"query": "DROP TABLE invoices CASCADE;"},
        },
    }

    result = await app.ainvoke(state)
    assert result["status"] == AgentStatus.FAILED.value
    assert "Tier 5 operations are permanently blocked" in (result.get("error") or "")


@pytest.mark.asyncio
async def test_stategraph_tier_4_safe_mock_execution() -> None:
    """Tier 4 operational writes execute cleanly in safe simulation mode."""
    workflow = build_runtime_graph()
    app = workflow.compile()

    state: RuntimeGraphState = {
        "run_id": "run_test_t4",
        "tenant_id": "tenant_alpha",
        "actor_id": "user_1",
        "step_count": 0,
        "max_steps": 25,
        "status": AgentStatus.PENDING.value,
        "pending_action": {
            "action_name": "update_draft_ticket",
            "risk_tier": 4,
            "payload": {"ticket_id": "T-100", "status": "draft"},
        },
    }

    result = await app.ainvoke(state)
    assert result["status"] == AgentStatus.COMPLETED.value
    ctx = result.get("working_context", {})
    assert "result_update_draft_ticket" in ctx
    assert "(Tier 4)" in ctx["result_update_draft_ticket"]


@pytest.mark.asyncio
async def test_stategraph_max_steps_exceeded() -> None:
    """When step_count exceeds max_steps, the graph fails with a step bound error."""
    workflow = build_runtime_graph()
    app = workflow.compile()

    state: RuntimeGraphState = {
        "run_id": "run_test_limit",
        "tenant_id": "tenant_alpha",
        "actor_id": "user_1",
        "step_count": 25,
        "max_steps": 25,
        "status": AgentStatus.PENDING.value,
    }

    result = await app.ainvoke(state)
    assert result["status"] == AgentStatus.FAILED.value
    assert "Execution step limit exceeded" in (result.get("error") or "")
