"""A fake Core SaaS HTTP API that mirrors the real `apps/api` routes, error envelope and auth."""

from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import SecretStr

from uaap.tools.adapters.core_saas import CoreSaasAdapter, register_core_saas_tools
from uaap.tools.agents import AgentPrincipal, AgentRegistry
from uaap.tools.executor import ToolExecutor
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext

TENANT = "0193a000-0000-7000-8000-000000000001"
OTHER_TENANT = "0193a000-0000-7000-8000-000000000002"
COMPANY = "0193a000-0000-7000-8000-0000000000c1"
ENTRY = "0193a000-0000-7000-8000-0000000000e1"

ACCOUNTANT_TOKEN = f"{TENANT}.accountant"
CONTROLLER_TOKEN = f"{TENANT}.controller"
VIEWER_TOKEN = f"{TENANT}.viewer"
ADMIN_TOKEN = f"{TENANT}.admin"
OTHER_TENANT_TOKEN = f"{OTHER_TENANT}.accountant"

PRINCIPALS: dict[str, dict[str, Any]] = {
    ACCOUNTANT_TOKEN: {"userId": "user-accountant", "tenantId": TENANT, "permissions": ["fin.*"]},
    CONTROLLER_TOKEN: {"userId": "user-controller", "tenantId": TENANT, "permissions": ["fin.*"]},
    VIEWER_TOKEN: {"userId": "user-viewer", "tenantId": TENANT, "permissions": ["fin.report.read"]},
    ADMIN_TOKEN: {"userId": "user-admin", "tenantId": TENANT, "permissions": ["*"]},
    OTHER_TENANT_TOKEN: {"userId": "user-other", "tenantId": OTHER_TENANT, "permissions": ["fin.*"]},
}


def _money(amount: str, currency: str = "USD") -> dict[str, str]:
    return {"amount": amount, "currency": currency}


def _entry(body: dict[str, Any], reversal_of: str | None = None) -> dict[str, Any]:
    currency = body.get("currency", "USD")
    lines = body.get("lines") or [
        {"account": "1000", "side": "CREDIT", "amount": "10.00"},
        {"account": "4000", "side": "DEBIT", "amount": "10.00"},
    ]
    return {
        "id": "0193a000-0000-7000-8000-0000000000e2",
        "companyId": body["companyId"],
        "reference": body["reference"],
        "date": body["date"],
        "periodId": "p1",
        "currency": currency,
        "baseCurrency": "USD",
        "memo": body.get("memo"),
        "reversalOf": reversal_of,
        "lines": [
            {
                "account": line["account"],
                "side": line["side"],
                "amount": _money(line["amount"], currency),
                "baseAmount": _money(line["amount"]),
                "memo": None,
            }
            for line in lines
        ],
        "postedAt": "2026-11-09T10:00:00.000Z",
    }


class FakeCoreSaas:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.fail_with: int | None = None
        self.malformed_output = False

    def _error(self, status: int, code: str) -> httpx.Response:
        return httpx.Response(status, json={"error": {"code": code, "message": "secret internals"}})

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        auth = request.headers.get("authorization", "")
        principal = PRINCIPALS.get(auth.removeprefix("Bearer "))
        if principal is None:
            return self._error(401, "UNAUTHENTICATED")
        path = request.url.path
        if path == "/v1/me":
            return httpx.Response(
                200, json={"principal": {**principal, "email": "x@example.com", "roles": []}}
            )
        if self.fail_with is not None:
            return self._error(self.fail_with, "SOMETHING")

        perms = principal["permissions"]

        def allowed(required: str) -> bool:
            return any(
                g == "*" or g == required or (g.endswith(".*") and required.startswith(g[:-1])) for g in perms
            )

        if path == "/v1/ledger/trial-balance" and request.method == "GET":
            if not allowed("fin.report.read"):
                return self._error(403, "FORBIDDEN")
            if self.malformed_output:
                return httpx.Response(200, json={"rows": "nope"})
            return httpx.Response(
                200,
                json={
                    "asOf": request.url.params["asOf"],
                    "baseCurrency": "USD",
                    "rows": [
                        {
                            "account": "1000",
                            "name": "Cash",
                            "debit": _money("10.00"),
                            "credit": _money("0.00"),
                        },
                        {
                            "account": "4000",
                            "name": "Sales",
                            "debit": _money("0.00"),
                            "credit": _money("10.00"),
                        },
                    ],
                    "totalDebit": _money("10.00"),
                    "totalCredit": _money("10.00"),
                },
            )
        body = json.loads(request.content or b"{}")
        if path == "/v1/ledger/journal-entries" and request.method == "POST":
            if not allowed("fin.journal.post"):
                return self._error(403, "FORBIDDEN")
            return httpx.Response(201, json=_entry(body))
        if path.endswith("/reverse") and request.method == "POST":
            return httpx.Response(201, json=_entry(body, reversal_of=path.split("/")[-2]))
        if path == "/v1/ledger/accounts" and request.method == "POST":
            return httpx.Response(
                201, json={"code": body["code"], "name": body["name"], "type": body["type"], "active": True}
            )
        return self._error(404, "NOT_FOUND")


FINANCE_AGENT = AgentPrincipal(
    agent_id="finance-agent",
    display_name="Universal Finance Agent",
    grants=frozenset({"fin.report.read", "fin.journal.post"}),
    tools=frozenset(
        {"ledger_get_trial_balance", "ledger_post_journal_entry", "ledger_reverse_journal_entry"}
    ),
)


def build_stack(
    fake: FakeCoreSaas, audit: Any = None, max_calls_per_run: int = 20
) -> tuple[ToolExecutor, CoreSaasAdapter]:
    adapter = CoreSaasAdapter("http://core.test", transport=httpx.MockTransport(fake.handler))
    registry = ToolRegistry()
    register_core_saas_tools(registry, adapter)
    agents = AgentRegistry()
    agents.register(FINANCE_AGENT)
    return ToolExecutor(registry, agents, audit_sink=audit, max_calls_per_run=max_calls_per_run), adapter


def caller(
    token: str = ACCOUNTANT_TOKEN,
    *,
    agent_id: str | None = "finance-agent",
    run_id: str | None = None,
) -> CallerContext:
    principal = PRINCIPALS[token]
    return CallerContext(
        tenant_id=principal["tenantId"],
        actor_id=principal["userId"],
        permissions=tuple(principal["permissions"]),
        token=SecretStr(token),
        request_id="req_test",
        agent_id=agent_id,
        run_id=run_id,
    )


ENTRY_ARGS: dict[str, Any] = {
    "companyId": COMPANY,
    "reference": "AGT-0001",
    "date": "2026-11-09",
    "currency": "USD",
    "lines": [
        {"account": "1000", "side": "DEBIT", "amount": "125.50"},
        {"account": "4000", "side": "CREDIT", "amount": "125.50"},
    ],
}
