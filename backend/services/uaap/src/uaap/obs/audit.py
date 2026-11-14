"""Audit-event interface.

A2 ships an in-memory sink; a persistent append-only sink arrives with the database milestone.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class AuditEvent:
    at: datetime
    request_id: str
    tenant_id: str | None
    actor_id: str | None
    action: str  # e.g. model.chat, auth.denied
    outcome: str  # success | denied | failed | quota_exceeded
    model: str | None = None
    prompt_hash: str | None = None  # sha256 of messages; raw prompts are never stored
    prompt_tokens: int = 0
    completion_tokens: int = 0
    error_code: str | None = None
    # Tool-call fields (A4). Arguments are recorded as a hash only, like prompts.
    agent_id: str | None = None
    run_id: str | None = None
    tool_name: str | None = None
    tier: int | None = None
    payload_hash: str | None = None
    approval_id: str | None = None
    latency_ms: int | None = None


class AuditSink(Protocol):
    def emit(self, event: AuditEvent) -> None: ...


class InMemoryAuditSink:
    def __init__(self) -> None:
        self._events: list[AuditEvent] = []
        self._lock = threading.Lock()

    def emit(self, event: AuditEvent) -> None:
        with self._lock:
            self._events.append(event)

    @property
    def events(self) -> list[AuditEvent]:
        with self._lock:
            return list(self._events)
