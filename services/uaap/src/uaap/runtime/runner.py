"""Agent runtime runner orchestrating LangGraph executions, memory, checkpointer, and approval workflows."""

from __future__ import annotations

import asyncio
import dataclasses
import uuid
from datetime import UTC, datetime
from typing import Any

from uaap.errors import UaapError
from uaap.gateway.metering import InMemoryMeteringService
from uaap.gateway.types import Message
from uaap.obs.audit import AuditEvent, AuditSink
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.adapter import LangGraphCheckpointSaverAdapter
from uaap.runtime.checkpointer.base import CheckpointStore
from uaap.runtime.graph import RuntimeGraphState, ToolDispatch, build_runtime_graph
from uaap.runtime.memory.working import SessionWorkingMemory
from uaap.runtime.state import (
    AgentState,
    AgentStatus,
    ApprovalRequest,
    validate_state_transition,
)
from uaap.tools.executor import ToolExecutor
from uaap.tools.types import CallerContext, ToolCall, ToolResult


def _record_tool_result(working_context: dict[str, Any], result: ToolResult) -> dict[str, Any]:
    ctx = dict(working_context)
    results = list(ctx.get("tool_results", []))
    results.append(
        {
            "tool_name": result.tool_name,
            "tier": result.tier,
            "output": result.output,
            "is_ai_draft": result.is_ai_draft,
            "replayed": result.replayed,
        }
    )
    ctx["tool_results"] = results
    return ctx


class AgentRunner:
    """Orchestrates agent state machines, LangGraph execution, checkpointing, and HITL approvals."""

    def __init__(
        self,
        checkpoint_store: CheckpointStore,
        approval_engine: ApprovalEngine,
        metering_service: InMemoryMeteringService | None = None,
        audit_sink: AuditSink | None = None,
        tool_executor: ToolExecutor | None = None,
        approval_ttl_seconds: int = 300,
    ) -> None:
        self.store = checkpoint_store
        self.approval = approval_engine
        self.metering = metering_service
        self.audit = audit_sink
        self.tools = tool_executor
        self.approval_ttl_seconds = approval_ttl_seconds
        self._working_memories: dict[tuple[str, str], SessionWorkingMemory] = {}
        self._lock = asyncio.Lock()
        self._graph_definition = build_runtime_graph()

    def _run_caller(
        self, caller: CallerContext | None, tenant_id: str, run_id: str, agent_id: str | None
    ) -> CallerContext | None:
        """Bind the trusted caller to this run. The agent comes from the run, never from the caller."""
        if caller is None:
            return None
        if caller.tenant_id != tenant_id:
            raise UaapError("FORBIDDEN", "Caller does not belong to the run's tenant")
        return dataclasses.replace(caller, agent_id=agent_id, run_id=run_id)

    def _tool_dispatch(self, caller: CallerContext | None) -> ToolDispatch | None:
        executor = self.tools
        if executor is None or caller is None:
            return None

        async def dispatch(state: RuntimeGraphState, step_count: int) -> dict[str, Any]:
            call = ToolCall.from_payload(state.get("pending_action") or {})
            try:
                result = await executor.execute(caller, call)
            except UaapError as exc:
                if exc.code == "APPROVAL_REQUIRED":
                    return {"step_count": step_count, "status": AgentStatus.AWAITING_APPROVAL.value}
                return {
                    "step_count": step_count,
                    "status": AgentStatus.FAILED.value,
                    "error": f"{exc.code}: {exc.message}",
                    "pending_action": None,
                }
            return {
                "step_count": step_count,
                "status": AgentStatus.COMPLETED.value,
                "working_context": _record_tool_result(state.get("working_context", {}), result),
                "pending_action": None,
            }

        return dispatch

    def _emit_audit(self, event: AuditEvent) -> None:
        if self.audit is not None:
            self.audit.emit(event)

    @staticmethod
    def _extract_state(record_state: dict[str, Any]) -> dict[str, Any]:
        if "channel_values" in record_state and isinstance(record_state["channel_values"], dict):
            return record_state["channel_values"]
        return record_state

    def _get_working_memory(self, tenant_id: str, run_id: str) -> SessionWorkingMemory:
        key = (tenant_id, run_id)
        if key not in self._working_memories:
            self._working_memories[key] = SessionWorkingMemory(tenant_id, run_id)
        return self._working_memories[key]

    async def create_run(
        self,
        *,
        tenant_id: str,
        actor_id: str,
        messages: tuple[Message, ...],
        max_steps: int = 25,
        pending_action: dict[str, Any] | None = None,
        agent_id: str | None = None,
    ) -> AgentState:
        if not tenant_id or not actor_id:
            raise UaapError("VALIDATION", "tenant_id and actor_id are required")
        if pending_action and "tool_name" in pending_action:
            # The tier always comes from the registry; a client-supplied tier is never trusted.
            pending_action = {
                "tool_name": pending_action["tool_name"],
                "arguments": pending_action.get("arguments") or {},
                "idempotency_key": pending_action.get("idempotency_key"),
                "summary": pending_action.get("summary"),
            }

        # Metering limit check
        if self.metering is not None:
            self.metering.check_limits(tenant_id, requests_per_minute=60, daily_token_budget=1_000_000)

        run_id = f"run_{uuid.uuid4().hex[:12]}"
        now = datetime.now(UTC)

        state = AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=actor_id,
            step_count=0,
            max_steps=max_steps,
            status=AgentStatus.PENDING,
            messages=messages,
            working_context={"pending_action": pending_action} if pending_action else {},
            agent_id=agent_id,
        )

        # Store initial checkpoint record
        checkpoint_dict: dict[str, Any] = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "actor_id": actor_id,
            "step_count": 0,
            "max_steps": max_steps,
            "status": AgentStatus.PENDING.value,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "working_context": state.working_context,
            "pending_action": pending_action,
            "agent_id": agent_id,
        }
        await self.store.put(tenant_id, run_id, "init", checkpoint_dict, {"source": "create_run"})

        self._emit_audit(
            AuditEvent(
                at=now,
                request_id=run_id,
                tenant_id=tenant_id,
                actor_id=actor_id,
                action="run.created",
                outcome="success",
            )
        )

        return state

    async def start_run(
        self,
        *,
        tenant_id: str,
        run_id: str,
        caller: CallerContext | None = None,
    ) -> tuple[AgentState, str | None]:
        """Start run execution. Returns (AgentState, raw_approval_token_if_awaiting_approval).

        `caller` is the trusted initiator (resolved from the product), needed for tool calls.
        """
        record = await self.store.get(tenant_id, run_id)
        if record is None:
            raise UaapError("NOT_FOUND", "Run not found for tenant", {"run_id": run_id})

        st = self._extract_state(record.state)
        current_status = AgentStatus(st["status"])
        validate_state_transition(current_status, AgentStatus.RUNNING)
        agent_id: str | None = st.get("agent_id")
        if caller is not None and caller.actor_id != st["actor_id"]:
            raise UaapError("FORBIDDEN", "Only the run's initiator can start it")
        run_caller = self._run_caller(caller, tenant_id, run_id, agent_id)

        # Create LangGraph saver adapter configured with trusted server-side tenant
        adapter = LangGraphCheckpointSaverAdapter(self.store, trusted_tenant_id=tenant_id)
        dispatch = self._tool_dispatch(run_caller)
        graph = self._graph_definition if dispatch is None else build_runtime_graph(dispatch)
        compiled_app = graph.compile(checkpointer=adapter)

        thread_id = f"{tenant_id}:{run_id}"
        config = {"configurable": {"thread_id": thread_id}}

        initial_graph_state: RuntimeGraphState = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "actor_id": st["actor_id"],
            "agent_id": agent_id,
            "step_count": st.get("step_count", 0),
            "max_steps": st.get("max_steps", 25),
            "status": AgentStatus.RUNNING.value,
            "messages": st.get("messages", []),
            "working_context": st.get("working_context", {}),
            "pending_action": st.get("pending_action"),
        }

        now = datetime.now(UTC)
        self._emit_audit(
            AuditEvent(
                at=now,
                request_id=run_id,
                tenant_id=tenant_id,
                actor_id=st["actor_id"],
                action="run.started",
                outcome="running",
            )
        )

        # Execute StateGraph
        output_state = await compiled_app.ainvoke(initial_graph_state, config=config)  # type: ignore[call-overload]

        final_status = AgentStatus(output_state["status"])
        pending_approval: ApprovalRequest | None = None
        raw_token: str | None = None

        # Check if run suspended in AWAITING_APPROVAL
        if final_status == AgentStatus.AWAITING_APPROVAL:
            pending_action = output_state.get("pending_action") or st.get("pending_action", {})
            if "tool_name" in pending_action:
                # Bind the approval to the exact tool call: name, arguments and idempotency key.
                tool_call = ToolCall.from_payload(pending_action)
                action_name = tool_call.tool_name
                proposed_payload = tool_call.approval_payload()
                summary = pending_action.get("summary") or f"Approval required for {action_name}"
            else:
                action_name = pending_action.get("action_name", "tier_3_action")
                proposed_payload = pending_action.get("payload", {})
                summary = pending_action.get("summary", f"Approval required for {action_name}")

            pending_approval, raw_token = await self.approval.request_approval(
                run_id=run_id,
                tenant_id=tenant_id,
                initiating_actor_id=st["actor_id"],
                action_name=action_name,
                summary=summary,
                proposed_payload=proposed_payload,
                risk_tier=3,
                ttl_seconds=self.approval_ttl_seconds,
            )

        messages_tuple = tuple(
            Message(role=m["role"], content=m["content"]) for m in output_state.get("messages", [])
        )

        updated_state = AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=st["actor_id"],
            step_count=output_state.get("step_count", 1),
            max_steps=output_state.get("max_steps", 25),
            status=final_status,
            messages=messages_tuple,
            working_context=output_state.get("working_context", {}),
            pending_approval=pending_approval,
            error=output_state.get("error"),
            agent_id=agent_id,
        )

        # Persist updated status to checkpoint store
        checkpoint_dict: dict[str, Any] = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "actor_id": st["actor_id"],
            "step_count": output_state.get("step_count", 1),
            "max_steps": output_state.get("max_steps", 25),
            "status": final_status.value,
            "messages": output_state.get("messages", []),
            "working_context": output_state.get("working_context", {}),
            "pending_action": (
                output_state.get("pending_action") or st.get("pending_action")
                if final_status == AgentStatus.AWAITING_APPROVAL
                else output_state.get("pending_action")
            ),
            "pending_approval_id": pending_approval.approval_id if pending_approval else None,
            "error": output_state.get("error"),
            "agent_id": agent_id,
        }
        await self.store.put(
            tenant_id,
            run_id,
            f"chk_{int(datetime.now(UTC).timestamp() * 1000)}",
            checkpoint_dict,
            {"event": "start_run_step"},
        )

        outcome = "success" if final_status == AgentStatus.COMPLETED else final_status.value.lower()
        self._emit_audit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=run_id,
                tenant_id=tenant_id,
                actor_id=st["actor_id"],
                action="run.step",
                outcome=outcome,
            )
        )

        return updated_state, raw_token

    async def resume_after_approval(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approval_id: str,
        approving_actor_id: str,
        presented_raw_token: str,
        confirmed_payload: dict[str, Any],
        approver: CallerContext | None = None,
    ) -> AgentState:
        """Atomically approve and resume suspended StateGraph execution.

        For a tool call, `approver` is the approver's trusted context. The approved call runs once,
        under the approver's credentials, because UAAP never keeps the initiator's token.
        """
        record = await self.store.get(tenant_id, run_id)
        if record is None:
            raise UaapError("NOT_FOUND", "Run not found for tenant", {"run_id": run_id})

        st = self._extract_state(record.state)
        current_status = AgentStatus(st["status"])
        validate_state_transition(current_status, AgentStatus.RUNNING)
        agent_id: str | None = st.get("agent_id")
        pending_action = st.get("pending_action") or {}
        tool_call = ToolCall.from_payload(pending_action) if "tool_name" in pending_action else None
        approver_caller: CallerContext | None = None
        if tool_call is not None:
            # Check everything before the approval token is consumed.
            if self.tools is None:
                raise UaapError("TOOL_BLOCKED", "No tool executor is configured")
            if approver is None or approver.actor_id != approving_actor_id:
                raise UaapError("FORBIDDEN", "The approver's own credentials are required to run the tool")
            approver_caller = self._run_caller(approver, tenant_id, run_id, agent_id)

        # Indivisibly verify and consume token under lock
        approved_req = await self.approval.approve(
            tenant_id=tenant_id,
            run_id=run_id,
            approval_id=approval_id,
            approving_actor_id=approving_actor_id,
            presented_raw_token=presented_raw_token,
            confirmed_payload=confirmed_payload,
        )

        working_ctx = dict(st.get("working_context", {}))
        working_ctx[f"approved_{approved_req.action_name}"] = True
        if tool_call is not None and self.tools is not None and approver_caller is not None:
            try:
                result = await self.tools.execute(approver_caller, tool_call, approval=approved_req)
            except UaapError as exc:
                return await self._fail_run(st, tenant_id, run_id, working_ctx, f"{exc.code}: {exc.message}")
            working_ctx = _record_tool_result(working_ctx, result)
        else:
            working_ctx[f"result_{approved_req.action_name}"] = (
                f"Executed {approved_req.action_name} via mock dispatch"
            )

        # Resume StateGraph execution
        adapter = LangGraphCheckpointSaverAdapter(self.store, trusted_tenant_id=tenant_id)
        compiled_app = self._graph_definition.compile(checkpointer=adapter)

        thread_id = f"{tenant_id}:{run_id}"
        config = {"configurable": {"thread_id": thread_id}}

        resume_graph_state: RuntimeGraphState = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "actor_id": st["actor_id"],
            "agent_id": agent_id,
            "step_count": st.get("step_count", 1),
            "max_steps": st.get("max_steps", 25),
            "status": AgentStatus.RUNNING.value,
            "messages": st.get("messages", []),
            "working_context": working_ctx,
            "pending_action": None,  # Cleared after approval
        }

        output_state = await compiled_app.ainvoke(resume_graph_state, config=config)  # type: ignore[call-overload]
        final_status = AgentStatus(output_state["status"])

        # Persist updated status to checkpoint store
        checkpoint_dict = {
            "run_id": run_id,
            "tenant_id": tenant_id,
            "actor_id": st["actor_id"],
            "step_count": output_state.get("step_count", 2),
            "max_steps": output_state.get("max_steps", 25),
            "status": final_status.value,
            "messages": output_state.get("messages", []),
            "working_context": output_state.get("working_context", {}),
            "pending_action": None,
            "error": output_state.get("error"),
            "agent_id": agent_id,
        }
        await self.store.put(
            tenant_id,
            run_id,
            f"chk_{int(datetime.now(UTC).timestamp() * 1000)}",
            checkpoint_dict,
            {"event": "resume_step"},
        )

        messages_tuple = tuple(
            Message(role=m["role"], content=m["content"]) for m in output_state.get("messages", [])
        )

        return AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=st["actor_id"],
            step_count=output_state.get("step_count", 2),
            max_steps=output_state.get("max_steps", 25),
            status=final_status,
            messages=messages_tuple,
            working_context=output_state.get("working_context", {}),
            pending_approval=None,
            error=output_state.get("error"),
            agent_id=agent_id,
        )

    async def _fail_run(
        self,
        st: dict[str, Any],
        tenant_id: str,
        run_id: str,
        working_ctx: dict[str, Any],
        error: str,
    ) -> AgentState:
        """Persist a FAILED run. Failures are reported as they are, never replaced with a result."""
        new_state = dict(st)
        new_state.update(
            {
                "status": AgentStatus.FAILED.value,
                "error": error,
                "working_context": working_ctx,
                "pending_action": None,
            }
        )
        await self.store.put(
            tenant_id,
            run_id,
            f"fail_{int(datetime.now(UTC).timestamp() * 1000)}",
            new_state,
            {"event": "failed"},
        )
        self._emit_audit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=run_id,
                tenant_id=tenant_id,
                actor_id=st["actor_id"],
                action="run.failed",
                outcome="failed",
                error_code=error.split(":", 1)[0],
            )
        )
        return AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=st["actor_id"],
            step_count=st.get("step_count", 0),
            max_steps=st.get("max_steps", 25),
            status=AgentStatus.FAILED,
            messages=tuple(Message(role=m["role"], content=m["content"]) for m in st.get("messages", [])),
            working_context=working_ctx,
            error=error,
            agent_id=st.get("agent_id"),
        )

    async def reject_run(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approval_id: str,
        rejecting_actor_id: str,
        reason: str = "Rejected by human approver",
    ) -> AgentState:
        """Reject approval and transition run to REJECTED."""
        record = await self.store.get(tenant_id, run_id)
        if record is None:
            raise UaapError("NOT_FOUND", "Run not found for tenant", {"run_id": run_id})

        st = self._extract_state(record.state)
        current_status = AgentStatus(st["status"])
        validate_state_transition(current_status, AgentStatus.REJECTED)

        rejected_approval = await self.approval.reject(
            tenant_id=tenant_id,
            run_id=run_id,
            approval_id=approval_id,
            rejecting_actor_id=rejecting_actor_id,
            reason=reason,
        )

        # Update checkpoint to REJECTED
        new_state = dict(st)
        new_state["status"] = AgentStatus.REJECTED.value
        new_state["error"] = reason

        checkpoint_id = f"rej_{int(datetime.now(UTC).timestamp() * 1000)}"
        await self.store.put(tenant_id, run_id, checkpoint_id, new_state, {"event": "rejected"})

        self._emit_audit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=run_id,
                tenant_id=tenant_id,
                actor_id=rejecting_actor_id,
                action="run.rejected",
                outcome="rejected",
            )
        )

        messages_tuple = tuple(Message(role=m["role"], content=m["content"]) for m in st.get("messages", []))

        return AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=st["actor_id"],
            step_count=st.get("step_count", 1),
            max_steps=st.get("max_steps", 25),
            status=AgentStatus.REJECTED,
            messages=messages_tuple,
            working_context=st.get("working_context", {}),
            pending_approval=rejected_approval,
            error=reason,
        )

    async def cancel_run(
        self,
        *,
        tenant_id: str,
        run_id: str,
        actor_id: str,
        reason: str = "User cancelled",
    ) -> AgentState:
        """Cancel an in-progress or pending run."""
        record = await self.store.get(tenant_id, run_id)
        if record is None:
            raise UaapError("NOT_FOUND", "Run not found for tenant", {"run_id": run_id})

        st = self._extract_state(record.state)
        current_status = AgentStatus(st["status"])
        validate_state_transition(current_status, AgentStatus.CANCELLED)

        new_state = dict(st)
        new_state["status"] = AgentStatus.CANCELLED.value
        new_state["error"] = reason

        checkpoint_id = f"canc_{int(datetime.now(UTC).timestamp() * 1000)}"
        await self.store.put(tenant_id, run_id, checkpoint_id, new_state, {"event": "cancelled"})

        self._emit_audit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=run_id,
                tenant_id=tenant_id,
                actor_id=actor_id,
                action="run.cancelled",
                outcome="cancelled",
            )
        )

        messages_tuple = tuple(Message(role=m["role"], content=m["content"]) for m in st.get("messages", []))

        return AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=actor_id,
            step_count=st.get("step_count", 0),
            max_steps=st.get("max_steps", 25),
            status=AgentStatus.CANCELLED,
            messages=messages_tuple,
            working_context=st.get("working_context", {}),
            error=reason,
        )

    async def get_run(self, tenant_id: str, run_id: str) -> AgentState | None:
        record = await self.store.get(tenant_id, run_id)
        if record is None:
            return None

        st = self._extract_state(record.state)
        messages_tuple = tuple(Message(role=m["role"], content=m["content"]) for m in st.get("messages", []))

        pending_approval: ApprovalRequest | None = None
        pending_appr_id = st.get("pending_approval_id")
        if pending_appr_id:
            pending_approval = await self.approval.get_approval(tenant_id, pending_appr_id)

        return AgentState(
            run_id=run_id,
            tenant_id=tenant_id,
            actor_id=st["actor_id"],
            step_count=st.get("step_count", 0),
            max_steps=st.get("max_steps", 25),
            status=AgentStatus(st["status"]),
            messages=messages_tuple,
            working_context=st.get("working_context", {}),
            pending_approval=pending_approval,
            error=st.get("error"),
            agent_id=st.get("agent_id"),
        )
