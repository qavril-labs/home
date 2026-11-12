"""Idempotency keys for tool calls, scoped per tenant and tool and bound to the argument hash."""

from __future__ import annotations

import threading
from dataclasses import dataclass

from uaap.errors import UaapError
from uaap.tools.types import ToolResult


@dataclass(frozen=True)
class _Entry:
    arguments_hash: str
    result: ToolResult


class InMemoryIdempotencyStore:
    def __init__(self) -> None:
        self._entries: dict[tuple[str, str, str], _Entry] = {}
        self._lock = threading.Lock()

    def lookup(self, tenant_id: str, tool_name: str, key: str, arguments_hash: str) -> ToolResult | None:
        with self._lock:
            entry = self._entries.get((tenant_id, tool_name, key))
        if entry is None:
            return None
        if entry.arguments_hash != arguments_hash:
            raise UaapError(
                "IDEMPOTENCY_CONFLICT",
                "Idempotency key was already used with different arguments",
                {"tool_name": tool_name},
            )
        return entry.result

    def store(
        self, tenant_id: str, tool_name: str, key: str, arguments_hash: str, result: ToolResult
    ) -> None:
        with self._lock:
            self._entries.setdefault((tenant_id, tool_name, key), _Entry(arguments_hash, result))
