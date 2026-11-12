"""The agent standard. Every bot is a `BaseAgent` with an `AgentCard`, registered through `AgentCatalog`.

What this enforces for every agent, in code:
- A card with use cases, case stories, edge cases (each tied to a test), out-of-scope items, KPIs,
  every mandatory guardrail and a user-facing message for every mandatory error code.
  `AgentCatalog.add` refuses an agent whose card is incomplete or disagrees with the tool registry.
- `respond()` wraps the agent's own `_handle()` with input limits, PII redaction, injection
  detection, error mapping, reply grounding, metrics and audit. Agents cannot skip these steps.
- Model calls go through `ask_model()`, which wraps user text as data and requires a JSON schema.
- Product actions go through `run_tool()`, i.e. the runner and the tier engine.
"""

from __future__ import annotations

import dataclasses
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, ClassVar, Literal

from uaap.agents.guardrails import (
    MANDATORY_GUARDRAILS,
    Guardrail,
    GuardrailEvent,
    Sources,
    check_grounded,
    figures_in,
    looks_like_injection,
    redact_pii,
)
from uaap.errors import UaapError
from uaap.gateway.client import StructuredModel
from uaap.gateway.types import Message
from uaap.obs.audit import AuditEvent, AuditSink
from uaap.obs.metrics import AgentMetrics
from uaap.obs.redact import get_logger
from uaap.runtime.runner import AgentRunner
from uaap.runtime.state import AgentState, AgentStatus, ApprovalRequest
from uaap.tools.agents import AgentPrincipal, AgentRegistry
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext

logger = get_logger()

Status = Literal["answered", "awaiting_approval", "needs_clarification", "refused", "failed"]

# Every card must say what the user is told for each of these.
MANDATORY_ERROR_CODES: frozenset[str] = frozenset(
    {
        "INTERNAL",
        "VALIDATION",
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "TOOL_BLOCKED",
        "RATE_LIMITED",
        "QUOTA_EXCEEDED",
        "UPSTREAM_FAILED",
        "UPSTREAM_TIMEOUT",
        "UPSTREAM_INVALID_RESPONSE",
        "UNGROUNDED_REPLY",
        "AGENT_DISABLED",
    }
)
MIN_EDGE_CASES = 5
MAX_INPUT_CHARS = 4000


@dataclass(frozen=True)
class UseCase:
    title: str
    example: str  # A realistic user request.
    outcome: str  # What the user gets.
    tool: str | None  # Tool used, or None for a reply without a product call.
    tier: int | None  # Must match the tool registry.


@dataclass(frozen=True)
class CaseStory:
    title: str
    actor: str
    situation: str
    steps: tuple[str, ...]
    outcome: str


@dataclass(frozen=True)
class EdgeCase:
    situation: str
    expected: str
    test: str  # Name of the test function that proves it. The conformance test checks it exists.


@dataclass(frozen=True)
class Kpi:
    name: str
    description: str
    target: str


@dataclass(frozen=True)
class AgentCard:
    agent_id: str
    name: str
    version: str
    owner: str
    purpose: str
    use_cases: tuple[UseCase, ...]
    case_stories: tuple[CaseStory, ...]
    edge_cases: tuple[EdgeCase, ...]
    out_of_scope: tuple[str, ...]
    guardrails: frozenset[Guardrail]
    error_handling: dict[str, str]  # error code -> message shown to the user
    kpis: tuple[Kpi, ...]
    data_sources: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        data = dataclasses.asdict(self)
        data["guardrails"] = sorted(g.value for g in self.guardrails)
        return data


def validate_card(card: AgentCard, principal: AgentPrincipal, tools: ToolRegistry | None = None) -> list[str]:
    """Returns every problem found. An empty list means the card meets the standard."""
    problems: list[str] = []
    if card.agent_id != principal.agent_id:
        problems.append("card agent_id does not match the principal")
    for label, value in (
        ("name", card.name),
        ("version", card.version),
        ("owner", card.owner),
        ("purpose", card.purpose),
    ):
        if not value.strip():
            problems.append(f"{label} is empty")
    if not card.use_cases:
        problems.append("at least one use case is required")
    if not card.case_stories:
        problems.append("at least one case story is required")
    for story in card.case_stories:
        if len(story.steps) < 2:
            problems.append(f"case story '{story.title}' needs at least two steps")
    if len(card.edge_cases) < MIN_EDGE_CASES:
        problems.append(f"at least {MIN_EDGE_CASES} edge cases are required")
    for edge in card.edge_cases:
        if not edge.test.startswith("test_"):
            problems.append(f"edge case '{edge.situation}' must name its test")
    if not card.out_of_scope:
        problems.append("out_of_scope must list at least one item")
    if not card.kpis:
        problems.append("at least one KPI is required")
    if not card.data_sources:
        problems.append("data_sources must list where figures come from")
    missing_guardrails = MANDATORY_GUARDRAILS - card.guardrails
    if missing_guardrails:
        problems.append("missing guardrails: " + ", ".join(sorted(g.value for g in missing_guardrails)))
    missing_errors = MANDATORY_ERROR_CODES - card.error_handling.keys()
    if missing_errors:
        problems.append("missing error handling for: " + ", ".join(sorted(missing_errors)))
    for code, message in card.error_handling.items():
        if not message.strip() or figures_in(message):
            problems.append(f"error message for {code} must be non-empty and contain no figures")

    used_tools = {uc.tool for uc in card.use_cases if uc.tool}
    for uc in card.use_cases:
        if uc.tool is None:
            continue
        if uc.tool not in principal.tools:
            problems.append(f"use case '{uc.title}' uses '{uc.tool}', which the agent may not call")
        if tools is not None:
            registered = tools.get(uc.tool)
            if registered is None or registered.blocked:
                problems.append(f"use case '{uc.title}' uses unregistered or blocked tool '{uc.tool}'")
            elif uc.tier != registered.definition.tier:
                problems.append(
                    f"use case '{uc.title}' says Tier {uc.tier} "
                    f"but '{uc.tool}' is Tier {registered.definition.tier}"
                )
    for tool_name in sorted(principal.tools - used_tools):
        problems.append(f"tool '{tool_name}' is granted but no use case documents it")
    return problems


@dataclass(frozen=True)
class AgentInput:
    message: str
    today: str  # Business date YYYY-MM-DD from the caller's context.
    company_id: str | None = None


@dataclass(frozen=True)
class AgentReply:
    status: Status
    text: str
    run_id: str | None = None
    approval: ApprovalRequest | None = None
    # Single-use approval token: deliver to the approver out of band, never to the initiator's UI.
    approval_token: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    error_code: str | None = None
    guardrail_events: tuple[str, ...] = ()


@dataclass
class Trace:
    """Per-request working state shared by `respond()` and the agent's `_handle()`."""

    sources: Sources = field(default_factory=Sources)
    events: list[str] = field(default_factory=list)
    tool_calls: int = 0
    model_calls: int = 0

    def flag(self, event: GuardrailEvent) -> None:
        if event.value not in self.events:
            self.events.append(event.value)


class BaseAgent(ABC):
    card: ClassVar[AgentCard]
    principal: ClassVar[AgentPrincipal]
    system_prompt: ClassVar[str]

    def __init__(
        self,
        model: StructuredModel,
        runner: AgentRunner,
        *,
        metrics: AgentMetrics | None = None,
        audit_sink: AuditSink | None = None,
        max_input_chars: int = MAX_INPUT_CHARS,
    ) -> None:
        self._model = model
        self._runner = runner
        self._metrics = metrics
        self._audit = audit_sink
        self._max_input_chars = max_input_chars
        self._registry: AgentRegistry | None = None  # Set by AgentCatalog; used for the kill switch.

    @property
    def enabled(self) -> bool:
        if self._registry is None:
            return True
        principal = self._registry.get(self.card.agent_id)
        return principal is not None and principal.enabled

    # ----- what each agent implements -------------------------------------------------------
    @abstractmethod
    async def _handle(self, caller: CallerContext, inp: AgentInput, trace: Trace) -> AgentReply: ...

    # ----- the fixed pipeline ---------------------------------------------------------------
    async def respond(self, caller: CallerContext, inp: AgentInput) -> AgentReply:
        started = time.monotonic()
        trace = Trace()
        message = inp.message.strip()
        try:
            if not self.enabled:
                reply = self.error_reply("AGENT_DISABLED", status="refused")
            elif not message:
                trace.flag(GuardrailEvent.INPUT_EMPTY)
                reply = AgentReply("needs_clarification", "Please tell me what you need.")
            elif len(message) > self._max_input_chars:
                trace.flag(GuardrailEvent.INPUT_TOO_LONG)
                reply = self.error_reply("VALIDATION", status="refused")
            else:
                message, redacted = redact_pii(message)
                if redacted:
                    trace.flag(GuardrailEvent.PII_REDACTED)
                if looks_like_injection(message):
                    # Flag only: the tier engine, grants and grounding checks hold regardless of wording.
                    trace.flag(GuardrailEvent.INJECTION_SUSPECTED)
                trace.sources.add(message)
                trace.sources.add(inp.today)
                trace.sources.add(inp.company_id)
                reply = await self._handle(caller, dataclasses.replace(inp, message=message), trace)
        except UaapError as exc:
            reply = self.error_reply(exc.code)
        except Exception as exc:  # A bug must still produce a safe, typed reply.
            logger.error("Agent %s failed: %s", self.card.agent_id, type(exc).__name__, exc_info=exc)
            reply = self.error_reply("INTERNAL")

        reply = await self._ground_reply(caller, reply, trace)
        reply = dataclasses.replace(reply, guardrail_events=tuple(trace.events))
        self._record(caller, reply, trace, int((time.monotonic() - started) * 1000))
        return reply

    async def _ground_reply(self, caller: CallerContext, reply: AgentReply, trace: Trace) -> AgentReply:
        """GROUNDED_REPLY: nothing with an unsourced figure, date or id reaches the user."""
        if reply.status in ("failed", "refused"):
            return reply  # These texts come from the card, which validate_card keeps figure-free.
        result = check_grounded(reply.text, trace.sources)
        if result.ok:
            return reply
        trace.flag(GuardrailEvent.UNGROUNDED_REPLY)
        logger.warning(
            "Agent %s reply withheld: ungrounded figures=%s dates=%s ids=%s",
            self.card.agent_id,
            len(result.missing_figures),
            len(result.missing_dates),
            len(result.missing_ids),
        )
        if reply.status == "awaiting_approval" and reply.run_id:
            await self._runner.cancel_run(
                tenant_id=caller.tenant_id,
                run_id=reply.run_id,
                actor_id=caller.actor_id,
                reason="Proposal withheld: it contained values without a source",
            )
        if reply.status == "needs_clarification":
            return AgentReply("needs_clarification", "Please give more detail about what you need.")
        return self.error_reply("UNGROUNDED_REPLY", run_id=reply.run_id)

    def error_reply(self, code: str, *, status: Status = "failed", run_id: str | None = None) -> AgentReply:
        known = code if code in self.card.error_handling else "INTERNAL"
        return AgentReply(status, self.card.error_handling[known], run_id=run_id, error_code=code)

    def _record(self, caller: CallerContext, reply: AgentReply, trace: Trace, latency_ms: int) -> None:
        if self._metrics is not None:
            self._metrics.record_request(
                self.card.agent_id,
                caller.tenant_id,
                status=reply.status,
                latency_ms=latency_ms,
                error_code=reply.error_code,
                guardrail_events=list(trace.events),
                tool_calls=trace.tool_calls,
                model_calls=trace.model_calls,
                approval_requested=reply.status == "awaiting_approval",
            )
        if self._audit is not None:
            self._audit.emit(
                AuditEvent(
                    at=datetime.now(UTC),
                    request_id=caller.request_id,
                    tenant_id=caller.tenant_id,
                    actor_id=caller.actor_id,
                    action="agent.reply",
                    outcome=reply.status,
                    error_code=reply.error_code,
                    agent_id=self.card.agent_id,
                    run_id=reply.run_id,
                    latency_ms=latency_ms,
                )
            )

    # ----- helpers agents must use ------------------------------------------------------------
    async def ask_model(
        self, caller: CallerContext, inp: AgentInput, trace: Trace, schema: dict[str, Any]
    ) -> dict[str, Any]:
        """DATA_DELIMITING + SCHEMA_OUTPUT: user text is wrapped as data; output must match the schema."""
        trace.model_calls += 1
        return await self._model.complete_json(
            tenant_id=caller.tenant_id,
            actor_id=caller.actor_id,
            request_id=caller.request_id,
            messages=(
                Message(role="system", content=self.system_prompt),
                Message(role="user", content=f"<user_request>\n{inp.message}\n</user_request>"),
            ),
            schema=schema,
        )

    async def run_tool(
        self, caller: CallerContext, inp: AgentInput, trace: Trace, action: dict[str, Any]
    ) -> tuple[AgentState, str | None]:
        """TIERED_TOOLS: every product action is a run through the runner and the tier engine."""
        trace.tool_calls += 1
        trace.sources.add(action.get("arguments"))
        trace.sources.add(action.get("idempotency_key"))
        run = await self._runner.create_run(
            tenant_id=caller.tenant_id,
            actor_id=caller.actor_id,
            messages=(Message(role="user", content=inp.message),),
            agent_id=self.card.agent_id,
            pending_action=action,
        )
        state, token = await self._runner.start_run(
            tenant_id=caller.tenant_id, run_id=run.run_id, caller=caller
        )
        for result in state.working_context.get("tool_results", []):
            trace.sources.add(result.get("output"))
        return state, token

    def failure_from_state(self, state: AgentState) -> AgentReply:
        code = (state.error or "INTERNAL").split(":", 1)[0].strip() or "INTERNAL"
        if state.status == AgentStatus.REJECTED:
            return AgentReply(
                "refused", "The proposal was rejected. Nothing was posted.", run_id=state.run_id
            )
        return self.error_reply(code, run_id=state.run_id)

    async def approve(
        self,
        approver: CallerContext,
        *,
        run_id: str,
        approval_id: str,
        approval_token: str,
        confirmed_payload: dict[str, Any],
    ) -> AgentReply:
        """The approver confirms the exact payload they reviewed. The action runs under their credentials."""
        state = await self._runner.resume_after_approval(
            tenant_id=approver.tenant_id,
            run_id=run_id,
            approval_id=approval_id,
            approving_actor_id=approver.actor_id,
            presented_raw_token=approval_token,
            confirmed_payload=confirmed_payload,
            approver=approver,
        )
        if self._metrics is not None:
            decision = "approved" if state.status == AgentStatus.COMPLETED else "approved_failed"
            self._metrics.record_approval(self.card.agent_id, approver.tenant_id, decision)
        reply = self.after_approval(state)
        # GROUNDED_REPLY applies here too: the text may only quote the approved payload and tool output.
        sources = Sources()
        sources.add(confirmed_payload)
        for result in state.working_context.get("tool_results", []):
            sources.add(result.get("output"))
        if reply.status == "answered" and not check_grounded(reply.text, sources).ok:
            return self.error_reply("UNGROUNDED_REPLY", run_id=state.run_id)
        return reply

    async def reject(
        self, approver: CallerContext, *, run_id: str, approval_id: str, reason: str
    ) -> AgentReply:
        state = await self._runner.reject_run(
            tenant_id=approver.tenant_id,
            run_id=run_id,
            approval_id=approval_id,
            rejecting_actor_id=approver.actor_id,
            reason=reason,
        )
        if self._metrics is not None:
            self._metrics.record_approval(self.card.agent_id, approver.tenant_id, "rejected")
        return self.failure_from_state(state)

    def after_approval(self, state: AgentState) -> AgentReply:
        """Agents override this to describe the result of an approved action."""
        if state.status != AgentStatus.COMPLETED:
            return self.failure_from_state(state)
        return AgentReply("answered", "Done.", run_id=state.run_id)


class AgentCatalog:
    """The only way to put an agent into service. Incomplete cards are refused."""

    def __init__(self, agents: AgentRegistry, tools: ToolRegistry | None = None) -> None:
        self._registry = agents
        self._tools = tools
        self._agents: dict[str, BaseAgent] = {}

    def add(self, agent: BaseAgent) -> None:
        problems = validate_card(agent.card, agent.principal, self._tools)
        if problems:
            raise UaapError(
                "VALIDATION",
                f"Agent '{agent.card.agent_id}' does not meet the agent standard",
                {"problems": problems},
            )
        self._registry.register(agent.principal)
        agent._registry = self._registry
        self._agents[agent.card.agent_id] = agent

    def get(self, agent_id: str) -> BaseAgent | None:
        return self._agents.get(agent_id)

    def all(self) -> list[BaseAgent]:
        return [self._agents[k] for k in sorted(self._agents)]

    @property
    def registry(self) -> AgentRegistry:
        return self._registry
