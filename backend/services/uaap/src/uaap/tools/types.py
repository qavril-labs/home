"""Tool contracts shared by the registry, the executor and product adapters."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import SecretStr

from uaap.runtime.state import compute_payload_hash

MIN_TIER = 1
MAX_TIER = 5
BLOCKED_TIER = 5
APPROVAL_TIER = 3
DRAFT_TIER = 2


@dataclass(frozen=True)
class ToolDefinition:
    """A registered tool. The tier is part of the contract and is enforced in code, not by prompt."""

    name: str
    description: str
    product_id: str
    tier: int
    permission: str  # Product permission string, for example "fin.report.read"
    input_schema: dict[str, Any]
    output_schema: dict[str, Any] | None = None
    version: str = "1"
    timeout_seconds: float = 15.0


@dataclass(frozen=True)
class CallerContext:
    """Trusted caller identity. Permissions come from the product (`/v1/me`), never from the client.

    The token is held only for the duration of a call and is never written to checkpoints or audit.
    """

    tenant_id: str
    actor_id: str
    permissions: tuple[str, ...]
    token: SecretStr
    request_id: str
    agent_id: str | None = None
    run_id: str | None = None


@dataclass(frozen=True)
class ToolCall:
    tool_name: str
    arguments: dict[str, Any] = field(default_factory=dict)
    idempotency_key: str | None = None

    def approval_payload(self) -> dict[str, Any]:
        """The exact payload an approver signs off. Its hash binds the approval to this call."""
        return {
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "idempotency_key": self.idempotency_key,
        }

    @property
    def payload_hash(self) -> str:
        return compute_payload_hash(self.approval_payload())

    @staticmethod
    def from_payload(payload: dict[str, Any]) -> ToolCall:
        arguments = payload.get("arguments") or {}
        if not isinstance(arguments, dict):
            arguments = {}
        key = payload.get("idempotency_key")
        return ToolCall(
            tool_name=str(payload.get("tool_name", "")),
            arguments=arguments,
            idempotency_key=str(key) if key is not None else None,
        )


@dataclass(frozen=True)
class ToolResult:
    tool_name: str
    tier: int
    output: dict[str, Any]
    is_ai_draft: bool = False
    replayed: bool = False


ToolHandler = Callable[[CallerContext, dict[str, Any]], Awaitable[dict[str, Any]]]
