"""UAAP-owned internal CheckpointStore protocol and records.

Independent of LangGraph framework boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True)
class CheckpointRecord:
    tenant_id: str
    run_id: str
    checkpoint_id: str
    state: dict[str, Any]
    metadata: dict[str, Any]
    created_at: datetime


class CheckpointStore(Protocol):
    """UAAP internal storage contract. Enforces tenant and run boundaries on all operations."""

    async def put(
        self,
        tenant_id: str,
        run_id: str,
        checkpoint_id: str,
        state: dict[str, Any],
        metadata: dict[str, Any],
    ) -> None:
        """Store a checkpoint record. Validates JSON-serializability and tenant ownership."""
        ...

    async def get(
        self,
        tenant_id: str,
        run_id: str,
        checkpoint_id: str | None = None,
    ) -> CheckpointRecord | None:
        """Retrieve a specific checkpoint or the latest checkpoint for the run."""
        ...

    async def list(
        self,
        tenant_id: str,
        run_id: str,
        *,
        before: str | None = None,
        limit: int | None = None,
    ) -> list[CheckpointRecord]:
        """List checkpoint history for a specific run in reverse chronological order."""
        ...

    async def delete(
        self,
        tenant_id: str,
        run_id: str,
    ) -> None:
        """Delete all checkpoints for a specific run belonging to the tenant."""
        ...
