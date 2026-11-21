"""Deterministic bots (D0): fixed rules, no model, the same standard and the same guardrail pipeline.

A deterministic bot inherits `BaseAgent.respond()`, so input limits, PII redaction, grounding of the
reply, error mapping, metrics and audit all apply. It cannot call a model: `ask_model` refuses, and
its model handle fails any call. Its rules are plain code, so every output is reproducible.
"""

from __future__ import annotations

from typing import Any, ClassVar

from uaap.agents.base import AgentInput, BaseAgent, Trace
from uaap.errors import UaapError
from uaap.gateway.types import Message
from uaap.obs.audit import AuditSink
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.runner import AgentRunner
from uaap.tools.types import CallerContext


class _NoModel:
    """Stands in for the model client. Any call is a bug, so it fails loudly with a typed error."""

    async def complete_json(
        self,
        *,
        tenant_id: str,
        actor_id: str,
        request_id: str,
        messages: tuple[Message, ...],
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        raise UaapError("INTERNAL", "Deterministic bots never call a model")


class DeterministicBot(BaseAgent):
    deterministic: ClassVar[bool] = True
    system_prompt: ClassVar[str] = ""  # No prompt: there is no model. The conformance test skips it.

    def __init__(
        self,
        runner: AgentRunner,
        *,
        metrics: AgentMetrics | None = None,
        audit_sink: AuditSink | None = None,
        max_input_chars: int = 4000,
    ) -> None:
        super().__init__(
            _NoModel(),  # Satisfies the protocol; every call raises.
            runner,
            metrics=metrics,
            audit_sink=audit_sink,
            max_input_chars=max_input_chars,
        )

    async def ask_model(
        self, caller: CallerContext, inp: AgentInput, trace: Trace, schema: dict[str, Any]
    ) -> dict[str, Any]:
        raise UaapError("INTERNAL", "Deterministic bots never call a model")
