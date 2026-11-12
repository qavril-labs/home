"""The execution pipeline: every refusal is typed and audited, and Tier 3 needs a bound approval."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from uaap.errors import UaapError
from uaap.obs.audit import InMemoryAuditSink
from uaap.runtime.state import ApprovalRequest, ApprovalStatus
from uaap.tools.agents import AgentPrincipal, AgentRegistry
from uaap.tools.executor import ToolExecutor
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext, ToolCall, ToolDefinition

from .fakes import (
    COMPANY,
    CONTROLLER_TOKEN,
    ENTRY_ARGS,
    VIEWER_TOKEN,
    FakeCoreSaas,
    build_stack,
    caller,
)

TB_ARGS = {"companyId": COMPANY, "asOf": "2026-11-30"}


def _approved(call: ToolCall, *, approver: str = "user-controller", **overrides: Any) -> ApprovalRequest:
    now = datetime.now(UTC)
    values: dict[str, Any] = {
        "approval_id": "appr_test",
        "run_id": "run_1",
        "tenant_id": caller().tenant_id,
        "initiating_actor_id": "user-accountant",
        "action_name": call.tool_name,
        "risk_tier": 3,
        "summary": "Post entry",
        "proposed_payload": call.approval_payload(),
        "payload_hash": call.payload_hash,
        "single_use_token_hash": "",
        "created_at": now,
        "expires_at": now + timedelta(minutes=5),
        "status": ApprovalStatus.APPROVED,
        "approving_actor_id": approver,
    }
    values.update(overrides)
    return ApprovalRequest(**values)


async def test_tier_1_read_runs_and_is_audited() -> None:
    fake = FakeCoreSaas()
    audit = InMemoryAuditSink()
    executor, _ = build_stack(fake, audit)

    result = await executor.execute(caller(), ToolCall("ledger_get_trial_balance", TB_ARGS))

    assert result.tier == 1
    assert result.output["totalDebit"] == {"amount": "10.00", "currency": "USD"}
    sent = fake.requests[-1]
    assert sent.headers["x-acting-agent"] == "finance-agent"
    assert sent.headers["x-request-id"] == "req_test"
    event = audit.events[-1]
    assert (event.action, event.outcome, event.tool_name, event.tier) == (
        "tool.call",
        "success",
        "ledger_get_trial_balance",
        1,
    )
    assert event.agent_id == "finance-agent"
    # Arguments and tokens never reach the audit trail.
    assert COMPANY not in repr(event)
    assert "accountant" not in (event.payload_hash or "")


@pytest.mark.parametrize("name", ["sql_execute_raw", "ledger_delete_entry", "made_up_tool"])
async def test_blocked_and_unknown_tools_never_run(name: str) -> None:
    fake = FakeCoreSaas()
    audit = InMemoryAuditSink()
    executor, _ = build_stack(fake, audit)

    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall(name, {"sql": "drop table ledger_entries"}))

    assert exc.value.code == "TOOL_BLOCKED"
    assert fake.requests == []
    assert audit.events[-1].outcome == "tool_blocked"
    assert audit.events[-1].tier == 5


async def test_calls_without_an_enabled_agent_are_refused() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(agent_id=None), ToolCall("ledger_get_trial_balance", TB_ARGS))
    assert exc.value.code == "FORBIDDEN"

    executor.agents.disable("finance-agent")
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall("ledger_get_trial_balance", TB_ARGS))
    assert exc.value.code == "FORBIDDEN"
    assert fake.requests == []


async def test_tool_outside_agent_allow_list_is_refused() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    with pytest.raises(UaapError) as exc:
        await executor.execute(
            caller(),
            ToolCall(
                "ledger_create_account", {"companyId": COMPANY, "code": "1", "name": "X", "type": "ASSET"}
            ),
        )
    assert exc.value.code == "FORBIDDEN"
    assert "not allowed" in exc.value.message


@pytest.mark.parametrize(
    "args",
    [
        {"companyId": "not-a-uuid", "asOf": "2026-11-30"},
        {"companyId": COMPANY},
        {"companyId": COMPANY, "asOf": "30/11/2026"},
        {**TB_ARGS, "extra": "field"},
    ],
)
async def test_input_schema_rejects_bad_arguments(args: dict[str, Any]) -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall("ledger_get_trial_balance", args))
    assert exc.value.code == "VALIDATION"
    assert fake.requests == []


@pytest.mark.parametrize("amount", ["0", "0.00", "-5.00", "1e3", "12.345678"])
async def test_amounts_must_be_positive_decimal_strings(amount: str) -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    args = {**ENTRY_ARGS, "lines": [{"account": "1000", "side": "DEBIT", "amount": amount}] * 2}
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall("ledger_post_journal_entry", args))
    assert exc.value.code == "VALIDATION"


async def test_numeric_amounts_are_rejected() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    args = {**ENTRY_ARGS, "lines": [{"account": "1000", "side": "DEBIT", "amount": 125.5}] * 2}
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall("ledger_post_journal_entry", args))
    assert exc.value.code == "VALIDATION"


async def test_user_without_permission_cannot_use_agent_grant() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(VIEWER_TOKEN), ToolCall("ledger_post_journal_entry", ENTRY_ARGS))
    assert exc.value.code == "FORBIDDEN"
    assert exc.value.details["permission"] == "fin.journal.post"


async def test_admin_user_does_not_widen_agent_grants() -> None:
    registry = ToolRegistry()
    fake = FakeCoreSaas()
    _, adapter = build_stack(fake)
    from uaap.tools.adapters.core_saas import register_core_saas_tools

    register_core_saas_tools(registry, adapter)
    agents = AgentRegistry()
    agents.register(
        AgentPrincipal(
            "reader-agent", "Reader", frozenset({"fin.report.read"}), frozenset({"ledger_post_journal_entry"})
        )
    )
    executor = ToolExecutor(registry, agents)
    ctx = caller("0193a000-0000-7000-8000-000000000001.admin", agent_id="reader-agent")
    with pytest.raises(UaapError) as exc:
        await executor.execute(ctx, ToolCall("ledger_post_journal_entry", ENTRY_ARGS))
    assert exc.value.code == "FORBIDDEN"


async def test_tier_3_requires_approval_and_does_not_call_product() -> None:
    fake = FakeCoreSaas()
    audit = InMemoryAuditSink()
    executor, _ = build_stack(fake, audit)
    call = ToolCall("ledger_post_journal_entry", ENTRY_ARGS)

    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), call)

    assert exc.value.code == "APPROVAL_REQUIRED"
    assert exc.value.details["payload_hash"] == call.payload_hash
    assert fake.requests == []
    assert audit.events[-1].outcome == "approval_required"


async def test_approved_tier_3_runs_once_under_approver() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    call = ToolCall("ledger_post_journal_entry", ENTRY_ARGS)
    approval = _approved(call)
    approver = caller(CONTROLLER_TOKEN, run_id="run_1")

    result = await executor.execute(approver, call, approval=approval)

    assert result.output["reference"] == "AGT-0001"
    assert fake.requests[-1].headers["authorization"] == f"Bearer {CONTROLLER_TOKEN}"
    with pytest.raises(UaapError) as exc:
        await executor.execute(approver, call, approval=approval)
    assert exc.value.code == "APPROVAL_ALREADY_CONSUMED"
    assert len(fake.requests) == 1


async def test_approval_must_match_the_exact_call() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    approved_call = ToolCall("ledger_post_journal_entry", ENTRY_ARGS)
    approval = _approved(approved_call)
    tampered = ToolCall(
        "ledger_post_journal_entry",
        {
            **ENTRY_ARGS,
            "lines": [{"account": "1000", "side": "DEBIT", "amount": "999999.00"}, ENTRY_ARGS["lines"][1]],
        },
    )
    approver = caller(CONTROLLER_TOKEN, run_id="run_1")

    with pytest.raises(UaapError) as exc:
        await executor.execute(approver, tampered, approval=approval)
    assert exc.value.code == "FORBIDDEN"

    other_tool = ToolCall(
        "ledger_reverse_journal_entry",
        {"companyId": COMPANY, "entryId": COMPANY, "reference": "R", "date": "2026-11-09"},
    )
    with pytest.raises(UaapError):
        await executor.execute(approver, other_tool, approval=approval)
    assert fake.requests == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": ApprovalStatus.PENDING},
        {"status": ApprovalStatus.REJECTED},
        {"tenant_id": "0193a000-0000-7000-8000-000000000002"},
        {"run_id": "run_other"},
    ],
)
async def test_unusable_approvals_are_refused(overrides: dict[str, Any]) -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    call = ToolCall("ledger_post_journal_entry", ENTRY_ARGS)
    with pytest.raises(UaapError) as exc:
        await executor.execute(
            caller(CONTROLLER_TOKEN, run_id="run_1"), call, approval=_approved(call, **overrides)
        )
    assert exc.value.code == "FORBIDDEN"
    assert fake.requests == []


async def test_approved_call_must_run_as_the_approver() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    call = ToolCall("ledger_post_journal_entry", ENTRY_ARGS)
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(run_id="run_1"), call, approval=_approved(call))
    assert exc.value.code == "FORBIDDEN"


async def test_tenant_raised_tier_requires_approval_for_reads() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    executor.registry.set_tenant_tier(caller().tenant_id, "ledger_get_trial_balance", 3)
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall("ledger_get_trial_balance", TB_ARGS))
    assert exc.value.code == "APPROVAL_REQUIRED"


async def test_idempotent_replay_and_key_reuse() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake)
    call = ToolCall("ledger_get_trial_balance", TB_ARGS, idempotency_key="k1")

    first = await executor.execute(caller(), call)
    second = await executor.execute(caller(), call)

    assert not first.replayed and second.replayed
    assert second.output == first.output
    assert len(fake.requests) == 1
    with pytest.raises(UaapError) as exc:
        await executor.execute(
            caller(), ToolCall("ledger_get_trial_balance", {**TB_ARGS, "asOf": "2026-12-31"}, "k1")
        )
    assert exc.value.code == "IDEMPOTENCY_CONFLICT"


async def test_per_run_tool_call_limit() -> None:
    fake = FakeCoreSaas()
    executor, _ = build_stack(fake, max_calls_per_run=2)
    ctx = caller(run_id="run_limit")
    await executor.execute(ctx, ToolCall("ledger_get_trial_balance", TB_ARGS))
    await executor.execute(ctx, ToolCall("ledger_get_trial_balance", TB_ARGS))
    with pytest.raises(UaapError) as exc:
        await executor.execute(ctx, ToolCall("ledger_get_trial_balance", TB_ARGS))
    assert exc.value.code == "QUOTA_EXCEEDED"
    # Another run has its own budget.
    await executor.execute(caller(run_id="run_other"), ToolCall("ledger_get_trial_balance", TB_ARGS))


async def test_output_contract_violation_is_reported_not_hidden() -> None:
    fake = FakeCoreSaas()
    fake.malformed_output = True
    executor, _ = build_stack(fake)
    with pytest.raises(UaapError) as exc:
        await executor.execute(caller(), ToolCall("ledger_get_trial_balance", TB_ARGS))
    assert exc.value.code == "UPSTREAM_INVALID_RESPONSE"


async def test_handler_timeout_and_crash_are_typed() -> None:
    registry = ToolRegistry()

    async def slow(ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        await asyncio.sleep(1)
        return {}

    async def crash(ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("password=hunter2")

    base: dict[str, Any] = {
        "description": "d",
        "product_id": "demo",
        "tier": 1,
        "permission": "demo.read",
        "input_schema": {"type": "object"},
    }
    registry.register(ToolDefinition(name="demo_slow", timeout_seconds=0.05, **base), slow)
    registry.register(ToolDefinition(name="demo_crash", **base), crash)
    agents = AgentRegistry()
    agents.register(
        AgentPrincipal("demo-agent", "Demo", frozenset({"demo.read"}), frozenset({"demo_slow", "demo_crash"}))
    )
    executor = ToolExecutor(registry, agents)
    ctx = CallerContext(
        tenant_id="t1",
        actor_id="u1",
        permissions=("demo.read",),
        token=caller().token,
        request_id="r",
        agent_id="demo-agent",
    )

    with pytest.raises(UaapError) as exc:
        await executor.execute(ctx, ToolCall("demo_slow"))
    assert exc.value.code == "UPSTREAM_TIMEOUT"
    with pytest.raises(UaapError) as exc:
        await executor.execute(ctx, ToolCall("demo_crash"))
    assert exc.value.code == "UPSTREAM_FAILED"
    assert "hunter2" not in str(exc.value) and "hunter2" not in repr(exc.value.details)


async def test_tier_2_results_are_flagged_as_drafts() -> None:
    registry = ToolRegistry()

    async def draft(ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        return {"text": "Dear customer"}

    registry.register(
        ToolDefinition(
            name="demo_draft",
            description="d",
            product_id="demo",
            tier=2,
            permission="demo.draft",
            input_schema={"type": "object"},
        ),
        draft,
    )
    agents = AgentRegistry()
    agents.register(AgentPrincipal("demo-agent", "Demo", frozenset({"demo.*"}), frozenset({"demo_draft"})))
    ctx = CallerContext(
        tenant_id="t1",
        actor_id="u1",
        permissions=("demo.*",),
        token=caller().token,
        request_id="r",
        agent_id="demo-agent",
    )
    result = await ToolExecutor(registry, agents).execute(ctx, ToolCall("demo_draft"))
    assert result.is_ai_draft
