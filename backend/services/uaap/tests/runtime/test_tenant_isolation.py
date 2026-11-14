"""End-to-end multi-tenant isolation and workflow tests across AgentRunner and components."""

from __future__ import annotations

from typing import Any

import pytest

from uaap.errors import UaapError
from uaap.gateway.metering import InMemoryMeteringService
from uaap.gateway.types import Message
from uaap.obs.audit import InMemoryAuditSink
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner
from uaap.runtime.state import AgentStatus


@pytest.mark.asyncio
async def test_agent_runner_hitl_approval_lifecycle() -> None:
    audit = InMemoryAuditSink()
    metering = InMemoryMeteringService()
    store = InMemoryCheckpointStore()
    approval_engine = ApprovalEngine(audit_sink=audit)

    runner = AgentRunner(
        checkpoint_store=store,
        approval_engine=approval_engine,
        metering_service=metering,
        audit_sink=audit,
    )

    tenant_id = "tenant_enterprise"
    initiator_id = "operator_alice"
    approver_id = "director_bob"

    tier3_action: dict[str, Any] = {
        "action_name": "approve_purchase_order",
        "risk_tier": 3,
        "payload": {"po_id": "PO-2026-99", "amount": 75000},
        "summary": "Approve large PO for construction concrete",
    }

    # 1. Create run
    run_state = await runner.create_run(
        tenant_id=tenant_id,
        actor_id=initiator_id,
        messages=(Message(role="user", content="Please execute PO-2026-99"),),
        pending_action=tier3_action,
    )
    assert run_state.status == AgentStatus.PENDING
    assert run_state.run_id.startswith("run_")

    # 2. Start run -> halts at AWAITING_APPROVAL because of Tier 3 action
    running_state, raw_token = await runner.start_run(
        tenant_id=tenant_id,
        run_id=run_state.run_id,
    )
    assert running_state.status == AgentStatus.AWAITING_APPROVAL
    assert running_state.pending_approval is not None
    assert raw_token is not None

    approval_id = running_state.pending_approval.approval_id

    # 3. Resume after approval by authorized director
    completed_state = await runner.resume_after_approval(
        tenant_id=tenant_id,
        run_id=run_state.run_id,
        approval_id=approval_id,
        approving_actor_id=approver_id,
        presented_raw_token=raw_token,
        confirmed_payload=tier3_action["payload"],
    )
    assert completed_state.status == AgentStatus.COMPLETED
    assert completed_state.working_context.get("approved_approve_purchase_order") is True


@pytest.mark.asyncio
async def test_agent_runner_rejection_lifecycle() -> None:
    store = InMemoryCheckpointStore()
    approval_engine = ApprovalEngine()
    runner = AgentRunner(checkpoint_store=store, approval_engine=approval_engine)

    tenant_id = "tenant_enterprise"
    tier3_action = {
        "action_name": "transfer_vendor_funds",
        "risk_tier": 3,
        "payload": {"amount": 100000},
    }

    run_state = await runner.create_run(
        tenant_id=tenant_id,
        actor_id="operator_alice",
        messages=(Message(role="user", content="Pay vendor"),),
        pending_action=tier3_action,
    )

    running_state, _ = await runner.start_run(
        tenant_id=tenant_id,
        run_id=run_state.run_id,
    )
    assert running_state.status == AgentStatus.AWAITING_APPROVAL
    approval_id = running_state.pending_approval.approval_id  # type: ignore[union-attr]

    # Reject run
    rejected_state = await runner.reject_run(
        tenant_id=tenant_id,
        run_id=run_state.run_id,
        approval_id=approval_id,
        rejecting_actor_id="compliance_officer_carol",
        reason="Sanctions check incomplete",
    )
    assert rejected_state.status == AgentStatus.REJECTED
    assert rejected_state.error == "Sanctions check incomplete"


@pytest.mark.asyncio
async def test_agent_runner_cancellation() -> None:
    store = InMemoryCheckpointStore()
    approval_engine = ApprovalEngine()
    runner = AgentRunner(checkpoint_store=store, approval_engine=approval_engine)

    tenant_id = "tenant_enterprise"
    run_state = await runner.create_run(
        tenant_id=tenant_id,
        actor_id="operator_alice",
        messages=(Message(role="user", content="Long task"),),
    )

    cancelled = await runner.cancel_run(
        tenant_id=tenant_id,
        run_id=run_state.run_id,
        actor_id="operator_alice",
        reason="No longer needed",
    )
    assert cancelled.status == AgentStatus.CANCELLED
    assert cancelled.error == "No longer needed"


@pytest.mark.asyncio
async def test_cross_tenant_runner_isolation() -> None:
    store = InMemoryCheckpointStore()
    approval_engine = ApprovalEngine()
    runner = AgentRunner(checkpoint_store=store, approval_engine=approval_engine)

    # Tenant Alpha creates a run
    alpha_state = await runner.create_run(
        tenant_id="tenant_alpha",
        actor_id="alpha_user",
        messages=(Message(role="user", content="Alpha confidential run"),),
    )

    # Tenant Beta attempts to get Tenant Alpha's run -> returns None
    beta_get = await runner.get_run("tenant_beta", alpha_state.run_id)
    assert beta_get is None

    # Tenant Beta attempts to start Tenant Alpha's run -> raises NOT_FOUND
    with pytest.raises(UaapError) as exc_info:
        await runner.start_run(tenant_id="tenant_beta", run_id=alpha_state.run_id)
    assert exc_info.value.code == "NOT_FOUND"

    # Tenant Beta attempts to cancel Tenant Alpha's run -> raises NOT_FOUND
    with pytest.raises(UaapError) as exc_info:
        await runner.cancel_run(tenant_id="tenant_beta", run_id=alpha_state.run_id, actor_id="beta_user")
    assert exc_info.value.code == "NOT_FOUND"
