"""Runs that call tools end to end: Tier 1 straight through, Tier 3 through dual-control approval."""

from __future__ import annotations

import pytest

from uaap.errors import UaapError
from uaap.gateway.types import Message
from uaap.obs.audit import InMemoryAuditSink
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner
from uaap.runtime.state import AgentStatus
from uaap.tools.types import ToolCall

from ..tools.fakes import (
    ACCOUNTANT_TOKEN,
    COMPANY,
    CONTROLLER_TOKEN,
    ENTRY_ARGS,
    OTHER_TENANT_TOKEN,
    TENANT,
    FakeCoreSaas,
    build_stack,
    caller,
)

MSG = (Message(role="user", content="Post the November accrual"),)


def _runner(fake: FakeCoreSaas) -> tuple[AgentRunner, InMemoryAuditSink]:
    audit = InMemoryAuditSink()
    executor, _ = build_stack(fake, audit)
    runner = AgentRunner(
        InMemoryCheckpointStore(), ApprovalEngine(audit_sink=audit), audit_sink=audit, tool_executor=executor
    )
    return runner, audit


async def test_tier_1_tool_run_completes_with_result() -> None:
    fake = FakeCoreSaas()
    runner, _ = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={
            "tool_name": "ledger_get_trial_balance",
            "arguments": {"companyId": COMPANY, "asOf": "2026-11-30"},
        },
    )
    state, token = await runner.start_run(
        tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN)
    )

    assert state.status == AgentStatus.COMPLETED, state.error
    assert token is None
    results = state.working_context["tool_results"]
    assert results[0]["tool_name"] == "ledger_get_trial_balance"
    assert results[0]["output"]["baseCurrency"] == "USD"
    assert state.agent_id == "finance-agent"


async def test_client_supplied_tier_is_ignored() -> None:
    fake = FakeCoreSaas()
    runner, _ = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={"tool_name": "ledger_post_journal_entry", "arguments": ENTRY_ARGS, "risk_tier": 1},
    )
    state, token = await runner.start_run(
        tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN)
    )
    assert state.status == AgentStatus.AWAITING_APPROVAL
    assert token is not None
    assert fake.requests == []


async def test_tier_3_tool_runs_after_dual_control_approval() -> None:
    fake = FakeCoreSaas()
    runner, audit = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={
            "tool_name": "ledger_post_journal_entry",
            "arguments": ENTRY_ARGS,
            "summary": "Accrual",
        },
    )
    state, token = await runner.start_run(
        tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN)
    )
    assert state.status == AgentStatus.AWAITING_APPROVAL
    assert state.pending_approval is not None and token is not None
    approval = state.pending_approval
    assert approval.action_name == "ledger_post_journal_entry"
    assert approval.payload_hash == ToolCall("ledger_post_journal_entry", ENTRY_ARGS).payload_hash
    assert fake.requests == []

    done = await runner.resume_after_approval(
        tenant_id=TENANT,
        run_id=run.run_id,
        approval_id=approval.approval_id,
        approving_actor_id="user-controller",
        presented_raw_token=token,
        confirmed_payload=approval.proposed_payload,
        approver=caller(CONTROLLER_TOKEN),
    )

    assert done.status == AgentStatus.COMPLETED, done.error
    assert done.working_context["tool_results"][0]["output"]["reference"] == "AGT-0001"
    assert len(fake.requests) == 1
    assert fake.requests[0].headers["authorization"] == f"Bearer {CONTROLLER_TOKEN}"
    tool_events = [e for e in audit.events if e.action == "tool.call"]
    assert [e.outcome for e in tool_events] == ["approval_required", "success"]
    assert tool_events[-1].approval_id == approval.approval_id
    # Tokens never land in checkpoints.
    record = await runner.store.get(TENANT, run.run_id)
    assert record is not None
    assert ACCOUNTANT_TOKEN not in repr(record.state) and CONTROLLER_TOKEN not in repr(record.state)


async def test_resume_without_approver_credentials_keeps_token_unspent() -> None:
    fake = FakeCoreSaas()
    runner, _ = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={"tool_name": "ledger_post_journal_entry", "arguments": ENTRY_ARGS},
    )
    state, token = await runner.start_run(
        tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN)
    )
    assert state.pending_approval is not None and token is not None
    kwargs = {
        "tenant_id": TENANT,
        "run_id": run.run_id,
        "approval_id": state.pending_approval.approval_id,
        "approving_actor_id": "user-controller",
        "presented_raw_token": token,
        "confirmed_payload": state.pending_approval.proposed_payload,
    }
    with pytest.raises(UaapError) as exc:
        await runner.resume_after_approval(**kwargs)  # type: ignore[arg-type]
    assert exc.value.code == "FORBIDDEN"
    # The approval is still usable once the approver's credentials are supplied.
    done = await runner.resume_after_approval(**kwargs, approver=caller(CONTROLLER_TOKEN))  # type: ignore[arg-type]
    assert done.status == AgentStatus.COMPLETED


async def test_initiator_cannot_approve_own_tool_call() -> None:
    fake = FakeCoreSaas()
    runner, _ = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={"tool_name": "ledger_post_journal_entry", "arguments": ENTRY_ARGS},
    )
    state, token = await runner.start_run(
        tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN)
    )
    assert state.pending_approval is not None and token is not None
    with pytest.raises(UaapError) as exc:
        await runner.resume_after_approval(
            tenant_id=TENANT,
            run_id=run.run_id,
            approval_id=state.pending_approval.approval_id,
            approving_actor_id="user-accountant",
            presented_raw_token=token,
            confirmed_payload=state.pending_approval.proposed_payload,
            approver=caller(ACCOUNTANT_TOKEN),
        )
    assert exc.value.code == "FORBIDDEN"
    assert fake.requests == []


async def test_failed_tool_fails_the_run_without_fabricated_result() -> None:
    fake = FakeCoreSaas()
    fake.fail_with = 500
    runner, _ = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={
            "tool_name": "ledger_get_trial_balance",
            "arguments": {"companyId": COMPANY, "asOf": "2026-11-30"},
        },
    )
    state, _ = await runner.start_run(tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN))
    assert state.status == AgentStatus.FAILED
    assert state.error is not None and state.error.startswith("UPSTREAM_FAILED")
    assert "tool_results" not in state.working_context


async def test_tool_run_without_caller_or_agent_fails_closed() -> None:
    fake = FakeCoreSaas()
    runner, _ = _runner(fake)
    action = {
        "tool_name": "ledger_get_trial_balance",
        "arguments": {"companyId": COMPANY, "asOf": "2026-11-30"},
    }

    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action=action,
    )
    state, _ = await runner.start_run(tenant_id=TENANT, run_id=run.run_id)
    assert state.status == AgentStatus.FAILED and state.error is not None and "TOOL_BLOCKED" in state.error

    run = await runner.create_run(
        tenant_id=TENANT, actor_id="user-accountant", messages=MSG, pending_action=action
    )
    state, _ = await runner.start_run(tenant_id=TENANT, run_id=run.run_id, caller=caller(ACCOUNTANT_TOKEN))
    assert (
        state.status == AgentStatus.FAILED and state.error is not None and state.error.startswith("FORBIDDEN")
    )
    assert fake.requests == []


async def test_caller_from_another_tenant_or_user_is_refused() -> None:
    fake = FakeCoreSaas()
    runner, _ = _runner(fake)
    run = await runner.create_run(
        tenant_id=TENANT,
        actor_id="user-accountant",
        messages=MSG,
        agent_id="finance-agent",
        pending_action={
            "tool_name": "ledger_get_trial_balance",
            "arguments": {"companyId": COMPANY, "asOf": "2026-11-30"},
        },
    )
    with pytest.raises(UaapError) as exc:
        await runner.start_run(tenant_id=TENANT, run_id=run.run_id, caller=caller(CONTROLLER_TOKEN))
    assert exc.value.code == "FORBIDDEN"
    other = caller(OTHER_TENANT_TOKEN)
    other = type(other)(**{**other.__dict__, "actor_id": "user-accountant"})
    with pytest.raises(UaapError) as exc:
        await runner.start_run(tenant_id=TENANT, run_id=run.run_id, caller=other)
    assert exc.value.code == "FORBIDDEN"
