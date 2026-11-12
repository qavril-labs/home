"""Core SaaS adapter (PRD-ERP-17): the first product reachable through the tool boundary.

It calls only the real `/v1` HTTP API in `apps/api`. It never connects to the ERP database.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from uaap.errors import UaapError
from uaap.tools.adapters.http import send
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext, ToolDefinition

PRODUCT_ID = "core-saas"

_UUID = {
    "type": "string",
    "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
}
_DATE = {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$"}
_CURRENCY = {"type": "string", "pattern": "^[A-Z]{3}$"}
# Amounts are positive decimal strings, as Money.fromDecimal accepts them. Never JSON numbers.
_AMOUNT = {"type": "string", "pattern": r"^\d{1,15}(\.\d{1,4})?$", "not": {"pattern": r"^0+(\.0+)?$"}}
_MONEY = {
    "type": "object",
    "required": ["amount", "currency"],
    "properties": {"amount": {"type": "string"}, "currency": {"type": "string"}},
}
_ACCOUNT_OUT = {
    "type": "object",
    "required": ["code", "name", "type", "active"],
    "properties": {
        "code": {"type": "string"},
        "name": {"type": "string"},
        "type": {"type": "string"},
        "active": {"type": "boolean"},
    },
}
_ENTRY_OUT = {
    "type": "object",
    "required": ["id", "companyId", "reference", "date", "currency", "lines", "postedAt"],
    "properties": {
        "id": {"type": "string"},
        "companyId": {"type": "string"},
        "reference": {"type": "string"},
        "date": {"type": "string"},
        "currency": {"type": "string"},
        "reversalOf": {"type": ["string", "null"]},
        "lines": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["account", "side", "amount", "baseAmount"],
                "properties": {
                    "account": {"type": "string"},
                    "side": {"enum": ["DEBIT", "CREDIT"]},
                    "amount": _MONEY,
                    "baseAmount": _MONEY,
                },
            },
        },
        "postedAt": {"type": "string"},
    },
}

TRIAL_BALANCE = ToolDefinition(
    name="ledger_get_trial_balance",
    description="Trial balance for a company as of a date, in the company's base currency.",
    product_id=PRODUCT_ID,
    tier=1,
    permission="fin.report.read",
    input_schema={
        "type": "object",
        "additionalProperties": False,
        "required": ["companyId", "asOf"],
        "properties": {"companyId": _UUID, "asOf": _DATE},
    },
    output_schema={
        "type": "object",
        "required": ["asOf", "baseCurrency", "rows", "totalDebit", "totalCredit"],
        "properties": {
            "asOf": {"type": "string"},
            "baseCurrency": {"type": "string"},
            "rows": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["account", "name", "debit", "credit"],
                    "properties": {
                        "account": {"type": "string"},
                        "name": {"type": "string"},
                        "debit": _MONEY,
                        "credit": _MONEY,
                    },
                },
            },
            "totalDebit": _MONEY,
            "totalCredit": _MONEY,
        },
    },
)

CREATE_ACCOUNT = ToolDefinition(
    name="ledger_create_account",
    description="Add an account to a company's chart of accounts.",
    product_id=PRODUCT_ID,
    tier=3,
    permission="fin.accounts.write",
    input_schema={
        "type": "object",
        "additionalProperties": False,
        "required": ["companyId", "code", "name", "type"],
        "properties": {
            "companyId": _UUID,
            "code": {"type": "string", "pattern": "^[0-9A-Za-z.-]{1,20}$"},
            "name": {"type": "string", "minLength": 1, "maxLength": 120},
            "type": {"enum": ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]},
        },
    },
    output_schema=_ACCOUNT_OUT,
)

POST_JOURNAL_ENTRY = ToolDefinition(
    name="ledger_post_journal_entry",
    description=(
        "Post a balanced journal entry. The reference is unique per company, so a retry with the "
        "same content is safe. The ledger checks the balance; the agent does no arithmetic."
    ),
    product_id=PRODUCT_ID,
    tier=3,
    permission="fin.journal.post",
    input_schema={
        "type": "object",
        "additionalProperties": False,
        "required": ["companyId", "reference", "date", "currency", "lines"],
        "properties": {
            "companyId": _UUID,
            "reference": {"type": "string", "minLength": 1, "maxLength": 100},
            "date": _DATE,
            "currency": _CURRENCY,
            "memo": {"type": "string", "maxLength": 500},
            "lines": {
                "type": "array",
                "minItems": 2,
                "maxItems": 200,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["account", "side", "amount"],
                    "properties": {
                        "account": {"type": "string", "minLength": 1, "maxLength": 20},
                        "side": {"enum": ["DEBIT", "CREDIT"]},
                        "amount": _AMOUNT,
                        "memo": {"type": "string", "maxLength": 500},
                    },
                },
            },
        },
    },
    output_schema=_ENTRY_OUT,
)

REVERSE_JOURNAL_ENTRY = ToolDefinition(
    name="ledger_reverse_journal_entry",
    description="Reverse a posted journal entry. Ledger rows are never edited or deleted.",
    product_id=PRODUCT_ID,
    tier=3,
    permission="fin.journal.post",
    input_schema={
        "type": "object",
        "additionalProperties": False,
        "required": ["companyId", "entryId", "reference", "date"],
        "properties": {
            "companyId": _UUID,
            "entryId": _UUID,
            "reference": {"type": "string", "minLength": 1, "maxLength": 100},
            "date": _DATE,
        },
    },
    output_schema=_ENTRY_OUT,
)

# Tier 5: listed so calls are refused by name and audited. No executor exists for any of them.
_ANY_OBJECT: dict[str, Any] = {"type": "object"}
BLOCKED_TOOLS: tuple[ToolDefinition, ...] = tuple(
    ToolDefinition(
        name=name,
        description=description,
        product_id=PRODUCT_ID,
        tier=5,
        permission="restricted",
        input_schema=_ANY_OBJECT,
    )
    for name, description in (
        ("sql_execute_raw", "Raw SQL against any database."),
        ("ledger_update_entry", "Edit a posted ledger entry. Corrections are reversals."),
        ("ledger_delete_entry", "Delete a posted ledger entry. Corrections are reversals."),
        ("audit_log_modify", "Change or remove audit rows."),
        ("identity_elevate_role", "Grant roles or permissions."),
        ("db_run_migration", "Run database migrations."),
    )
)


@dataclass(frozen=True)
class CorePrincipal:
    user_id: str
    tenant_id: str
    permissions: tuple[str, ...]


class CoreSaasAdapter:
    def __init__(
        self,
        base_url: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, transport=transport, timeout=timeout_seconds)

    async def aclose(self) -> None:
        await self._client.aclose()

    @staticmethod
    def _headers(ctx: CallerContext) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {ctx.token.get_secret_value()}",
            "X-Request-ID": ctx.request_id,
        }
        if ctx.agent_id:
            headers["X-Acting-Agent"] = ctx.agent_id
        return headers

    async def health(self) -> bool:
        """Core SaaS `GET /health`. Used by the admin console only."""
        try:
            response = await self._client.get("/health")
        except httpx.HTTPError:
            return False
        return response.status_code == 200

    async def resolve_principal(self, token: str, request_id: str) -> CorePrincipal:
        """ADR-005: trust the principal Core SaaS returns for this token, not the token prefix."""
        body = await send(
            PRODUCT_ID,
            self._client,
            "GET",
            "/v1/me",
            headers={"Authorization": f"Bearer {token}", "X-Request-ID": request_id},
        )
        principal = body.get("principal")
        if not isinstance(principal, dict):
            raise UaapError("UPSTREAM_INVALID_RESPONSE", "Core SaaS /v1/me returned no principal")
        user_id = principal.get("userId")
        tenant_id = principal.get("tenantId")
        permissions = principal.get("permissions")
        if (
            not isinstance(user_id, str)
            or not isinstance(tenant_id, str)
            or not isinstance(permissions, list)
            or not all(isinstance(p, str) for p in permissions)
        ):
            raise UaapError("UPSTREAM_INVALID_RESPONSE", "Core SaaS /v1/me returned a malformed principal")
        return CorePrincipal(user_id=user_id, tenant_id=tenant_id, permissions=tuple(permissions))

    async def trial_balance(self, ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        return await send(
            PRODUCT_ID,
            self._client,
            "GET",
            "/v1/ledger/trial-balance",
            headers=self._headers(ctx),
            params={"companyId": args["companyId"], "asOf": args["asOf"]},
        )

    async def create_account(self, ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        return await send(
            PRODUCT_ID,
            self._client,
            "POST",
            "/v1/ledger/accounts",
            headers=self._headers(ctx),
            json_body=args,
        )

    async def post_journal_entry(self, ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        return await send(
            PRODUCT_ID,
            self._client,
            "POST",
            "/v1/ledger/journal-entries",
            headers=self._headers(ctx),
            json_body=args,
        )

    async def reverse_journal_entry(self, ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
        entry_id = quote(str(args["entryId"]), safe="")
        return await send(
            PRODUCT_ID,
            self._client,
            "POST",
            f"/v1/ledger/journal-entries/{entry_id}/reverse",
            headers=self._headers(ctx),
            json_body={"companyId": args["companyId"], "reference": args["reference"], "date": args["date"]},
        )


def register_core_saas_tools(registry: ToolRegistry, adapter: CoreSaasAdapter) -> None:
    registry.register(TRIAL_BALANCE, adapter.trial_balance)
    registry.register(CREATE_ACCOUNT, adapter.create_account)
    registry.register(POST_JOURNAL_ENTRY, adapter.post_journal_entry)
    registry.register(REVERSE_JOURNAL_ENTRY, adapter.reverse_journal_entry)
    for blocked in BLOCKED_TOOLS:
        registry.register(blocked, None)
