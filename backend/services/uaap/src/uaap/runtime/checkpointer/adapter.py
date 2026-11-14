"""LangGraphCheckpointSaverAdapter bridging LangGraph BaseCheckpointSaver to UAAP CheckpointStore."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    PendingWrite,
)

from uaap.errors import UaapError
from uaap.runtime.checkpointer.base import CheckpointStore


class LangGraphCheckpointSaverAdapter(BaseCheckpointSaver[Any]):
    """Adapter bridging LangGraph BaseCheckpointSaver to the UAAP-owned CheckpointStore.

    Enforces server-side trusted tenant ownership validation on every checkpoint operation.
    """

    def __init__(
        self,
        checkpoint_store: CheckpointStore,
        *,
        trusted_tenant_id: str | None = None,
    ) -> None:
        super().__init__()
        self._store = checkpoint_store
        self._trusted_tenant_id = trusted_tenant_id
        # In-memory storage for pending writes: (tenant_id, run_id, checkpoint_id) -> list[PendingWrite]
        self._pending_writes: dict[tuple[str, str, str], list[PendingWrite]] = {}
        self._lock = asyncio.Lock()

    def _resolve_scope(self, config: RunnableConfig) -> tuple[str, str]:
        """Resolve and validate (tenant_id, run_id) from trusted context and config."""
        configurable = config.get("configurable", {})
        thread_id = configurable.get("thread_id", "")
        if not thread_id:
            raise UaapError("VALIDATION", "Missing required thread_id in LangGraph config")

        # thread_id format is "{tenant_id}:{run_id}" or standalone run_id when trusted_tenant_id is provided
        if ":" in thread_id:
            tenant_from_thread, run_id = thread_id.split(":", 1)
        else:
            tenant_from_thread = ""
            run_id = thread_id

        tenant_id = self._trusted_tenant_id or tenant_from_thread
        if not tenant_id:
            raise UaapError("FORBIDDEN", "Tenant identity could not be established for checkpoint operation")

        if self._trusted_tenant_id and tenant_from_thread and self._trusted_tenant_id != tenant_from_thread:
            raise UaapError(
                "FORBIDDEN",
                "Cross-tenant checkpoint access denied: thread_id does not match trusted tenant context",
                {"trusted_tenant": self._trusted_tenant_id, "thread_tenant": tenant_from_thread},
            )

        return tenant_id, run_id

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        tenant_id, run_id = self._resolve_scope(config)
        checkpoint_id = checkpoint.get("id") or str(config.get("configurable", {}).get("checkpoint_id", ""))
        if not checkpoint_id:
            checkpoint_id = f"chk_{int(asyncio.get_event_loop().time() * 1000)}"

        # Store serialized checkpoint via internal UAAP CheckpointStore
        await self._store.put(tenant_id, run_id, checkpoint_id, dict(checkpoint), dict(metadata))

        return {
            "configurable": {
                "thread_id": f"{tenant_id}:{run_id}",
                "checkpoint_id": checkpoint_id,
            }
        }

    async def aget_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        tenant_id, run_id = self._resolve_scope(config)
        checkpoint_id = config.get("configurable", {}).get("checkpoint_id")

        record = await self._store.get(tenant_id, run_id, checkpoint_id)
        if record is None:
            return None

        # Guard: If record is not a valid LangGraph checkpoint (e.g. initial run metadata),
        # return None so LangGraph starts fresh execution.
        if "channel_values" not in record.state or "v" not in record.state:
            return None

        # Retrieve pending writes if present
        async with self._lock:
            writes = list(self._pending_writes.get((tenant_id, run_id, record.checkpoint_id), []))

        return CheckpointTuple(
            config={
                "configurable": {
                    "thread_id": f"{tenant_id}:{run_id}",
                    "checkpoint_id": record.checkpoint_id,
                }
            },
            checkpoint=record.state,  # type: ignore[arg-type]
            metadata=record.metadata,  # type: ignore[arg-type]
            parent_config=None,
            pending_writes=writes if writes else None,
        )

    async def alist(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> AsyncIterator[CheckpointTuple]:
        if config is None:
            return

        tenant_id, run_id = self._resolve_scope(config)
        before_id = before.get("configurable", {}).get("checkpoint_id") if before else None

        records = await self._store.list(tenant_id, run_id, before=before_id, limit=limit)
        for record in records:
            if "channel_values" not in record.state or "v" not in record.state:
                continue
            async with self._lock:
                writes = list(self._pending_writes.get((tenant_id, run_id, record.checkpoint_id), []))

            yield CheckpointTuple(
                config={
                    "configurable": {
                        "thread_id": f"{tenant_id}:{run_id}",
                        "checkpoint_id": record.checkpoint_id,
                    }
                },
                checkpoint=record.state,  # type: ignore[arg-type]
                metadata=record.metadata,  # type: ignore[arg-type]
                parent_config=None,
                pending_writes=writes if writes else None,
            )

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        tenant_id, run_id = self._resolve_scope(config)
        checkpoint_id = config.get("configurable", {}).get("checkpoint_id", "default")
        async with self._lock:
            key = (tenant_id, run_id, checkpoint_id)
            if key not in self._pending_writes:
                self._pending_writes[key] = []
            for channel, value in writes:
                self._pending_writes[key].append((task_id, channel, value))

    # Synchronous adapter implementations
    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        return asyncio.run(self.aput(config, checkpoint, metadata, new_versions))

    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        return asyncio.run(self.aget_tuple(config))

    def list(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        async def _collect() -> list[CheckpointTuple]:
            results: list[CheckpointTuple] = []
            async for item in self.alist(config, filter=filter, before=before, limit=limit):
                results.append(item)
            return results

        items = asyncio.run(_collect())
        return iter(items)

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        asyncio.run(self.aput_writes(config, writes, task_id, task_path))
