"""Admin console: fail-closed auth, redacted configuration, checks, agents, kill switch."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
from pydantic import SecretStr

from uaap.api.deps import get_agent_catalog, get_settings
from uaap.api.main import create_app
from uaap.config import Settings

KEY = "k" * 40
DB_URL = "postgresql://uaap_owner:s3cret-pass@127.0.0.1:1/uaap"


def _settings() -> Settings:
    return Settings(
        admin_key=SecretStr(KEY), database_url=SecretStr(DB_URL), approval_token_secret=SecretStr("s" * 40)
    )


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    app = create_app()
    app.dependency_overrides[get_settings] = _settings
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_admin_is_disabled_without_a_key() -> None:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/v1/admin/config", headers={"X-Admin-Key": KEY})
    assert res.status_code == 503


async def test_wrong_or_missing_key_is_rejected(client: httpx.AsyncClient) -> None:
    assert (await client.get("/v1/admin/config")).status_code == 401
    assert (await client.get("/v1/admin/config", headers={"X-Admin-Key": "x" * 40})).status_code == 401


async def test_config_never_returns_secrets(client: httpx.AsyncClient) -> None:
    res = await client.get("/v1/admin/config", headers={"X-Admin-Key": KEY})
    assert res.status_code == 200
    body = res.text
    assert "s3cret-pass" not in body and KEY not in body
    db = res.json()["database"]
    assert db["host"] == "127.0.0.1" and db["user"] == "uaap_owner" and db["password"] == "set"
    assert db["schema"] == "uaap" and db["provisioned"] is False


async def test_checks_report_unreachable_database_and_agents(client: httpx.AsyncClient) -> None:
    res = await client.get("/v1/admin/checks", headers={"X-Admin-Key": KEY})
    data = res.json()
    by_name = {c["name"]: c for c in data["checks"]}
    assert by_name["Database reachability"]["status"] == "fail"
    assert by_name["Agent universal-finance-agent"]["status"] == "ok"
    assert data["overall"] == "fail"


async def test_agents_endpoint_shows_card_and_metrics(client: httpx.AsyncClient) -> None:
    res = await client.get("/v1/admin/agents", headers={"X-Admin-Key": KEY})
    agent = res.json()["agents"][0]
    assert agent["agent_id"] == "universal-finance-agent"
    assert agent["card"]["edge_cases"] and agent["card"]["case_stories"] and agent["card"]["kpis"]
    assert "GROUNDED_REPLY" in res.json()["mandatory_guardrails"]


async def test_admin_page_is_served_with_strict_headers(client: httpx.AsyncClient) -> None:
    res = await client.get("/admin")
    assert res.status_code == 200 and "UAAP Admin" in res.text
    assert "frame-ancestors 'none'" in res.headers["content-security-policy"]
    assert res.headers["cache-control"] == "no-store"


async def test_kill_switch_disables_agent(client: httpx.AsyncClient) -> None:
    catalog = get_agent_catalog()
    res = await client.post("/v1/admin/agents/nope/disable", headers={"X-Admin-Key": KEY})
    assert res.status_code == 404
    res = await client.post("/v1/admin/agents/universal-finance-agent/disable", headers={"X-Admin-Key": KEY})
    assert res.status_code == 200
    agent = catalog.get("universal-finance-agent")
    assert agent is not None and not agent.enabled
    # Restore the singleton for other tests.
    principal = catalog.registry.get("universal-finance-agent")
    assert principal is not None
    import dataclasses

    catalog.registry._agents["universal-finance-agent"] = dataclasses.replace(principal, enabled=True)


def test_settings_validate_database_and_admin_key() -> None:
    with pytest.raises(ValueError):
        Settings(database_url=SecretStr("mysql://x@h/db"))
    with pytest.raises(ValueError):
        Settings(admin_key=SecretStr("short"))
    with pytest.raises(ValueError):
        Settings(database_pool_min=5, database_pool_max=2)
    with pytest.raises(ValueError):
        Settings(
            env="staging",
            database_url=SecretStr(DB_URL),
            database_ssl_mode="prefer",
            approval_token_secret=SecretStr("s" * 40),
        )
    with pytest.raises(ValueError, match="APPROVAL_TOKEN_SECRET"):
        Settings(database_url=SecretStr(DB_URL))
    with pytest.raises(ValueError):
        Settings(database_schema="Bad-Name")
