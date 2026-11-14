"""FastAPI dependencies and service singletons."""

from __future__ import annotations

import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any, cast

from fastapi import Depends, Header, Request
from pydantic import SecretStr

from uaap.agents.base import AgentCatalog
from uaap.agents.finance import UniversalFinanceAgent
from uaap.approvals.inbox import ApprovalInbox
from uaap.config import Settings
from uaap.db.durable import (
    DurableCheckpointStore,
    DurableIdempotencyStore,
    PgApprovalRecords,
    PgInboxHistory,
)
from uaap.db.state import PgState
from uaap.db.stores import PostgresAuditSink, PostgresWriter
from uaap.errors import UaapError
from uaap.gateway.client import GatewayModelClient
from uaap.gateway.factory import build_model_registry, build_provider
from uaap.gateway.metering import InMemoryMeteringService
from uaap.gateway.providers.base import Provider
from uaap.gateway.registry import ModelRegistry, Router
from uaap.gateway.resilience import CircuitBreaker, ResilientCaller
from uaap.obs.audit import AuditEvent, InMemoryAuditSink
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner
from uaap.tools.adapters.core_saas import CoreSaasAdapter, register_core_saas_tools
from uaap.tools.agents import AgentRegistry
from uaap.tools.executor import ToolExecutor
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext

# Singletons for in-process lifecycle
_SETTINGS = Settings()
_METERING = InMemoryMeteringService()
# With UAAP_DATABASE_URL set, audit events and approval history are written to Postgres (schema uaap).
_DB_WRITER: PostgresWriter | None = (
    PostgresWriter(_SETTINGS.database_url.get_secret_value()) if _SETTINGS.database_url is not None else None
)
# With a database, runs, approvals, the inbox, idempotency keys and metrics all survive restarts.
_PG_STATE: PgState | None = (
    PgState(_SETTINGS.database_url.get_secret_value()) if _SETTINGS.database_url else None
)
_AUDIT: InMemoryAuditSink = PostgresAuditSink(_DB_WRITER) if _DB_WRITER is not None else InMemoryAuditSink()
_REGISTRY = build_model_registry(_SETTINGS)
_ROUTER = Router(_REGISTRY)
_BREAKER = CircuitBreaker(
    failure_threshold=_SETTINGS.breaker_failure_threshold,
    cooldown_seconds=_SETTINGS.breaker_cooldown_seconds,
)
_RESILIENT_CALLER = ResilientCaller(
    timeout_seconds=_SETTINGS.request_timeout_seconds,
    max_attempts=_SETTINGS.max_attempts,
    backoff_base_seconds=_SETTINGS.backoff_base_seconds,
    backoff_max_seconds=_SETTINGS.backoff_max_seconds,
    breaker=_BREAKER,
)
_CORE_SAAS = CoreSaasAdapter(_SETTINGS.core_saas_base_url, timeout_seconds=_SETTINGS.tool_timeout_seconds)
_TOOLS = ToolRegistry()
register_core_saas_tools(_TOOLS, _CORE_SAAS)
_AGENTS = AgentRegistry()
_EXECUTOR = ToolExecutor(
    _TOOLS,
    _AGENTS,
    idempotency=DurableIdempotencyStore(_PG_STATE) if _PG_STATE is not None else None,
    audit_sink=_AUDIT,
    max_calls_per_run=_SETTINGS.max_tool_calls_per_run,
)
_TOKEN_SECRET = (
    _SETTINGS.approval_token_secret.get_secret_value().encode("utf-8")
    if _SETTINGS.approval_token_secret
    else None
)


def _queue_metric(tenant_id: str, row: dict[str, Any]) -> None:
    if _DB_WRITER is not None:
        _DB_WRITER.submit("metric", {**row, "tenant_id": tenant_id})


_METRICS = AgentMetrics(on_record=_queue_metric if _DB_WRITER is not None else None)
_APPROVALS = ApprovalEngine(
    audit_sink=_AUDIT,
    records=PgApprovalRecords(_PG_STATE) if _PG_STATE is not None else None,
    token_secret=_TOKEN_SECRET,
)
_INBOX = ApprovalInbox(
    history=PgInboxHistory(_PG_STATE) if _PG_STATE is not None else None,
    token_for=_APPROVALS.token_for if _TOKEN_SECRET is not None else None,
)
_RUNNER = AgentRunner(
    DurableCheckpointStore(_PG_STATE) if _PG_STATE is not None else InMemoryCheckpointStore(),
    _APPROVALS,
    audit_sink=_AUDIT,
    tool_executor=_EXECUTOR,
    approval_ttl_seconds=_SETTINGS.approval_ttl_seconds,
)
_MODEL_CLIENT = GatewayModelClient(
    provider=build_provider(_SETTINGS),
    router=_ROUTER,
    resilient_caller=_RESILIENT_CALLER,
    metering=_METERING,
    audit_sink=_AUDIT,
    requests_per_minute=_SETTINGS.requests_per_minute,
    daily_token_budget=_SETTINGS.daily_token_budget,
)
# Every agent enters service through the catalog, which refuses cards that miss the standard.
_CATALOG = AgentCatalog(_AGENTS, _TOOLS)
_CATALOG.add(
    UniversalFinanceAgent(
        _MODEL_CLIENT,
        _RUNNER,
        metrics=_METRICS,
        audit_sink=_AUDIT,
        max_input_chars=_SETTINGS.agent_max_input_chars,
    )
)


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    actor_id: str
    request_id: str


def get_settings() -> Settings:
    return _SETTINGS


def get_metering_service() -> InMemoryMeteringService:
    return _METERING


def get_audit_sink() -> InMemoryAuditSink:
    return _AUDIT


def get_model_registry() -> ModelRegistry:
    return _REGISTRY


def get_router() -> Router:
    return _ROUTER


def get_resilient_caller() -> ResilientCaller:
    return _RESILIENT_CALLER


def get_provider(
    settings: Annotated[Settings, Depends(get_settings)],
    request: Request,
) -> Provider:
    # In tests or app state, an injected fake transport or custom provider may be set
    custom_provider = getattr(request.app.state, "provider", None)
    if custom_provider is not None:
        return cast(Provider, custom_provider)

    return build_provider(settings)


def get_request_context(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    x_tenant_id: Annotated[str | None, Header()] = None,
    x_actor_id: Annotated[str | None, Header()] = None,
    x_request_id: Annotated[str | None, Header()] = None,
) -> RequestContext:
    req_id = x_request_id or getattr(request.state, "request_id", None) or f"req_{uuid.uuid4().hex[:12]}"

    if not authorization or not authorization.startswith("Bearer "):
        raise UaapError("UNAUTHENTICATED", "Missing or invalid Authorization header", {"request_id": req_id})

    token = authorization[7:].strip()
    if not token:
        raise UaapError("UNAUTHENTICATED", "Bearer token cannot be empty", {"request_id": req_id})

    if not x_tenant_id or not x_tenant_id.strip():
        raise UaapError("VALIDATION", "X-Tenant-ID header is required", {"request_id": req_id})

    actor = (x_actor_id or "system").strip()

    return RequestContext(
        tenant_id=x_tenant_id.strip(),
        actor_id=actor,
        request_id=req_id,
    )


def get_tool_registry() -> ToolRegistry:
    return _TOOLS


def get_agent_registry() -> AgentRegistry:
    return _AGENTS


def get_tool_executor() -> ToolExecutor:
    return _EXECUTOR


def get_core_saas_adapter(request: Request) -> CoreSaasAdapter:
    custom = getattr(request.app.state, "core_saas_adapter", None)
    if custom is not None:
        return cast(CoreSaasAdapter, custom)
    return _CORE_SAAS


async def get_trusted_caller(
    ctx: Annotated[RequestContext, Depends(get_request_context)],
    core: Annotated[CoreSaasAdapter, Depends(get_core_saas_adapter)],
    authorization: Annotated[str | None, Header()] = None,
) -> CallerContext:
    """ADR-005: the caller's identity and permissions come from Core SaaS `/v1/me`, not headers.

    The token is kept in memory for this request only.
    """
    token = (authorization or "")[7:].strip()
    principal = await core.resolve_principal(token, ctx.request_id)
    if principal.tenant_id != ctx.tenant_id:
        raise UaapError(
            "FORBIDDEN", "Token does not belong to the requested tenant", {"request_id": ctx.request_id}
        )
    return CallerContext(
        tenant_id=principal.tenant_id,
        actor_id=principal.user_id,
        permissions=principal.permissions,
        token=SecretStr(token),
        request_id=ctx.request_id,
    )


def get_agent_catalog() -> AgentCatalog:
    return _CATALOG


def get_agent_metrics() -> AgentMetrics:
    return _METRICS


def get_approval_inbox() -> ApprovalInbox:
    return _INBOX


def get_db_writer() -> PostgresWriter | None:
    return _DB_WRITER


def get_pg_state() -> PgState | None:
    return _PG_STATE


def require_admin(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    x_admin_key: Annotated[str | None, Header()] = None,
) -> str:
    """Admin console access. Fails closed when no admin key is configured."""
    req_id = getattr(request.state, "request_id", None) or "-"
    if settings.admin_key is None:
        raise UaapError(
            "SERVICE_UNAVAILABLE", "Admin console is disabled: set UAAP_ADMIN_KEY", {"request_id": req_id}
        )
    presented = (x_admin_key or "").encode("utf-8")
    expected = settings.admin_key.get_secret_value().encode("utf-8")
    if not presented or not hmac.compare_digest(presented, expected):
        _AUDIT.emit(
            AuditEvent(
                at=datetime.now(UTC),
                request_id=req_id,
                tenant_id=None,
                actor_id="admin",
                action="admin.access",
                outcome="denied",
                error_code="UNAUTHENTICATED",
            )
        )
        raise UaapError("UNAUTHENTICATED", "Invalid admin key", {"request_id": req_id})
    return req_id
