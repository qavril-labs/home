"""Memory type definitions for working and long-term memory."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass(frozen=True)
class MemoryItem:
    item_id: str
    tenant_id: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
