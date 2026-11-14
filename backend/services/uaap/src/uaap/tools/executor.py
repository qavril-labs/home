"""The only code path that runs a tool. Each stage either passes or fails with a typed, audited error.

Pipeline (UAAP security spec, section 4):
lookup and tier → agent principal → input schema → effective permission → per-run limit →
idempotency → approval gate → handler with timeout → output schema → audit.
"""

from __future__ import annotations

import asyncio
import threading
import time
from datetime import UTC, datetime
from typing import Any, NoReturn

import jsonschema

from uaap.errors import UaapError
from uaap.obs.audit import AuditEvent, AuditSink
from uaap.runtime.state import ApprovalRequest, ApprovalStatus, compute_payload_hash
from uaap.tools.agents import AgentRegistry
from uaap.tools.idempotency import InMemoryIdempotencyStore
from uaap.tools.permissions import effective_allows
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import APPROVAL_TIER, BLOCKED_TIER, DRAFT_TIER, CallerContext, ToolCall, ToolResult


class ToolExecutor:
    def __init__(
        self,
        registry: ToolRegistry,
        agents: AgentRegistry,
        *,
        idempotency: InMemoryIdempotencyStore | None = None,
        audit_sink: AuditSink | None = None,
        max_calls_per_run: int = 20,
    ) -> None:
        if max_calls_per_run < 1:
            raise UaapError("VALIDATION", "max_calls_per_run must be >= 1")
        self.registry = registry
        self.agents = agents
        self.idempotency = idempotency or InMemoryIdempotencyStore()
        self._audit_sink = audit_sink
        self._max_calls_per_run = max_calls_per_run
        self._run_calls: dict[tuple[str, str], int] = {}
        self._executed_approvals: set[tuple[str, str]] = set()
        self._lock = threading.Lock()

    def tier_of(self, tenant_id: str, tool_name: str) -> int:
        return self.registry.effective_tier(tenant_id, tool_name)

    async def execute(
        self,
        ctx: CallerContext,
        call: ToolCall,
        *,
        approval: ApprovalRequest | None = None,
    ) -> ToolResult:
        name = call.tool_name
        payload_hash = call.payload_hash
        tier = self.registry.effective_tier(ctx.tenant_id, name)
        approval_id = approval.approval_id if approval else None

        def fail(code: str, message: str, details: dict[str, Any] | None = None) -> NoReturn:
            self._audit(ctx, name, tier, code.lower(), code, payload_hash, approval_id)
            raise UaapError(code, message, {"tool_name": name, **(details or {})})

        # 1. Lookup and tier. Unknown and Tier 5 tools never run.
        tool = self.registry.get(name)
        if tool is None or tier == BLOCKED_TIER or tool.handler is None:
            fail("TOOL_BLOCKED", f"Tool '{name}' is blocked or not registered", {"tier": BLOCKED_TIER})
        definition = tool.definition
        handler = tool.handler

        # 2. Agent principal and allow-list.
        if not ctx.agent_id:
            fail("FORBIDDEN", "Tool calls must be made by a registered agent")
        agent = self.agents.get(ctx.agent_id)
        if agent is None or not agent.enabled:
            fail("FORBIDDEN", "Agent is not registered or is disabled", {"agent_id": ctx.agent_id})
        if name not in agent.tools:
            fail("FORBIDDEN", f"Agent is not allowed to use tool '{name}'", {"agent_id": ctx.agent_id})

        # 3. Input contract.
        try:
            jsonschema.validate(instance=call.arguments, schema=definition.input_schema)
        except jsonschema.ValidationError as exc:
            fail("VALIDATION", f"Invalid arguments: {exc.message}", {"path": [str(p) for p in exc.path]})

        # 4. Effective permission = agent grants ∩ user permissions.
        if not effective_allows(agent.grants, ctx.permissions, definition.permission):
            fail(
                "FORBIDDEN",
                f"Missing permission {definition.permission}",
                {"permission": definition.permission},
            )

        # 5. Per-run tool-call budget.
        if ctx.run_id:
            with self._lock:
                key = (ctx.tenant_id, ctx.run_id)
                used = self._run_calls.get(key, 0)
                if used >= self._max_calls_per_run:
                    over = True
                else:
                    self._run_calls[key] = used + 1
                    over = False
            if over:
                fail(
                    "QUOTA_EXCEEDED",
                    "Tool-call limit for this run reached",
                    {"limit": self._max_calls_per_run},
                )

        # 6. Idempotent replay.
        arguments_hash = compute_payload_hash(call.arguments)
        if call.idempotency_key:
            try:
                previous = await asyncio.to_thread(
                    self.idempotency.lookup, ctx.tenant_id, name, call.idempotency_key, arguments_hash
                )
            except UaapError as exc:
                fail(exc.code, exc.message)
            if previous is not None:
                self._audit(ctx, name, tier, "replayed", None, payload_hash, approval_id)
                return ToolResult(
                    tool_name=previous.tool_name,
                    tier=previous.tier,
                    output=previous.output,
                    is_ai_draft=previous.is_ai_draft,
                    replayed=True,
                )

        # 7. Approval gate for Tier 3.
        if tier == APPROVAL_TIER:
            if approval is None:
                self._audit(ctx, name, tier, "approval_required", "APPROVAL_REQUIRED", payload_hash, None)
                raise UaapError(
                    "APPROVAL_REQUIRED",
                    f"Tool '{name}' requires human approval",
                    {"tool_name": name, "tier": tier, "payload_hash": payload_hash},
                )
            self._check_approval(ctx, call, approval, fail)

        # 8. Handler with timeout. Failures are reported, never replaced with a fabricated result.
        started = time.monotonic()
        try:
            output = await asyncio.wait_for(handler(ctx, call.arguments), timeout=definition.timeout_seconds)
        except TimeoutError:
            fail("UPSTREAM_TIMEOUT", f"Tool '{name}' timed out")
        except UaapError as exc:
            fail(exc.code, exc.message, exc.details)
        except Exception as exc:
            fail("UPSTREAM_FAILED", f"Tool '{name}' failed", {"error_class": type(exc).__name__})
        latency_ms = int((time.monotonic() - started) * 1000)

        # 9. Output contract.
        if not isinstance(output, dict):
            fail("UPSTREAM_INVALID_RESPONSE", "Tool returned a non-object result")
        if definition.output_schema is not None:
            try:
                jsonschema.validate(instance=output, schema=definition.output_schema)
            except jsonschema.ValidationError as exc:
                fail("UPSTREAM_INVALID_RESPONSE", f"Tool output failed its contract: {exc.message}")

        result = ToolResult(tool_name=name, tier=tier, output=output, is_ai_draft=tier == DRAFT_TIER)
        if call.idempotency_key:
            await asyncio.to_thread(
                self.idempotency.store, ctx.tenant_id, name, call.idempotency_key, arguments_hash, result
            )
        self._audit(ctx, name, tier, "success", None, payload_hash, approval_id, latency_ms)
        return result

    def _check_approval(
        self,
        ctx: CallerContext,
        call: ToolCall,
        approval: ApprovalRequest,
        fail: Any,
    ) -> None:
        if approval.tenant_id != ctx.tenant_id:
            fail("FORBIDDEN", "Approval belongs to another tenant")
        if ctx.run_id and approval.run_id != ctx.run_id:
            fail("FORBIDDEN", "Approval belongs to another run")
        if approval.status != ApprovalStatus.APPROVED:
            fail("FORBIDDEN", "Approval has not been granted", {"status": approval.status.value})
        if approval.action_name != call.tool_name or approval.payload_hash != call.payload_hash:
            fail("FORBIDDEN", "Approval does not match this tool call")
        # The approved call runs under the approver's own credentials (UAAP never keeps the
        # initiator's token), so the approver must be the caller here.
        if approval.approving_actor_id != ctx.actor_id:
            fail("FORBIDDEN", "Approved calls must be executed by the approver")
        with self._lock:
            key = (ctx.tenant_id, approval.approval_id)
            already = key in self._executed_approvals
            self._executed_approvals.add(key)
        if already:
            fail("APPROVAL_ALREADY_CONSUMED", "Approval has already been used to execute this call")

    def _audit(
        self,
        ctx: CallerContext,
        tool_name: str,
        tier: int,
        outcome: str,
        error_code: str | None,
        payload_hash: str,
        approval_id: str | None,
        latency_ms: int | None = None,
    ) -> None:
        if self._audit_sink is None:
            return
        self._audit_sink.emit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=ctx.request_id,
                tenant_id=ctx.tenant_id,
                actor_id=ctx.actor_id,
                action="tool.call",
                outcome=outcome,
                error_code=error_code,
                agent_id=ctx.agent_id,
                run_id=ctx.run_id,
                tool_name=tool_name,
                tier=tier,
                payload_hash=payload_hash,
                approval_id=approval_id,
                latency_ms=latency_ms,
            )
        )
