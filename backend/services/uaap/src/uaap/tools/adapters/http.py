"""Shared HTTP plumbing for product adapters: typed error mapping and safe response handling."""

from __future__ import annotations

from typing import Any

import httpx

from uaap.errors import UaapError

_STATUS_CODES: dict[int, str] = {
    400: "VALIDATION",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION",
    429: "RATE_LIMITED",
}


def _product_error_code(response: httpx.Response) -> str | None:
    """Keep only the product's error code; the rest of the body is never copied into UAAP errors."""
    try:
        body = response.json()
    except ValueError:
        return None
    if isinstance(body, dict) and isinstance(body.get("error"), dict):
        code = body["error"].get("code")
        if isinstance(code, str) and len(code) <= 64:
            return code
    return None


def map_response(product_id: str, response: httpx.Response) -> dict[str, Any]:
    if response.is_success:
        try:
            body = response.json()
        except ValueError as exc:
            raise UaapError(
                "UPSTREAM_INVALID_RESPONSE", f"{product_id} returned a non-JSON body", {"product": product_id}
            ) from exc
        if not isinstance(body, dict):
            raise UaapError(
                "UPSTREAM_INVALID_RESPONSE",
                f"{product_id} returned a non-object body",
                {"product": product_id},
            )
        return body

    details: dict[str, Any] = {"product": product_id, "status": response.status_code}
    product_code = _product_error_code(response)
    if product_code:
        details["product_code"] = product_code
    code = _STATUS_CODES.get(response.status_code, "UPSTREAM_FAILED")
    raise UaapError(code, f"{product_id} rejected the request ({response.status_code})", details)


async def send(
    product_id: str,
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    headers: dict[str, str],
    params: dict[str, str] | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        response = await client.request(method, path, headers=headers, params=params, json=json_body)
    except httpx.TimeoutException as exc:
        raise UaapError("UPSTREAM_TIMEOUT", f"{product_id} timed out", {"product": product_id}) from exc
    except httpx.HTTPError as exc:
        raise UaapError(
            "UPSTREAM_FAILED",
            f"{product_id} could not be reached",
            {"product": product_id, "error_class": type(exc).__name__},
        ) from exc
    return map_response(product_id, response)
