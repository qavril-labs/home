"""Session-scoped working memory with tenant and run isolation and safe context compaction."""

from __future__ import annotations

import asyncio
from typing import Any

from uaap.errors import UaapError
from uaap.gateway.types import Message


class SessionWorkingMemory:
    """Manages ephemeral working context for a single (tenant_id, run_id) execution."""

    def __init__(self, tenant_id: str, run_id: str, max_turns: int = 20) -> None:
        if not tenant_id or not run_id:
            raise UaapError("VALIDATION", "tenant_id and run_id are required for working memory")
        self.tenant_id = tenant_id
        self.run_id = run_id
        self.max_turns = max_turns
        self._messages: list[Message] = []
        self._variables: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def add_message(self, tenant_id: str, run_id: str, message: Message) -> None:
        self._validate_scope(tenant_id, run_id)
        async with self._lock:
            self._messages.append(message)
            if len(self._messages) > self.max_turns:
                self._compact_locked()

    async def get_messages(self, tenant_id: str, run_id: str) -> tuple[Message, ...]:
        self._validate_scope(tenant_id, run_id)
        async with self._lock:
            return tuple(self._messages)

    async def set_variable(self, tenant_id: str, run_id: str, key: str, value: Any) -> None:
        self._validate_scope(tenant_id, run_id)
        async with self._lock:
            self._variables[key] = value

    async def get_variable(self, tenant_id: str, run_id: str, key: str) -> Any | None:
        self._validate_scope(tenant_id, run_id)
        async with self._lock:
            return self._variables.get(key)

    async def get_context(self, tenant_id: str, run_id: str) -> dict[str, Any]:
        self._validate_scope(tenant_id, run_id)
        async with self._lock:
            return dict(self._variables)

    def _compact_locked(self, keep_recent: int = 6) -> None:
        """Deterministic context compaction preserving system instructions and recent turns."""
        if len(self._messages) <= keep_recent:
            return

        # Separate initial system message if present
        system_msgs = [m for m in self._messages[:1] if m.role == "system"]
        rest = self._messages[len(system_msgs) :]

        if len(rest) <= keep_recent:
            return

        older = rest[:-keep_recent]
        recent = rest[-keep_recent:]

        compacted_summary = (
            f"[Session Compaction: {len(older)} earlier turns compacted for tenant {self.tenant_id}]"
        )
        summary_msg = Message(role="system", content=compacted_summary)

        self._messages = [*system_msgs, summary_msg, *recent]

    def _validate_scope(self, tenant_id: str, run_id: str) -> None:
        if tenant_id != self.tenant_id or run_id != self.run_id:
            raise UaapError(
                "FORBIDDEN",
                "Working memory cross-tenant or cross-run access denied",
                {
                    "requested_tenant": tenant_id,
                    "target_tenant": self.tenant_id,
                    "requested_run": run_id,
                    "target_run": self.run_id,
                },
            )
