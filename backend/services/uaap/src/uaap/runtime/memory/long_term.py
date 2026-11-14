"""Synthetic in-memory long-term memory mock for protocol and isolation testing.

NOTE: This is synthetic test functionality only. No production semantic search or pgvector is claimed.
"""

from __future__ import annotations

import asyncio
import hashlib
import math
from typing import Protocol

from uaap.errors import UaapError
from uaap.runtime.memory.types import MemoryItem


def _synthetic_embedding(text: str, dim: int = 16) -> list[float]:
    """Deterministic pseudo-embedding for testing from text hash bytes."""
    if not text:
        return [0.0] * dim
    h = hashlib.sha256(text.encode("utf-8")).digest()
    # Map first dim bytes to floats between -1.0 and 1.0
    vec = [(b / 128.0) - 1.0 for b in h[:dim]]
    # Normalize to unit length
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return [0.0] * dim
    return [x / norm for x in vec]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    return sum(x * y for x, y in zip(a, b, strict=True))


class LongTermMemoryStore(Protocol):
    async def search(self, tenant_id: str, query: str, top_k: int = 5) -> list[MemoryItem]: ...
    async def store(self, tenant_id: str, item: MemoryItem) -> None: ...
    async def delete(self, tenant_id: str, item_id: str) -> None: ...


class InMemoryMemoryStore(LongTermMemoryStore):
    """Synthetic test implementation enforcing strict tenant isolation on all operations."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        # Storage keyed by (tenant_id, item_id)
        self._items: dict[tuple[str, str], MemoryItem] = {}

    async def store(self, tenant_id: str, item: MemoryItem) -> None:
        if not tenant_id or item.tenant_id != tenant_id:
            raise UaapError("FORBIDDEN", "Memory item tenant does not match authorized context")

        # Generate synthetic embedding if not already provided
        embedding = item.embedding or _synthetic_embedding(item.content)
        stored_item = MemoryItem(
            item_id=item.item_id,
            tenant_id=tenant_id,
            content=item.content,
            metadata=item.metadata,
            embedding=embedding,
            created_at=item.created_at,
        )

        async with self._lock:
            self._items[(tenant_id, item.item_id)] = stored_item

    async def search(self, tenant_id: str, query: str, top_k: int = 5) -> list[MemoryItem]:
        if not tenant_id:
            raise UaapError("VALIDATION", "tenant_id is required for memory search")

        if not query.strip():
            return []

        query_emb = _synthetic_embedding(query)

        async with self._lock:
            # Enforce tenant filter: strictly items belonging to tenant_id
            tenant_items = [
                item for (t, _), item in self._items.items() if t == tenant_id and item.embedding is not None
            ]

            scored: list[tuple[float, MemoryItem]] = []
            for item in tenant_items:
                if item.embedding is not None:
                    sim = _cosine_similarity(query_emb, item.embedding)
                    scored.append((sim, item))

            # Sort descending by score, deterministic tie-break by item_id
            scored.sort(key=lambda pair: (pair[0], pair[1].item_id), reverse=True)
            return [item for _, item in scored[:top_k]]

    async def delete(self, tenant_id: str, item_id: str) -> None:
        if not tenant_id or not item_id:
            raise UaapError("VALIDATION", "tenant_id and item_id are required for memory deletion")

        async with self._lock:
            key = (tenant_id, item_id)
            if key in self._items:
                del self._items[key]

    async def clear_all(self) -> None:
        async with self._lock:
            self._items.clear()
