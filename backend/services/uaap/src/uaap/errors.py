"""Typed errors and the standard UAAP error envelope: {"error": {"code", "message", "details"}}."""

from __future__ import annotations

from typing import Any

HTTP_STATUS: dict[str, int] = {
    "UNAUTHENTICATED": 401,
    "FORBIDDEN": 403,
    "VALIDATION": 400,
    "NOT_FOUND": 404,
    "CONFLICT": 409,
    "IDEMPOTENCY_CONFLICT": 409,
    "APPROVAL_REQUIRED": 409,
    "APPROVAL_ALREADY_CONSUMED": 409,
    "APPROVAL_EXPIRED": 410,
    "TOOL_BLOCKED": 403,
    "RATE_LIMITED": 429,
    "QUOTA_EXCEEDED": 429,
    "UPSTREAM_FAILED": 502,
    "UPSTREAM_INVALID_RESPONSE": 502,
    "UPSTREAM_TIMEOUT": 504,
    "SERVICE_UNAVAILABLE": 503,
    "INTERNAL": 500,
}


class UaapError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}

    @property
    def http_status(self) -> int:
        return HTTP_STATUS.get(self.code, 500)


class ProviderError(Exception):
    """Failure reported by a provider adapter. Messages are safe (no bodies, no secrets)."""

    def __init__(
        self,
        kind: str,
        message: str,
        *,
        status_code: int | None = None,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message)
        # kind: timeout | network | rate_limited | server | malformed | auth | rejected | not_found
        self.kind = kind
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after

    @property
    def retryable(self) -> bool:
        return self.kind in {"timeout", "network", "rate_limited", "server", "malformed"}

    @property
    def allows_fallback(self) -> bool:
        # Credential problems and caller errors would fail identically on every model.
        return self.kind not in {"auth", "rejected"}


def envelope(
    code: str,
    message: str,
    request_id: str | None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": request_id,
        }
    }
