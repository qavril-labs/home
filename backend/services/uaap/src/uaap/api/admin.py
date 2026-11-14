"""Operator admin console: `/v1/admin/*` (JSON, needs `X-Admin-Key`) and `/admin` (the page)."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse

from uaap.admin.checks import config_summary, run_checks
from uaap.agents.base import AgentCatalog
from uaap.agents.guardrails import Guardrail
from uaap.api.deps import (
    get_agent_catalog,
    get_agent_metrics,
    get_audit_sink,
    get_core_saas_adapter,
    get_db_writer,
    get_pg_state,
    get_provider,
    get_settings,
    get_tool_registry,
    require_admin,
)
from uaap.config import Settings
from uaap.errors import UaapError
from uaap.gateway.providers.base import Provider
from uaap.obs.audit import AuditEvent, InMemoryAuditSink
from uaap.obs.metrics import AgentMetrics
from uaap.obs.redact import get_logger
from uaap.tools.adapters.core_saas import CoreSaasAdapter
from uaap.tools.registry import ToolRegistry

router = APIRouter()
logger = get_logger()
_PAGE = Path(__file__).with_name("admin_page.html")
_CSP = (
    "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; "
    "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)

Admin = Annotated[str, Depends(require_admin)]


@router.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def admin_page() -> HTMLResponse:
    """Static page. It holds the admin key in memory only and calls the JSON endpoints below."""
    return HTMLResponse(
        _PAGE.read_text(encoding="utf-8"),
        headers={"Content-Security-Policy": _CSP, "Cache-Control": "no-store", "X-Frame-Options": "DENY"},
    )


@router.get("/v1/admin/config")
async def admin_config(_: Admin, settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, Any]:
    return config_summary(settings)


@router.get("/v1/admin/checks")
async def admin_checks(
    _: Admin,
    settings: Annotated[Settings, Depends(get_settings)],
    catalog: Annotated[AgentCatalog, Depends(get_agent_catalog)],
    tools: Annotated[ToolRegistry, Depends(get_tool_registry)],
    core: Annotated[CoreSaasAdapter, Depends(get_core_saas_adapter)],
    provider: Annotated[Provider, Depends(get_provider)],
) -> dict[str, Any]:
    return await run_checks(
        settings=settings,
        catalog=catalog,
        tools=tools,
        core_health=core.health,
        model_health=provider.health,
        db_writer=get_db_writer(),
    )


@router.get("/v1/admin/agents")
async def admin_agents(
    _: Admin,
    catalog: Annotated[AgentCatalog, Depends(get_agent_catalog)],
    metrics: Annotated[AgentMetrics, Depends(get_agent_metrics)],
) -> dict[str, Any]:
    snapshot = await _durable_or_memory(metrics, None)
    return {
        "mandatory_guardrails": sorted(g.value for g in Guardrail),
        "agents": [
            {
                "agent_id": agent.card.agent_id,
                "enabled": agent.enabled,
                "principal": agent.principal.principal,
                "grants": sorted(agent.principal.grants),
                "tools": sorted(agent.principal.tools),
                "card": agent.card.as_dict(),
                "metrics": snapshot.get(agent.card.agent_id, {"requests": 0}),
            }
            for agent in catalog.all()
        ],
    }


@router.get("/v1/admin/metrics")
async def admin_metrics(
    _: Admin,
    metrics: Annotated[AgentMetrics, Depends(get_agent_metrics)],
    tenant_id: str | None = None,
    days: int = 30,
) -> dict[str, Any]:
    """All-tenant totals come from Postgres (last `days` days) when a database is configured.
    A per-tenant view uses this process's in-memory counters (since restart)."""
    since = datetime.now(UTC) - timedelta(days=max(1, min(days, 365)))
    data = await _durable_or_memory(metrics, tenant_id, since)
    source = "postgres" if tenant_id is None and get_pg_state() is not None else "memory (since restart)"
    return {"agents": data, "tenant_id": tenant_id, "source": source}


async def _durable_or_memory(
    metrics: AgentMetrics, tenant_id: str | None, since: datetime | None = None
) -> dict[str, Any]:
    pg = get_pg_state()
    if pg is not None and tenant_id is None:
        try:
            return await asyncio.to_thread(
                pg.metrics_summary, since or datetime.now(UTC) - timedelta(days=30)
            )
        except Exception as exc:  # Fall back rather than fail the console.
            logger.warning("Durable metrics unavailable: %s", type(exc).__name__)
    return metrics.snapshot(tenant_id=tenant_id)


@router.get("/v1/admin/tools")
async def admin_tools(_: Admin, tools: Annotated[ToolRegistry, Depends(get_tool_registry)]) -> dict[str, Any]:
    return {
        "tools": [
            {
                "name": t.definition.name,
                "product_id": t.definition.product_id,
                "tier": t.definition.tier,
                "permission": t.definition.permission,
                "blocked": t.blocked,
                "timeout_seconds": t.definition.timeout_seconds,
                "description": t.definition.description,
            }
            for t in tools.all()
        ]
    }


@router.post("/v1/admin/agents/{agent_id}/disable")
async def admin_disable_agent(
    agent_id: str,
    request_id: Admin,
    catalog: Annotated[AgentCatalog, Depends(get_agent_catalog)],
    audit: Annotated[InMemoryAuditSink, Depends(get_audit_sink)],
) -> dict[str, Any]:
    """Kill switch. Re-enabling is a deploy-time decision, so there is no enable endpoint."""
    if catalog.get(agent_id) is None:
        raise UaapError("NOT_FOUND", "Agent not found", {"agent_id": agent_id})
    catalog.registry.disable(agent_id)
    audit.emit(
        AuditEvent(
            at=datetime.now(UTC),
            request_id=request_id,
            tenant_id=None,
            actor_id="admin",
            action="admin.agent.disable",
            outcome="success",
            agent_id=agent_id,
        )
    )
    return {"agent_id": agent_id, "enabled": False}
