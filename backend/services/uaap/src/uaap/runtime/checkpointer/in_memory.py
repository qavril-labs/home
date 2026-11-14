"""Thread-safe in-memory implementation of the UAAP CheckpointStore protocol."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

from uaap.errors import UaapError
from uaap.runtime.checkpointer.base import CheckpointRecord, CheckpointStore


class InMemoryCheckpointStore(CheckpointStore):
    """Concurrency-safe in-memory checkpoint store strictly partitioned by (tenant_id, run_id)."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        # Storage keyed by (tenant_id, run_id, checkpoint_id)
        self._records: dict[tuple[str, str, str], CheckpointRecord] = {}

    def _validate_serializable(self, state: dict[str, Any], metadata: dict[str, Any]) -> None:
        try:
            json.dumps(state)
            json.dumps(metadata)
        except (TypeError, ValueError) as exc:
            raise UaapError(
                "VALIDATION",
                f"Checkpoint state or metadata is not JSON serializable: {exc}",
                {"details": str(exc)},
            ) from exc

    async def put(
        self,
        tenant_id: str,
        run_id: str,
        checkpoint_id: str,
        state: dict[str, Any],
        metadata: dict[str, Any],
    ) -> None:
        if not tenant_id or not run_id or not checkpoint_id:
            raise UaapError("VALIDATION", "tenant_id, run_id, and checkpoint_id must be non-empty")

        self._validate_serializable(state, metadata)
        record = CheckpointRecord(
            tenant_id=tenant_id,
            run_id=run_id,
            checkpoint_id=checkpoint_id,
            state=state,
            metadata=metadata,
            created_at=datetime.now(UTC),
        )

        async with self._lock:
            self._records[(tenant_id, run_id, checkpoint_id)] = record

    async def get(
        self,
        tenant_id: str,
        run_id: str,
        checkpoint_id: str | None = None,
    ) -> CheckpointRecord | None:
        if not tenant_id or not run_id:
            raise UaapError("VALIDATION", "tenant_id and run_id must be non-empty")

        async with self._lock:
            if checkpoint_id is not None:
                return self._records.get((tenant_id, run_id, checkpoint_id))

            # Retrieve latest checkpoint for (tenant_id, run_id)
            matching = [rec for (t, r, _), rec in self._records.items() if t == tenant_id and r == run_id]
            if not matching:
                return None
            matching.sort(key=lambda r: r.created_at, reverse=True)
            return matching[0]

    async def list(
        self,
        tenant_id: str,
        run_id: str,
        *,
        before: str | None = None,
        limit: int | None = None,
    ) -> list[CheckpointRecord]:
        if not tenant_id or not run_id:
            raise UaapError("VALIDATION", "tenant_id and run_id must be non-empty")

        async with self._lock:
            matching = [rec for (t, r, _), rec in self._records.items() if t == tenant_id and r == run_id]
            matching.sort(key=lambda r: r.created_at, reverse=True)

            if before is not None:
                idx = next((i for i, r in enumerate(matching) if r.checkpoint_id == before), None)
                if idx is not None:
                    matching = matching[idx + 1 :]

            if limit is not None and limit > 0:
                matching = matching[:limit]

            return matching

    async def delete(
        self,
        tenant_id: str,
        run_id: str,
    ) -> None:
        if not tenant_id or not run_id:
            raise UaapError("VALIDATION", "tenant_id and run_id must be non-empty")

        async with self._lock:
            keys_to_delete = [key for key in self._records if key[0] == tenant_id and key[1] == run_id]
            for key in keys_to_delete:
                del self._records[key]

    async def clear_all(self) -> None:
        """Test helper to reset in-memory state."""
        async with self._lock:
            self._records.clear()
