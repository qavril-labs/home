"""Core SaaS adapter: real routes, principal resolution and product error mapping."""

from __future__ import annotations

import httpx
import pytest

from uaap.errors import UaapError
from uaap.tools.adapters.core_saas import CoreSaasAdapter
from uaap.tools.types import ToolCall

from .fakes import (
    ACCOUNTANT_TOKEN,
    COMPANY,
    CONTROLLER_TOKEN,
    ENTRY,
    TENANT,
    FakeCoreSaas,
    build_stack,
    caller,
)


async def test_resolve_principal_uses_v1_me() -> None:
    fake = FakeCoreSaas()
    _, adapter = build_stack(fake)
    principal = await adapter.resolve_principal(ACCOUNTANT_TOKEN, "req_1")
    assert principal.tenant_id == TENANT
    assert principal.user_id == "user-accountant"
    assert principal.permissions == ("fin.*",)
    assert fake.requests[-1].url.path == "/v1/me"


async def test_resolve_principal_rejects_unknown_token() -> None:
    _, adapter = build_stack(FakeCoreSaas())
    with pytest.raises(UaapError) as exc:
        await adapter.resolve_principal(f"{TENANT}.forged", "req_1")
    assert exc.value.code == "UNAUTHENTICATED"


async def test_malformed_principal_is_rejected() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"principal": {"userId": "u", "tenantId": "t", "permissions": "*"}})

    adapter = CoreSaasAdapter("http://core.test", transport=httpx.MockTransport(handler))
    with pytest.raises(UaapError) as exc:
        await adapter.resolve_principal("t.x", "r")
    assert exc.value.code == "UPSTREAM_INVALID_RESPONSE"


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "VALIDATION"),
        (403, "FORBIDDEN"),
        (404, "NOT_FOUND"),
        (409, "CONFLICT"),
        (429, "RATE_LIMITED"),
        (500, "UPSTREAM_FAILED"),
        (503, "UPSTREAM_FAILED"),
    ],
)
async def test_product_errors_map_to_typed_codes(status: int, code: str) -> None:
    fake = FakeCoreSaas()
    fake.fail_with = status
    executor, _ = build_stack(fake)
    with pytest.raises(UaapError) as exc:
        await executor.execute(
            caller(), ToolCall("ledger_get_trial_balance", {"companyId": COMPANY, "asOf": "2026-11-30"})
        )
    assert exc.value.code == code
    assert exc.value.details["product_code"] == "SOMETHING"
    # The product's message body is not copied into UAAP errors.
    assert "secret internals" not in str(exc.value) and "secret internals" not in repr(exc.value.details)


async def test_network_failure_and_timeout_are_typed() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    for handler, code in ((refuse, "UPSTREAM_FAILED"), (slow, "UPSTREAM_TIMEOUT")):
        adapter = CoreSaasAdapter("http://core.test", transport=httpx.MockTransport(handler))
        with pytest.raises(UaapError) as exc:
            await adapter.trial_balance(caller(), {"companyId": COMPANY, "asOf": "2026-11-30"})
        assert exc.value.code == code


async def test_reverse_uses_entry_path_and_sends_only_contract_fields() -> None:
    fake = FakeCoreSaas()
    _, adapter = build_stack(fake)
    out = await adapter.reverse_journal_entry(
        caller(CONTROLLER_TOKEN),
        {"companyId": COMPANY, "entryId": ENTRY, "reference": "REV-1", "date": "2026-11-09"},
    )
    sent = fake.requests[-1]
    assert sent.url.path == f"/v1/ledger/journal-entries/{ENTRY}/reverse"
    assert b"entryId" not in sent.content
    assert out["reversalOf"] == ENTRY
