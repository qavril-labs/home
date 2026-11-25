"""LangGraph StateGraph definition and node execution logic for UAAP Milestone A3."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from uaap.runtime.state import AgentStatus


class RuntimeGraphState(TypedDict, total=False):
    run_id: str
    tenant_id: str
    actor_id: str
    agent_id: str | None
    step_count: int
    max_steps: int
    status: str
    messages: list[dict[str, str]]
    working_context: dict[str, Any]
    pending_action: dict[str, Any] | None
    pending_approval_id: str | None
    error: str | None


def _initialize_node(state: RuntimeGraphState) -> dict[str, Any]:
    return {
        "status": AgentStatus.RUNNING.value,
        "step_count": state.get("step_count", 0),
    }


# Runs a tool call through the A4 executor and returns the graph update. Supplied by the runner,
# which holds the caller's credentials in memory only (they never enter graph state).
ToolDispatch = Callable[[RuntimeGraphState, int], Awaitable[dict[str, Any]]]


def _reason_node(state: RuntimeGraphState) -> dict[str, Any]:
    step_count = state.get("step_count", 0) + 1
    max_steps = state.get("max_steps", 25)

    if step_count > max_steps:
        return {
            "step_count": step_count,
            "status": AgentStatus.FAILED.value,
            "error": f"Execution step limit exceeded (max {max_steps} steps)",
        }

    # Check pending action risk tier
    pending_action = state.get("pending_action")
    if pending_action:
        risk_tier = pending_action.get("risk_tier", 1)

        # Tier 5: Permanently blocked
        if risk_tier == 5:
            return {
                "step_count": step_count,
                "status": AgentStatus.FAILED.value,
                "error": "Action rejected: Tier 5 operations are permanently blocked",
                "pending_action": None,
            }

        # Tier 3: Approval required (interrupt hook)
        if risk_tier == 3:
            return {
                "step_count": step_count,
                "status": AgentStatus.AWAITING_APPROVAL.value,
            }

        # Tier 1, 2, or 4: Safe mock execution
        action_name = pending_action.get("action_name", "action")
        ctx = dict(state.get("working_context", {}))
        ctx[f"result_{action_name}"] = f"Executed {action_name} (Tier {risk_tier})"

        return {
            "step_count": step_count,
            "status": AgentStatus.COMPLETED.value,
            "working_context": ctx,
            "pending_action": None,
        }

    # Default completion if no further actions pending
    messages = list(state.get("messages", []))
    last_msg = messages[-1]["content"] if messages else "start"
    messages.append({"role": "assistant", "content": f"Acknowledged: {last_msg}"})

    return {
        "step_count": step_count,
        "status": AgentStatus.COMPLETED.value,
        "messages": messages,
    }


def _route_after_reason(state: RuntimeGraphState) -> str:
    status = state.get("status", AgentStatus.RUNNING.value)
    if status in (
        AgentStatus.AWAITING_APPROVAL.value,
        AgentStatus.COMPLETED.value,
        AgentStatus.FAILED.value,
        AgentStatus.REJECTED.value,
        AgentStatus.CANCELLED.value,
    ):
        return END
    return "reason"


def _make_reason_node(
    tool_dispatch: ToolDispatch | None,
) -> Callable[[RuntimeGraphState], Awaitable[dict[str, Any]]]:
    async def reason(state: RuntimeGraphState) -> dict[str, Any]:
        pending_action = state.get("pending_action")
        if not pending_action or "tool_name" not in pending_action:
            return _reason_node(state)

        # A4 tool calls: the tier comes from the registry, never from the request.
        step_count = state.get("step_count", 0) + 1
        max_steps = state.get("max_steps", 25)
        if step_count > max_steps:
            return {
                "step_count": step_count,
                "status": AgentStatus.FAILED.value,
                "error": f"Execution step limit exceeded (max {max_steps} steps)",
            }
        if tool_dispatch is None:
            return {
                "step_count": step_count,
                "status": AgentStatus.FAILED.value,
                "error": "TOOL_BLOCKED: no tool executor is configured for this run",
                "pending_action": None,
            }
        return await tool_dispatch(state, step_count)

    return reason


def build_runtime_graph(tool_dispatch: ToolDispatch | None = None) -> StateGraph[Any, Any, Any, Any]:
    """Constructs the canonical UAAP StateGraph workflow."""
    workflow = StateGraph(RuntimeGraphState)

    workflow.add_node("initialize", _initialize_node)
    # langgraph's node protocol stubs do not cover async callables; the node is awaited at runtime.
    workflow.add_node("reason", _make_reason_node(tool_dispatch))  # type: ignore[arg-type]

    workflow.add_edge(START, "initialize")
    workflow.add_edge("initialize", "reason")
    workflow.add_conditional_edges("reason", _route_after_reason, {"reason": "reason", END: END})

    return workflow
