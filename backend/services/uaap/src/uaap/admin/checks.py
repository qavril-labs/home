"""Configuration summary and health checks for the admin console.

Secrets are never returned. For URLs that carry credentials only the scheme, host, port, database
and user are shown; passwords and keys are reported as "set" or "not set".
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from typing import Any, Literal
from urllib.parse import urlsplit

from uaap.agents.base import AgentCatalog, validate_card
from uaap.config import Settings
from uaap.db.migrate import LATEST
from uaap.db.stores import PostgresWriter, check_schema
from uaap.tools.registry import ToolRegistry

CheckStatus = Literal["ok", "warn", "fail"]
_RANK = {"ok": 0, "warn": 1, "fail": 2}


@dataclass(frozen=True)
class Check:
    name: str
    category: str
    status: CheckStatus
    detail: str


def _endpoint(url: str) -> dict[str, Any]:
    parts = urlsplit(url)
    return {
        "scheme": parts.scheme,
        "host": parts.hostname,
        "port": parts.port,
        "configured": bool(parts.hostname) and not (parts.hostname or "").endswith(".invalid"),
    }


def database_summary(settings: Settings) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "configured": settings.database_url is not None,
        "schema": settings.database_schema,
        "pool": {"min": settings.database_pool_min, "max": settings.database_pool_max},
        "statement_timeout_ms": settings.database_statement_timeout_ms,
        "ssl_mode": settings.database_ssl_mode,
        "row_level_security": "required on every tenant table (tenant_id + app.tenant_id policy)",
        "provisioned": False,
        "provisioning_milestone": "A5",
    }
    if settings.database_url is not None:
        parts = urlsplit(settings.database_url.get_secret_value())
        summary.update(
            {
                "host": parts.hostname,
                "port": parts.port or 5432,
                "database": parts.path.lstrip("/") or None,
                "user": parts.username,
                "password": "set" if parts.password else "not set",  # noqa: S105
            }
        )
    return summary


def config_summary(settings: Settings) -> dict[str, Any]:
    return {
        "environment": settings.env,
        "model_gateway": {
            "provider_mode": settings.provider_mode,
            "endpoint": _endpoint(settings.ollama_base_url),
            "credential": "set" if settings.has_provider_credential else "not set",
            "request_timeout_seconds": settings.request_timeout_seconds,
            "max_attempts": settings.max_attempts,
            "breaker": {
                "failure_threshold": settings.breaker_failure_threshold,
                "cooldown_seconds": settings.breaker_cooldown_seconds,
            },
            "max_output_tokens": settings.max_output_tokens,
        },
        "limits": {
            "requests_per_minute": settings.requests_per_minute,
            "daily_token_budget": settings.daily_token_budget,
            "max_tool_calls_per_run": settings.max_tool_calls_per_run,
            "agent_max_input_chars": settings.agent_max_input_chars,
        },
        "core_saas": {
            "endpoint": _endpoint(settings.core_saas_base_url),
            "tool_timeout_seconds": settings.tool_timeout_seconds,
        },
        "database": database_summary(settings),
        "admin": {"key": "set" if settings.admin_key is not None else "not set"},
        "storage": {
            "audit": "in memory (not durable until A5)",
            "checkpoints": "in memory",
            "approvals": "in memory",
            "metrics": "in memory",
        },
    }


async def _tcp_reachable(host: str, port: int, timeout: float) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
    except (OSError, TimeoutError):
        return False
    writer.close()
    with contextlib.suppress(OSError):
        await writer.wait_closed()
    return True


async def _schema_checks(url: str) -> list[Check]:
    try:
        info = await asyncio.to_thread(check_schema, url)
    except Exception as exc:
        return [
            Check(
                "Database login", "database", "fail", f"Service role could not connect: {type(exc).__name__}."
            )
        ]
    out = [Check("Database login", "database", "ok", f"Connected as {info['user']}.")]
    version = info["schema_version"]
    out.append(
        Check(
            "Schema version",
            "database",
            "ok" if version == LATEST else "fail",
            f"Applied {version or 'none'}; code expects {LATEST}. Run python -m uaap.db.migrate if behind.",
        )
    )
    forced = info["forced_rls"]
    all_forced = bool(forced) and all(forced.values())
    out.append(
        Check(
            "Row-level security",
            "database",
            "ok" if all_forced else "fail",
            "Forced on " + ", ".join(sorted(forced)) if all_forced else "Not forced on every UAAP table.",
        )
    )
    if info["user"] == "uaap_owner" or info["user"] == "neondb_owner":
        out.append(
            Check("Service role", "database", "warn", "Service connects as the owner; use uaap_service.")
        )
    return out


async def run_checks(
    *,
    settings: Settings,
    catalog: AgentCatalog,
    tools: ToolRegistry,
    core_health: Callable[[], Awaitable[bool]],
    model_health: Callable[[], Awaitable[bool]],
    tcp_timeout: float = 2.0,
    db_writer: PostgresWriter | None = None,
) -> dict[str, Any]:
    checks: list[Check] = [
        Check("Settings", "config", "ok", f"Validated at startup; environment {settings.env}.")
    ]

    # Database
    db = database_summary(settings)
    if not db["configured"]:
        checks.append(
            Check(
                "Database",
                "database",
                "warn",
                "No database configured. UAAP keeps all state in memory until A5.",
            )
        )
    else:
        reachable = await _tcp_reachable(db["host"], db["port"], tcp_timeout)
        if reachable and settings.database_url is not None:
            checks.extend(await _schema_checks(settings.database_url.get_secret_value()))
        if db_writer is not None:
            stats = db_writer.stats()
            bad = stats["failed"] or stats["dropped"]
            checks.append(
                Check(
                    "Durable writes",
                    "database",
                    "warn" if bad else "ok",
                    f"written {stats['written']}, failed {stats['failed']}, dropped {stats['dropped']}, "
                    f"queued {stats['queued']}"
                    + (f"; last error {stats['last_error']}" if stats["last_error"] else ""),
                )
            )
        checks.append(
            Check(
                "Database reachability",
                "database",
                "ok" if reachable else "fail",
                f"TCP {db['host']}:{db['port']} "
                + ("accepts connections." if reachable else "is unreachable."),
            )
        )
        if settings.database_ssl_mode in ("disable", "prefer"):
            checks.append(
                Check(
                    "Database TLS",
                    "database",
                    "warn",
                    f"ssl_mode={settings.database_ssl_mode}; use require or verify-full.",
                )
            )
        if db["password"] == "not set":  # noqa: S105 - compares a status label
            checks.append(
                Check("Database credential", "database", "warn", "The database URL has no password.")
            )

    # Core SaaS
    if not _endpoint(settings.core_saas_base_url)["configured"]:
        checks.append(Check("Core SaaS", "integrations", "warn", "Core SaaS URL is not configured."))
    else:
        healthy = await core_health()
        checks.append(
            Check(
                "Core SaaS",
                "integrations",
                "ok" if healthy else "fail",
                "GET /health " + ("ok." if healthy else "failed."),
            )
        )

    # Model gateway
    if settings.provider_mode == "fake":
        checks.append(
            Check(
                "Model provider",
                "model",
                "warn",
                "Fake provider. Set UAAP_PROVIDER_MODE=live with a key, an https URL and UAAP_LIVE_MODELS.",
            )
        )
    else:
        healthy = await model_health()
        checks.append(Check("Model provider", "model", "ok" if healthy else "fail", "Provider health probe."))

    # Agents and tools
    for agent in catalog.all():
        problems = validate_card(agent.card, agent.principal, tools)
        if problems:
            checks.append(Check(f"Agent {agent.card.agent_id}", "agents", "fail", "; ".join(problems)))
        elif not agent.enabled:
            checks.append(
                Check(f"Agent {agent.card.agent_id}", "agents", "warn", "Disabled by an administrator.")
            )
        else:
            checks.append(
                Check(f"Agent {agent.card.agent_id}", "agents", "ok", "Card meets the agent standard.")
            )
    registered = tools.all()
    blocked = sum(1 for t in registered if t.blocked)
    checks.append(
        Check(
            "Tool registry",
            "tools",
            "ok",
            f"{len(registered) - blocked} runnable tools, {blocked} blocked (Tier 5).",
        )
    )

    if db_writer is not None:
        checks.append(
            Check(
                "Storage",
                "storage",
                "ok",
                "Audit, runs, approvals, the inbox, idempotency keys and metrics are durable in Postgres. "
                "Single instance only: per-run tool budgets and model rate limits are still per process.",
            )
        )
    else:
        checks.append(
            Check(
                "Storage",
                "storage",
                "warn",
                "No database: audit and approvals are in memory and lost on restart.",
            )
        )
    overall = max((c.status for c in checks), key=lambda s: _RANK[s])
    return {"overall": overall, "checks": [asdict(c) for c in checks]}
