"""Unit tests for SessionWorkingMemory, compaction, and tenant isolation."""

from __future__ import annotations

import pytest

from uaap.errors import UaapError
from uaap.gateway.types import Message
from uaap.runtime.memory.working import SessionWorkingMemory


@pytest.mark.asyncio
async def test_working_memory_add_and_retrieve_messages() -> None:
    mem = SessionWorkingMemory("tenant_1", "run_1", max_turns=10)
    m1 = Message(role="system", content="You are an assistant.")
    m2 = Message(role="user", content="Hello!")

    await mem.add_message("tenant_1", "run_1", m1)
    await mem.add_message("tenant_1", "run_1", m2)

    msgs = await mem.get_messages("tenant_1", "run_1")
    assert len(msgs) == 2
    assert msgs[0].content == "You are an assistant."
    assert msgs[1].content == "Hello!"


@pytest.mark.asyncio
async def test_working_memory_variables() -> None:
    mem = SessionWorkingMemory("tenant_1", "run_1")
    await mem.set_variable("tenant_1", "run_1", "current_order_id", "ORD-999")
    await mem.set_variable("tenant_1", "run_1", "total_lines", 5)

    assert await mem.get_variable("tenant_1", "run_1", "current_order_id") == "ORD-999"
    assert await mem.get_variable("tenant_1", "run_1", "total_lines") == 5
    assert await mem.get_variable("tenant_1", "run_1", "non_existent") is None

    ctx = await mem.get_context("tenant_1", "run_1")
    assert ctx == {"current_order_id": "ORD-999", "total_lines": 5}


@pytest.mark.asyncio
async def test_working_memory_cross_tenant_denied() -> None:
    mem = SessionWorkingMemory("tenant_victim", "run_100")

    with pytest.raises(UaapError) as exc_info:
        await mem.get_messages("tenant_attacker", "run_100")
    assert exc_info.value.code == "FORBIDDEN"
    assert "cross-tenant" in exc_info.value.message

    with pytest.raises(UaapError) as exc_info:
        await mem.set_variable("tenant_attacker", "run_100", "key", "val")
    assert exc_info.value.code == "FORBIDDEN"


@pytest.mark.asyncio
async def test_working_memory_cross_run_denied() -> None:
    mem = SessionWorkingMemory("tenant_1", "run_100")

    with pytest.raises(UaapError) as exc_info:
        await mem.get_messages("tenant_1", "run_different")
    assert exc_info.value.code == "FORBIDDEN"


@pytest.mark.asyncio
async def test_working_memory_compaction() -> None:
    # Set small turn limit to trigger compaction
    mem = SessionWorkingMemory("tenant_1", "run_1", max_turns=6)

    # 1 system message + 7 user/assistant turns (total 8 > max_turns 6)
    await mem.add_message("tenant_1", "run_1", Message(role="system", content="System Prompt"))
    for i in range(7):
        role = "user" if i % 2 == 0 else "assistant"
        await mem.add_message("tenant_1", "run_1", Message(role=role, content=f"Turn {i}"))

    msgs = await mem.get_messages("tenant_1", "run_1")
    # Compaction preserves:
    # 1. Original system message
    # 2. Compaction summary message
    # 3. Last 6 recent turns
    assert msgs[0].role == "system"
    assert msgs[0].content == "System Prompt"
    assert "Session Compaction" in msgs[1].content
    assert msgs[-1].content == "Turn 6"
