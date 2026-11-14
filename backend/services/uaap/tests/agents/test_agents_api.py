"""Bot API and approvals inbox over HTTP, with identity from the fake Core SaaS."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from uaap.agents.base import AgentCatalog
from uaap.agents.finance import AGENT_ID, UniversalFinanceAgent
from uaap.api.deps import get_agent_catalog, get_approval_inbox
from uaap.api.main import create_app
from uaap.approvals.inbox import ApprovalInbox
from uaap.obs.audit import InMemoryAuditSink
from uaap.obs.metrics import AgentMetrics
from uaap.runtime.approval.hooks import ApprovalEngine
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.runner import AgentRunner
from uaap.tools.adapters.core_saas import CoreSaasAdapter

from ..tools.fakes import (
    ACCOUNTANT_TOKEN,
    COMPANY,
    CONTROLLER_TOKEN,
    TENANT,
    VIEWER_TOKEN,
    FakeCoreSaas,
    build_stack,
)
from .test_finance_agent import ENTRY_MESSAGE, ENTRY_PLAN, ScriptedModel


def _h(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": TENANT}


class Env:
    def __init__(self, *plans: dict[str, Any]) -> None:
        self.fake = FakeCoreSaas()
        executor, _ = build_stack(self.fake, InMemoryAuditSink())
        runner = AgentRunner(
            InMemoryCheckpointStore(), ApprovalEngine(), tool_executor=executor, approval_ttl_seconds=3600
        )
        self.catalog = AgentCatalog(executor.agents, executor.registry)
        self.catalog.add(UniversalFinanceAgent(ScriptedModel(*plans), runner, metrics=AgentMetrics()))
        self.inbox = ApprovalInbox()
        app = create_app()
        app.state.core_saas_adapter = CoreSaasAdapter(
            "http://core.test", transport=httpx.MockTransport(self.fake.handler)
        )
        app.dependency_overrides[get_agent_catalog] = lambda: self.catalog
        app.dependency_overrides[get_approval_inbox] = lambda: self.inbox
        self.app = app


@pytest.fixture
async def env() -> AsyncIterator[tuple[Env, httpx.AsyncClient]]:
    e = Env(ENTRY_PLAN)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=e.app), base_url="http://test") as c:
        yield e, c


def _ledger_posts(fake: FakeCoreSaas) -> list[httpx.Request]:
    return [r for r in fake.requests if r.url.path == "/v1/ledger/journal-entries"]


async def _propose(c: httpx.AsyncClient) -> dict[str, Any]:
    res = await c.post(
        f"/v1/agents/{AGENT_ID}/messages",
        headers=_h(ACCOUNTANT_TOKEN),
        json={"message": ENTRY_MESSAGE, "company_id": COMPANY, "today": "2026-11-09"},
    )
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    assert body["status"] == "awaiting_approval"
    assert "token" not in res.text.lower()  # The approval token never leaves the server.
    return body


async def test_full_flow_propose_review_approve(env: tuple[Env, httpx.AsyncClient]) -> None:
    e, c = env
    body = await _propose(c)
    approval_id = body["approval"]["approval_id"]

    mine = (await c.get("/v1/approvals?status=PENDING", headers=_h(ACCOUNTANT_TOKEN))).json()["approvals"]
    assert mine[0]["approval_id"] == approval_id and mine[0]["can_decide"] is False
    item = (await c.get(f"/v1/approvals/{approval_id}", headers=_h(CONTROLLER_TOKEN))).json()
    assert item["can_decide"] is True
    assert item["payload"]["arguments"]["lines"][0]["amount"] == "1250.00"

    res = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(CONTROLLER_TOKEN),
        json={"decision": "approve", "payload_hash": item["payload_hash"]},
    )
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["approval"]["status"] == "APPROVED" and out["approval"]["decided_by"] == "user-controller"
    assert out["reply"]["status"] == "answered"
    posts = _ledger_posts(e.fake)
    assert len(posts) == 1 and posts[0].headers["authorization"] == f"Bearer {CONTROLLER_TOKEN}"
    assert json.loads(posts[0].content)["lines"][0]["amount"] == "1250.00"

    again = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(CONTROLLER_TOKEN),
        json={"decision": "approve", "payload_hash": item["payload_hash"]},
    )
    assert again.status_code == 409 and len(_ledger_posts(e.fake)) == 1


async def test_initiator_cannot_decide_and_proposal_stays_open(env: tuple[Env, httpx.AsyncClient]) -> None:
    e, c = env
    approval_id = (await _propose(c))["approval"]["approval_id"]
    item = (await c.get(f"/v1/approvals/{approval_id}", headers=_h(ACCOUNTANT_TOKEN))).json()
    res = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(ACCOUNTANT_TOKEN),
        json={"decision": "approve", "payload_hash": item["payload_hash"]},
    )
    assert res.status_code == 403
    still = (await c.get(f"/v1/approvals/{approval_id}", headers=_h(CONTROLLER_TOKEN))).json()
    assert still["status"] == "PENDING" and still["can_decide"] is True
    assert _ledger_posts(e.fake) == []


async def test_wrong_payload_hash_is_refused_and_can_retry(env: tuple[Env, httpx.AsyncClient]) -> None:
    e, c = env
    approval_id = (await _propose(c))["approval"]["approval_id"]
    res = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(CONTROLLER_TOKEN),
        json={"decision": "approve", "payload_hash": "0" * 64},
    )
    assert res.status_code == 400 and _ledger_posts(e.fake) == []
    item = (await c.get(f"/v1/approvals/{approval_id}", headers=_h(CONTROLLER_TOKEN))).json()
    ok = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(CONTROLLER_TOKEN),
        json={"decision": "approve", "payload_hash": item["payload_hash"]},
    )
    assert ok.status_code == 200 and len(_ledger_posts(e.fake)) == 1


async def test_approver_without_permission_fails_without_posting(env: tuple[Env, httpx.AsyncClient]) -> None:
    e, c = env
    approval_id = (await _propose(c))["approval"]["approval_id"]
    item = (await c.get(f"/v1/approvals/{approval_id}", headers=_h(VIEWER_TOKEN))).json()
    res = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(VIEWER_TOKEN),
        json={"decision": "approve", "payload_hash": item["payload_hash"]},
    )
    assert res.status_code == 200
    assert res.json()["approval"]["status"] == "FAILED" and res.json()["reply"]["error_code"] == "FORBIDDEN"
    assert _ledger_posts(e.fake) == []


async def test_reject_never_posts(env: tuple[Env, httpx.AsyncClient]) -> None:
    e, c = env
    approval_id = (await _propose(c))["approval"]["approval_id"]
    res = await c.post(
        f"/v1/approvals/{approval_id}/decision",
        headers=_h(CONTROLLER_TOKEN),
        json={"decision": "reject", "reason": "Wrong period"},
    )
    assert res.status_code == 200 and res.json()["approval"]["status"] == "REJECTED"
    assert _ledger_posts(e.fake) == []


async def test_unknown_agent_and_other_tenant(env: tuple[Env, httpx.AsyncClient]) -> None:
    _, c = env
    res = await c.post("/v1/agents/nope/messages", headers=_h(ACCOUNTANT_TOKEN), json={"message": "hi"})
    assert res.status_code == 404
    agents = (await c.get("/v1/agents", headers=_h(ACCOUNTANT_TOKEN))).json()["agents"]
    assert agents[0]["agent_id"] == AGENT_ID
