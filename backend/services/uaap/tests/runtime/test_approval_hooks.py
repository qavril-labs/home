"""Unit tests for HITL ApprovalEngine, token hashing, dual-control, and replay protection."""

from __future__ import annotations

import asyncio

import pytest

from uaap.errors import UaapError
from uaap.obs.audit import InMemoryAuditSink
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.state import ApprovalStatus


@pytest.mark.asyncio
async def test_approval_request_creation() -> None:
    audit = InMemoryAuditSink()
    engine = ApprovalEngine(audit_sink=audit)

    payload = {"amount": 25000, "currency": "USD", "payee": "Subcontractor Alpha"}
    approval, raw_token = await engine.request_approval(
        run_id="run_hitl_1",
        tenant_id="tenant_pms",
        initiating_actor_id="operator_bob",
        action_name="release_escrow",
        summary="Release escrow payment",
        proposed_payload=payload,
        risk_tier=3,
        ttl_seconds=600,
    )

    assert approval.approval_id.startswith("appr_")
    assert approval.risk_tier == 3
    assert approval.status == ApprovalStatus.PENDING
    assert approval.initiating_actor_id == "operator_bob"

    # Crucial security invariants:
    # 1. Raw token is high-entropy string
    assert len(raw_token) > 30
    # 2. Raw token is NOT stored in approval record
    assert approval.single_use_token_hash != raw_token
    # 3. Payload hash is present
    assert len(approval.payload_hash) == 64

    # 4. Audit event emitted without raw token
    events = [e for e in audit.events if e.tenant_id == "tenant_pms"]
    assert len(events) == 1
    assert events[0].action == "approval.requested"
    assert raw_token not in str(events[0])


@pytest.mark.asyncio
async def test_approval_tier_5_permanently_blocked() -> None:
    engine = ApprovalEngine()
    with pytest.raises(UaapError) as exc_info:
        await engine.request_approval(
            run_id="run_tier5",
            tenant_id="tenant_pms",
            initiating_actor_id="operator_bob",
            action_name="drop_database",
            summary="Attempted drop",
            proposed_payload={"sql": "DROP DATABASE;"},
            risk_tier=5,
        )
    assert exc_info.value.code == "FORBIDDEN"
    assert "Tier 5" in exc_info.value.message


@pytest.mark.asyncio
async def test_approval_non_tier_3_rejected() -> None:
    engine = ApprovalEngine()
    with pytest.raises(UaapError) as exc_info:
        await engine.request_approval(
            run_id="run_tier1",
            tenant_id="tenant_pms",
            initiating_actor_id="operator_bob",
            action_name="read_report",
            summary="Attempted read approval",
            proposed_payload={},
            risk_tier=1,
        )
    assert exc_info.value.code == "VALIDATION"
    assert "strictly reserved for Tier 3" in exc_info.value.message


@pytest.mark.asyncio
async def test_approval_dual_control_rejects_self_approval() -> None:
    engine = ApprovalEngine()
    payload = {"invoice_id": "INV-100", "approved_amount": 1000}
    approval, raw_token = await engine.request_approval(
        run_id="run_dual",
        tenant_id="tenant_finance",
        initiating_actor_id="agent_alice",
        action_name="approve_invoice",
        summary="Approve invoice",
        proposed_payload=payload,
    )

    # Initiator attempts to self-approve
    with pytest.raises(UaapError) as exc_info:
        await engine.approve(
            tenant_id="tenant_finance",
            run_id="run_dual",
            approval_id=approval.approval_id,
            approving_actor_id="agent_alice",  # Same as initiating_actor_id
            presented_raw_token=raw_token,
            confirmed_payload=payload,
        )
    assert exc_info.value.code == "FORBIDDEN"
    assert "Dual-control separation of duties violation" in exc_info.value.message


@pytest.mark.asyncio
async def test_approval_invalid_token_rejected() -> None:
    engine = ApprovalEngine()
    payload = {"po_id": "PO-500"}
    approval, _ = await engine.request_approval(
        run_id="run_tok",
        tenant_id="tenant_finance",
        initiating_actor_id="agent_alice",
        action_name="issue_po",
        summary="Issue PO",
        proposed_payload=payload,
    )

    with pytest.raises(UaapError) as exc_info:
        await engine.approve(
            tenant_id="tenant_finance",
            run_id="run_tok",
            approval_id=approval.approval_id,
            approving_actor_id="manager_dan",
            presented_raw_token="completely_wrong_token_1234567890",
            confirmed_payload=payload,
        )
    assert exc_info.value.code == "UNAUTHENTICATED"
    assert "mismatched approval token" in exc_info.value.message


@pytest.mark.asyncio
async def test_approval_payload_tampering_detected() -> None:
    engine = ApprovalEngine()
    original_payload = {"amount": 500, "payee": "Contractor"}
    tampered_payload = {"amount": 500000, "payee": "Attacker"}

    approval, raw_token = await engine.request_approval(
        run_id="run_tamper",
        tenant_id="tenant_finance",
        initiating_actor_id="agent_alice",
        action_name="pay_contractor",
        summary="Pay contractor",
        proposed_payload=original_payload,
    )

    with pytest.raises(UaapError) as exc_info:
        await engine.approve(
            tenant_id="tenant_finance",
            run_id="run_tamper",
            approval_id=approval.approval_id,
            approving_actor_id="manager_dan",
            presented_raw_token=raw_token,
            confirmed_payload=tampered_payload,  # Tampered payload
        )
    assert exc_info.value.code == "VALIDATION"
    assert "Confirmed payload hash does not match" in exc_info.value.message

    # Tampering marks approval REJECTED and invalidates token
    stored = await engine.get_approval("tenant_finance", approval.approval_id)
    assert stored is not None
    assert stored.status == ApprovalStatus.REJECTED
    assert stored.single_use_token_hash == ""


@pytest.mark.asyncio
async def test_approval_atomic_single_use_and_replay_blocking() -> None:
    engine = ApprovalEngine()
    payload = {"item": "Steel Beams", "quantity": 100}
    approval, raw_token = await engine.request_approval(
        run_id="run_replay",
        tenant_id="tenant_const",
        initiating_actor_id="engineer_ed",
        action_name="order_materials",
        summary="Order construction materials",
        proposed_payload=payload,
    )

    # 1. First approval succeeds
    approved = await engine.approve(
        tenant_id="tenant_const",
        run_id="run_replay",
        approval_id=approval.approval_id,
        approving_actor_id="supervisor_sam",
        presented_raw_token=raw_token,
        confirmed_payload=payload,
    )
    assert approved.status == ApprovalStatus.APPROVED
    assert approved.approving_actor_id == "supervisor_sam"
    assert approved.single_use_token_hash == ""

    # 2. Second attempt (replay attack) fails atomically
    with pytest.raises(UaapError) as exc_info:
        await engine.approve(
            tenant_id="tenant_const",
            run_id="run_replay",
            approval_id=approval.approval_id,
            approving_actor_id="supervisor_sam",
            presented_raw_token=raw_token,
            confirmed_payload=payload,
        )
    assert exc_info.value.code == "APPROVAL_ALREADY_CONSUMED"


@pytest.mark.asyncio
async def test_approval_expiry_handling() -> None:
    engine = ApprovalEngine()
    payload = {"task": "Urgent Inspection"}
    # TTL of 0 seconds ensures immediate expiration
    approval, raw_token = await engine.request_approval(
        run_id="run_exp",
        tenant_id="tenant_const",
        initiating_actor_id="inspector_ian",
        action_name="certify_site",
        summary="Site certification",
        proposed_payload=payload,
        ttl_seconds=0,
    )

    # Give a tiny sleep so current time is strictly greater than expires_at
    await asyncio.sleep(0.01)

    with pytest.raises(UaapError) as exc_info:
        await engine.approve(
            tenant_id="tenant_const",
            run_id="run_exp",
            approval_id=approval.approval_id,
            approving_actor_id="director_donna",
            presented_raw_token=raw_token,
            confirmed_payload=payload,
        )
    assert exc_info.value.code == "APPROVAL_EXPIRED"

    stored = await engine.get_approval("tenant_const", approval.approval_id)
    assert stored is not None
    assert stored.status == ApprovalStatus.EXPIRED


@pytest.mark.asyncio
async def test_approval_rejection_workflow() -> None:
    engine = ApprovalEngine()
    payload = {"budget_increase": 15000}
    approval, raw_token = await engine.request_approval(
        run_id="run_rej",
        tenant_id="tenant_const",
        initiating_actor_id="pm_paul",
        action_name="increase_budget",
        summary="Increase project budget",
        proposed_payload=payload,
    )

    rejected = await engine.reject(
        tenant_id="tenant_const",
        run_id="run_rej",
        approval_id=approval.approval_id,
        rejecting_actor_id="cfo_cathy",
        reason="Exceeds quarterly capital limits",
    )
    assert rejected.status == ApprovalStatus.REJECTED
    assert rejected.rejection_reason == "Exceeds quarterly capital limits"
    assert rejected.single_use_token_hash == ""

    # Subsequent approval attempt must fail
    with pytest.raises(UaapError) as exc_info:
        await engine.approve(
            tenant_id="tenant_const",
            run_id="run_rej",
            approval_id=approval.approval_id,
            approving_actor_id="cfo_cathy",
            presented_raw_token=raw_token,
            confirmed_payload=payload,
        )
    assert exc_info.value.code in ("APPROVAL_ALREADY_CONSUMED", "VALIDATION")
