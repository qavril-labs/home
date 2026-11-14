"""Unit tests for InMemoryCheckpointStore and LangGraphCheckpointSaverAdapter."""

from __future__ import annotations

import pytest

from uaap.errors import UaapError
from uaap.runtime.checkpointer.adapter import LangGraphCheckpointSaverAdapter
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore


@pytest.mark.asyncio
async def test_checkpoint_store_put_get_latest() -> None:
    store = InMemoryCheckpointStore()
    tenant_id = "tenant_test"
    run_id = "run_101"

    # Put step 1
    await store.put(
        tenant_id,
        run_id,
        "chk_1",
        {"step": 1, "value": "first"},
        {"source": "init"},
    )
    # Put step 2
    await store.put(
        tenant_id,
        run_id,
        "chk_2",
        {"step": 2, "value": "second"},
        {"source": "reason"},
    )

    # Specific get
    chk1 = await store.get(tenant_id, run_id, "chk_1")
    assert chk1 is not None
    assert chk1.state["step"] == 1

    # Latest get (checkpoint_id=None)
    latest = await store.get(tenant_id, run_id)
    assert latest is not None
    assert latest.checkpoint_id == "chk_2"
    assert latest.state["step"] == 2


@pytest.mark.asyncio
async def test_checkpoint_store_json_serialization_guard() -> None:
    store = InMemoryCheckpointStore()

    class NonSerializable:
        pass

    with pytest.raises(UaapError) as exc_info:
        await store.put(
            "tenant_test",
            "run_non_ser",
            "chk_bad",
            {"obj": NonSerializable()},
            {},
        )
    assert exc_info.value.code == "VALIDATION"
    assert "not JSON serializable" in exc_info.value.message


@pytest.mark.asyncio
async def test_checkpoint_store_list_and_pagination() -> None:
    store = InMemoryCheckpointStore()
    tenant_id = "tenant_pag"
    run_id = "run_pag"

    for i in range(1, 6):
        await store.put(
            tenant_id,
            run_id,
            f"chk_{i}",
            {"step": i},
            {"idx": i},
        )

    all_records = await store.list(tenant_id, run_id)
    assert len(all_records) == 5

    # With limit
    limited = await store.list(tenant_id, run_id, limit=2)
    assert len(limited) == 2

    # With before
    before_chk3 = await store.list(tenant_id, run_id, before="chk_3")
    assert all(r.checkpoint_id != "chk_3" for r in before_chk3)


@pytest.mark.asyncio
async def test_checkpoint_store_tenant_run_isolation() -> None:
    store = InMemoryCheckpointStore()
    await store.put("tenant_A", "run_1", "chk_1", {"data": "secret_A"}, {})
    await store.put("tenant_B", "run_1", "chk_1", {"data": "secret_B"}, {})

    # Tenant A sees only Tenant A data
    rec_a = await store.get("tenant_A", "run_1", "chk_1")
    assert rec_a is not None
    assert rec_a.state["data"] == "secret_A"

    # Tenant B sees only Tenant B data
    rec_b = await store.get("tenant_B", "run_1", "chk_1")
    assert rec_b is not None
    assert rec_b.state["data"] == "secret_B"

    # Tenant C sees nothing
    rec_c = await store.get("tenant_C", "run_1", "chk_1")
    assert rec_c is None

    list_c = await store.list("tenant_C", "run_1")
    assert len(list_c) == 0


@pytest.mark.asyncio
async def test_checkpoint_store_delete() -> None:
    store = InMemoryCheckpointStore()
    await store.put("tenant_A", "run_del", "chk_1", {"step": 1}, {})
    assert await store.get("tenant_A", "run_del", "chk_1") is not None

    await store.delete("tenant_A", "run_del")
    assert await store.get("tenant_A", "run_del", "chk_1") is None


@pytest.mark.asyncio
async def test_langgraph_adapter_roundtrip() -> None:
    store = InMemoryCheckpointStore()
    adapter = LangGraphCheckpointSaverAdapter(store, trusted_tenant_id="tenant_lg")

    config = {"configurable": {"thread_id": "tenant_lg:run_lg"}}
    checkpoint = {
        "v": 1,
        "ts": "2026-11-06T00:00:00Z",
        "id": "chk_lg_1",
        "channel_values": {"messages": ["hello"]},
        "channel_versions": {"messages": 1},
        "versions_seen": {},
    }
    metadata = {"step": 1, "source": "input"}

    # aput
    next_config = await adapter.aput(config, checkpoint, metadata, {})  # type: ignore[arg-type]
    assert next_config["configurable"]["checkpoint_id"] == "chk_lg_1"

    # aget_tuple
    tuple_res = await adapter.aget_tuple(next_config)
    assert tuple_res is not None
    assert tuple_res.checkpoint["id"] == "chk_lg_1"
    assert tuple_res.metadata["step"] == 1

    # aput_writes
    await adapter.aput_writes(next_config, [("channel_1", "write_1")], "task_abc")
    tuple_with_writes = await adapter.aget_tuple(next_config)
    assert tuple_with_writes is not None
    assert tuple_with_writes.pending_writes is not None
    assert len(tuple_with_writes.pending_writes) == 1
    assert tuple_with_writes.pending_writes[0] == ("task_abc", "channel_1", "write_1")


@pytest.mark.asyncio
async def test_langgraph_adapter_cross_tenant_denied() -> None:
    store = InMemoryCheckpointStore()
    adapter = LangGraphCheckpointSaverAdapter(store, trusted_tenant_id="tenant_trusted")

    # Caller tries to access another tenant's thread
    bad_config = {"configurable": {"thread_id": "tenant_attacker:run_victim"}}
    with pytest.raises(UaapError) as exc_info:
        await adapter.aget_tuple(bad_config)  # type: ignore[arg-type]
    assert exc_info.value.code == "FORBIDDEN"
    assert "Cross-tenant checkpoint access denied" in exc_info.value.message
