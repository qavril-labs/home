"""Unit tests for synthetic long-term memory mock and strict tenant filtering."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from uaap.errors import UaapError
from uaap.runtime.memory.long_term import (
    InMemoryMemoryStore,
    _cosine_similarity,
    _synthetic_embedding,
)
from uaap.runtime.memory.types import MemoryItem


def test_synthetic_embedding_deterministic() -> None:
    emb1 = _synthetic_embedding("Invoice for ACME Corp")
    emb2 = _synthetic_embedding("Invoice for ACME Corp")
    emb3 = _synthetic_embedding("Completely different text")

    assert emb1 == emb2
    assert len(emb1) == 16
    assert emb1 != emb3

    # Similarity with itself is approximately 1.0
    sim_self = _cosine_similarity(emb1, emb2)
    assert pytest.approx(sim_self, abs=1e-5) == 1.0


@pytest.mark.asyncio
async def test_memory_store_store_and_search() -> None:
    store = InMemoryMemoryStore()
    now = datetime.now(UTC)

    item1 = MemoryItem(
        item_id="mem_1",
        tenant_id="tenant_finance",
        content="Customer payment terms are Net 30 for ACME",
        metadata={"category": "billing"},
        created_at=now,
    )
    item2 = MemoryItem(
        item_id="mem_2",
        tenant_id="tenant_finance",
        content="Construction site concrete pour scheduled for Tuesday",
        metadata={"category": "operations"},
        created_at=now,
    )

    await store.store("tenant_finance", item1)
    await store.store("tenant_finance", item2)

    # Search for billing-related term
    results = await store.search("tenant_finance", "Customer payment terms and billing", top_k=2)
    assert len(results) >= 1
    # Check that item1 is returned
    found_ids = [r.item_id for r in results]
    assert "mem_1" in found_ids


@pytest.mark.asyncio
async def test_memory_store_strict_tenant_isolation() -> None:
    store = InMemoryMemoryStore()
    now = datetime.now(UTC)

    # Tenant Alpha stores confidential data
    await store.store(
        "tenant_alpha",
        MemoryItem(
            item_id="sec_1",
            tenant_id="tenant_alpha",
            content="Alpha confidential executive payroll data",
            metadata={},
            created_at=now,
        ),
    )

    # Tenant Beta stores data
    await store.store(
        "tenant_beta",
        MemoryItem(
            item_id="sec_2",
            tenant_id="tenant_beta",
            content="Beta public company holiday calendar",
            metadata={},
            created_at=now,
        ),
    )

    # Tenant Beta searches for payroll data
    beta_results = await store.search("tenant_beta", "executive payroll data")
    # Beta MUST NOT see Alpha's item
    assert all(r.tenant_id == "tenant_beta" for r in beta_results)
    assert all(r.item_id != "sec_1" for r in beta_results)


@pytest.mark.asyncio
async def test_memory_store_mismatched_tenant_on_store_rejected() -> None:
    store = InMemoryMemoryStore()
    now = datetime.now(UTC)

    item = MemoryItem(
        item_id="bad_1",
        tenant_id="tenant_victim",
        content="Fraudulent item",
        metadata={},
        created_at=now,
    )

    # Caller attempts to store under tenant_attacker while item has tenant_victim
    with pytest.raises(UaapError) as exc_info:
        await store.store("tenant_attacker", item)
    assert exc_info.value.code == "FORBIDDEN"


@pytest.mark.asyncio
async def test_memory_store_delete() -> None:
    store = InMemoryMemoryStore()
    now = datetime.now(UTC)

    item = MemoryItem(
        item_id="del_1",
        tenant_id="tenant_1",
        content="Temporary information",
        metadata={},
        created_at=now,
    )
    await store.store("tenant_1", item)

    results_before = await store.search("tenant_1", "Temporary information")
    assert len(results_before) == 1

    await store.delete("tenant_1", "del_1")
    results_after = await store.search("tenant_1", "Temporary information")
    assert len(results_after) == 0
