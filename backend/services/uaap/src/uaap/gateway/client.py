"""In-process model client for agents.

Agents ask for JSON that matches a schema. This client picks a capable model, applies retries and
the circuit breaker, falls back across models, meters tokens and audits each call. Agents never see
a provider or a credential.
"""

from __future__ import annotations

import hashlib
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, Protocol

from uaap.errors import ProviderError, UaapError
from uaap.gateway.metering import InMemoryMeteringService
from uaap.gateway.providers.base import Provider
from uaap.gateway.registry import Router
from uaap.gateway.resilience import ResilientCaller
from uaap.gateway.structured import execute_structured_request
from uaap.gateway.types import Message, ProviderRequest, ProviderResponse
from uaap.obs.audit import AuditEvent, AuditSink


class StructuredModel(Protocol):
    async def complete_json(
        self,
        *,
        tenant_id: str,
        actor_id: str,
        request_id: str,
        messages: tuple[Message, ...],
        schema: dict[str, Any],
    ) -> dict[str, Any]: ...


class GatewayModelClient:
    def __init__(
        self,
        *,
        provider: Provider,
        router: Router,
        resilient_caller: ResilientCaller,
        metering: InMemoryMeteringService | None = None,
        audit_sink: AuditSink | None = None,
        requests_per_minute: int = 60,
        daily_token_budget: int = 1_000_000,
        max_tokens: int = 1024,
    ) -> None:
        self._provider = provider
        self._router = router
        self._caller = resilient_caller
        self._metering = metering
        self._audit = audit_sink
        self._rpm = requests_per_minute
        self._budget = daily_token_budget
        self._max_tokens = max_tokens

    def _emit(self, **fields: Any) -> None:
        if self._audit is not None:
            self._audit.emit(AuditEvent(at=datetime.now(UTC), action="model.chat", **fields))

    async def complete_json(
        self,
        *,
        tenant_id: str,
        actor_id: str,
        request_id: str,
        messages: tuple[Message, ...],
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        serialized = "".join(f"{m.role}:{m.content}" for m in messages)
        prompt_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        base = {
            "request_id": request_id,
            "tenant_id": tenant_id,
            "actor_id": actor_id,
            "prompt_hash": prompt_hash,
        }
        if self._metering is not None:
            self._metering.check_limits(
                tenant_id,
                requests_per_minute=self._rpm,
                daily_token_budget=self._budget,
                estimated_tokens=max(1, len(serialized) // 4),
            )

        def make_call(req: ProviderRequest) -> Callable[[], Awaitable[ProviderResponse]]:
            async def call() -> ProviderResponse:
                return await self._provider.chat(req)

            return call

        async def resilient(req: ProviderRequest) -> ProviderResponse:
            return await self._caller.execute(make_call(req))

        last_error: Exception | None = None
        for candidate in self._router.plan(frozenset({"json"})):
            request = ProviderRequest(
                model=candidate.id,
                messages=messages,
                json_mode=True,
                temperature=0.0,
                max_tokens=self._max_tokens,
            )
            try:
                response, data = await execute_structured_request(
                    request=request, schema=schema, caller=resilient
                )
            except ProviderError as exc:
                last_error = exc
                if exc.allows_fallback:
                    continue
                break
            except UaapError as exc:
                last_error = exc
                break
            prompt_tokens = response.prompt_tokens or max(1, len(serialized) // 4)
            completion_tokens = response.completion_tokens or max(1, len(response.content) // 4)
            if self._metering is not None:
                self._metering.record_usage(tenant_id, prompt_tokens, completion_tokens)
            self._emit(
                outcome="success",
                model=candidate.id,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                **base,
            )
            return data

        code = last_error.code if isinstance(last_error, UaapError) else "UPSTREAM_FAILED"
        self._emit(outcome="failed", error_code=code, **base)
        if isinstance(last_error, UaapError):
            raise last_error
        if isinstance(last_error, ProviderError) and last_error.kind == "timeout":
            raise UaapError("UPSTREAM_TIMEOUT", "All model attempts timed out")
        raise UaapError("UPSTREAM_FAILED", "No model produced a usable response")
