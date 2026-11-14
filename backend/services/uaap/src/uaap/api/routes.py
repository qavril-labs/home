"""UAAP A2 Model Gateway HTTP endpoints."""

from __future__ import annotations

import hashlib
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from uaap.api.deps import (
    RequestContext,
    get_audit_sink,
    get_metering_service,
    get_model_registry,
    get_provider,
    get_request_context,
    get_resilient_caller,
    get_router,
    get_settings,
    get_tool_registry,
    get_trusted_caller,
)
from uaap.config import Settings
from uaap.errors import ProviderError, UaapError
from uaap.gateway.metering import InMemoryMeteringService
from uaap.gateway.providers.base import Provider
from uaap.gateway.registry import ModelRegistry, Router
from uaap.gateway.resilience import ResilientCaller
from uaap.gateway.structured import execute_structured_request
from uaap.gateway.types import Message, ProviderRequest, ProviderResponse
from uaap.obs.audit import AuditEvent, InMemoryAuditSink
from uaap.tools.permissions import has_permission
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequestPayload(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    model: str | None = None
    capabilities: list[str] | None = None
    json_schema: dict[str, Any] | None = None
    temperature: float = Field(0.2, ge=0.0, le=2.0)
    max_tokens: int | None = Field(None, gt=0)


class ChatResponsePayload(BaseModel):
    model: str
    content: str
    structured_data: dict[str, Any] | None = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    request_id: str


class ModelInfo(BaseModel):
    id: str
    provider: str
    capabilities: list[str]
    cost_tier: int
    context_window: int


class ModelsListResponse(BaseModel):
    models: list[ModelInfo]


@router.get("/healthz")
async def healthz(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "uaap",
        "version": "0.1.0a4",
        "env": settings.env,
        "provider_mode": settings.provider_mode,
    }


@router.get("/readyz")
async def readyz(
    provider: Annotated[Provider, Depends(get_provider)],
    registry: Annotated[ModelRegistry, Depends(get_model_registry)],
) -> dict[str, Any]:
    is_healthy = await provider.health()
    if not is_healthy:
        raise UaapError("SERVICE_UNAVAILABLE", "Provider health probe failed", {"provider": provider.name})
    return {
        "ready": True,
        "provider": provider.name,
        "models": [m.id for m in registry.all()],
    }


@router.get("/v1/models", response_model=ModelsListResponse)
async def list_models(
    registry: Annotated[ModelRegistry, Depends(get_model_registry)],
    _ctx: Annotated[RequestContext, Depends(get_request_context)],
) -> ModelsListResponse:
    return ModelsListResponse(
        models=[
            ModelInfo(
                id=m.id,
                provider=m.provider,
                capabilities=sorted(m.capabilities),
                cost_tier=m.cost_tier,
                context_window=m.context_window,
            )
            for m in registry.all()
        ]
    )


class ToolInfo(BaseModel):
    name: str
    description: str
    product_id: str
    tier: int
    permission: str
    blocked: bool
    caller_has_permission: bool
    input_schema: dict[str, Any]


class ToolsListResponse(BaseModel):
    tools: list[ToolInfo]


@router.get("/v1/tools", response_model=ToolsListResponse)
async def list_tools(
    caller: Annotated[CallerContext, Depends(get_trusted_caller)],
    tools: Annotated[ToolRegistry, Depends(get_tool_registry)],
) -> ToolsListResponse:
    """Registered tools with the tier that applies to the caller's tenant."""
    items = []
    for tool in tools.all():
        d = tool.definition
        tier = tools.effective_tier(caller.tenant_id, d.name)
        items.append(
            ToolInfo(
                name=d.name,
                description=d.description,
                product_id=d.product_id,
                tier=tier,
                permission=d.permission,
                blocked=tool.blocked or tier == 5,
                caller_has_permission=not tool.blocked and has_permission(caller.permissions, d.permission),
                input_schema=d.input_schema,
            )
        )
    return ToolsListResponse(tools=items)


@router.get("/v1/tenants/me/usage")
async def get_my_usage(
    ctx: Annotated[RequestContext, Depends(get_request_context)],
    metering: Annotated[InMemoryMeteringService, Depends(get_metering_service)],
) -> dict[str, Any]:
    return metering.get_tenant_usage(ctx.tenant_id)


@router.post("/v1/model/chat", response_model=ChatResponsePayload)
async def chat_endpoint(
    payload: ChatRequestPayload,
    ctx: Annotated[RequestContext, Depends(get_request_context)],
    settings: Annotated[Settings, Depends(get_settings)],
    router_service: Annotated[Router, Depends(get_router)],
    provider: Annotated[Provider, Depends(get_provider)],
    resilient_caller: Annotated[ResilientCaller, Depends(get_resilient_caller)],
    metering: Annotated[InMemoryMeteringService, Depends(get_metering_service)],
    audit: Annotated[InMemoryAuditSink, Depends(get_audit_sink)],
) -> ChatResponsePayload:
    # 1. Hash messages for audit (prompts are never logged in plain text)
    serialized_prompt = "".join(f"{m.role}:{m.content}" for m in payload.messages)
    prompt_hash = hashlib.sha256(serialized_prompt.encode("utf-8")).hexdigest()
    estimated_prompt_tokens = max(1, len(serialized_prompt) // 4)

    # 2. Check tenant RPM and daily quota limits
    try:
        metering.check_limits(
            ctx.tenant_id,
            requests_per_minute=settings.requests_per_minute,
            daily_token_budget=settings.daily_token_budget,
            estimated_tokens=estimated_prompt_tokens,
        )
    except UaapError as err:
        audit.emit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=ctx.request_id,
                tenant_id=ctx.tenant_id,
                actor_id=ctx.actor_id,
                action="model.chat",
                outcome=err.code.lower(),
                prompt_hash=prompt_hash,
                error_code=err.code,
            )
        )
        raise

    # 3. Determine capabilities and plan model routing
    caps = set(payload.capabilities or ["text"])
    if payload.json_schema is not None:
        caps.add("json")
    model_plan = router_service.plan(required=frozenset(caps), preferred=payload.model)

    # 4. Attempt execution with candidate fallback
    last_error: Exception | None = None
    messages_tuple = tuple(Message(role=m.role, content=m.content) for m in payload.messages)
    max_tokens = payload.max_tokens or settings.max_output_tokens

    for candidate in model_plan:
        prov_req = ProviderRequest(
            model=candidate.id,
            messages=messages_tuple,
            json_mode=bool(payload.json_schema),
            temperature=payload.temperature,
            max_tokens=max_tokens,
        )

        try:
            structured_data: dict[str, Any] | None = None

            def _make_caller(req: ProviderRequest) -> Callable[[], Awaitable[ProviderResponse]]:
                async def _call() -> ProviderResponse:
                    return await provider.chat(req)

                return _call

            if payload.json_schema is not None:
                schema = payload.json_schema

                async def _call_prov(req: ProviderRequest) -> ProviderResponse:
                    return await resilient_caller.execute(_make_caller(req))

                prov_res, structured_data = await execute_structured_request(
                    request=prov_req,
                    schema=schema,
                    caller=_call_prov,
                )
            else:
                prov_res = await resilient_caller.execute(_make_caller(prov_req))

            prompt_toks = prov_res.prompt_tokens or estimated_prompt_tokens
            comp_toks = prov_res.completion_tokens or max(1, len(prov_res.content) // 4)
            total_toks = prompt_toks + comp_toks

            # Record usage and audit event
            metering.record_usage(ctx.tenant_id, prompt_toks, comp_toks)
            audit.emit(
                AuditEvent(
                    at=datetime.now(UTC),
                    request_id=ctx.request_id,
                    tenant_id=ctx.tenant_id,
                    actor_id=ctx.actor_id,
                    action="model.chat",
                    outcome="success",
                    model=candidate.id,
                    prompt_hash=prompt_hash,
                    prompt_tokens=prompt_toks,
                    completion_tokens=comp_toks,
                )
            )

            return ChatResponsePayload(
                model=prov_res.model,
                content=prov_res.content,
                structured_data=structured_data,
                prompt_tokens=prompt_toks,
                completion_tokens=comp_toks,
                total_tokens=total_toks,
                request_id=ctx.request_id,
            )

        except ProviderError as exc:
            last_error = exc
            if not exc.allows_fallback:
                # Auth errors or bad requests should not be retried on another model
                break
            continue
        except UaapError as exc:
            last_error = exc
            break

    # If all candidates fail
    audit.emit(
        AuditEvent(
            at=datetime.now(UTC),
            request_id=ctx.request_id,
            tenant_id=ctx.tenant_id,
            actor_id=ctx.actor_id,
            action="model.chat",
            outcome="failed",
            prompt_hash=prompt_hash,
            error_code="UPSTREAM_FAILED",
        )
    )

    if isinstance(last_error, UaapError):
        raise last_error
    if isinstance(last_error, ProviderError):
        if last_error.kind == "auth":
            raise UaapError("UPSTREAM_FAILED", "Provider authentication failed", {"details": str(last_error)})
        if last_error.kind == "timeout":
            raise UaapError("UPSTREAM_TIMEOUT", "All provider attempts timed out")
        raise UaapError("UPSTREAM_FAILED", f"Upstream provider failure: {last_error.message}")

    raise UaapError("UPSTREAM_FAILED", "Failed to obtain response from any capable model")
