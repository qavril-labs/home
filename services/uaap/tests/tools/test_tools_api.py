"""GET /v1/tools: the caller is resolved through Core SaaS, never trusted from headers."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest

from uaap.api.main import create_app
from uaap.tools.adapters.core_saas import CoreSaasAdapter

from .fakes import OTHER_TENANT_TOKEN, TENANT, VIEWER_TOKEN, FakeCoreSaas


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    app = create_app()
    app.state.core_saas_adapter = CoreSaasAdapter(
        "http://core.test", transport=httpx.MockTransport(FakeCoreSaas().handler)
    )
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_lists_tools_with_tiers(client: httpx.AsyncClient) -> None:
    res = await client.get(
        "/v1/tools", headers={"Authorization": f"Bearer {VIEWER_TOKEN}", "X-Tenant-ID": TENANT}
    )
    assert res.status_code == 200, res.text
    tools = {t["name"]: t for t in res.json()["tools"]}
    assert tools["ledger_get_trial_balance"]["tier"] == 1
    assert tools["ledger_get_trial_balance"]["caller_has_permission"] is True
    assert tools["ledger_post_journal_entry"]["tier"] == 3
    assert tools["ledger_post_journal_entry"]["caller_has_permission"] is False
    assert tools["sql_execute_raw"]["blocked"] is True
    assert tools["sql_execute_raw"]["caller_has_permission"] is False


async def test_token_from_another_tenant_is_refused(client: httpx.AsyncClient) -> None:
    res = await client.get(
        "/v1/tools", headers={"Authorization": f"Bearer {OTHER_TENANT_TOKEN}", "X-Tenant-ID": TENANT}
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


async def test_unknown_token_is_unauthenticated(client: httpx.AsyncClient) -> None:
    res = await client.get(
        "/v1/tools", headers={"Authorization": f"Bearer {TENANT}.forged", "X-Tenant-ID": TENANT}
    )
    assert res.status_code == 401


async def test_missing_auth_is_rejected_before_core_is_called(client: httpx.AsyncClient) -> None:
    res = await client.get("/v1/tools", headers={"X-Tenant-ID": TENANT})
    assert res.status_code == 401
