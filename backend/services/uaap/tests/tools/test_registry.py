"""Registry contracts, tier rules, agent principals and permission matching."""

from __future__ import annotations

from typing import Any

import pytest

from uaap.errors import UaapError
from uaap.tools.agents import AgentPrincipal, AgentRegistry
from uaap.tools.permissions import effective_allows, has_permission
from uaap.tools.registry import ToolRegistry
from uaap.tools.types import CallerContext, ToolDefinition


async def _noop(ctx: CallerContext, args: dict[str, Any]) -> dict[str, Any]:
    return {}


def _definition(**overrides: Any) -> ToolDefinition:
    values: dict[str, Any] = {
        "name": "demo_read",
        "description": "Demo",
        "product_id": "demo",
        "tier": 1,
        "permission": "demo.read",
        "input_schema": {"type": "object"},
    }
    values.update(overrides)
    return ToolDefinition(**values)


def test_permission_wildcards_match_core_rules() -> None:
    assert has_permission(["*"], "fin.journal.post")
    assert has_permission(["fin.*"], "fin.journal.post")
    assert has_permission(["fin.journal.post"], "fin.journal.post")
    assert not has_permission(["fin.journal"], "fin.journal.post")
    assert not has_permission(["fin.*"], "finance.report")
    assert not has_permission(["sal.*"], "fin.report.read")
    assert not has_permission([], "fin.report.read")


def test_user_wildcard_does_not_widen_agent_grants() -> None:
    assert not effective_allows(["fin.report.read"], ["*"], "fin.journal.post")
    assert effective_allows(["fin.report.read"], ["*"], "fin.report.read")
    assert not effective_allows(["fin.*"], ["fin.report.read"], "fin.journal.post")


def test_register_rejects_bad_contracts() -> None:
    registry = ToolRegistry()
    with pytest.raises(UaapError, match="invalid input schema"):
        registry.register(_definition(input_schema={"type": "not-a-type"}), _noop)
    with pytest.raises(UaapError, match="JSON object"):
        registry.register(_definition(input_schema={"type": "array"}), _noop)
    with pytest.raises(UaapError, match="tier must be 1 to 5"):
        registry.register(_definition(tier=6), _noop)
    with pytest.raises(UaapError, match="Invalid tool name"):
        registry.register(_definition(name="Bad Name"), _noop)
    with pytest.raises(UaapError, match="needs an executor"):
        registry.register(_definition(), None)
    with pytest.raises(UaapError, match="permission"):
        registry.register(_definition(permission=""), _noop)


def test_tier_5_cannot_have_an_executor() -> None:
    registry = ToolRegistry()
    with pytest.raises(UaapError, match="Tier 5"):
        registry.register(_definition(name="sql_execute_raw", tier=5), _noop)
    registry.register(_definition(name="sql_execute_raw", tier=5), None)
    tool = registry.get("sql_execute_raw")
    assert tool is not None and tool.blocked


def test_duplicate_registration_rejected() -> None:
    registry = ToolRegistry()
    registry.register(_definition(), _noop)
    with pytest.raises(UaapError, match="already registered"):
        registry.register(_definition(), _noop)


def test_unknown_tool_is_tier_5() -> None:
    assert ToolRegistry().effective_tier("t1", "does_not_exist") == 5


def test_tenant_tier_can_only_be_raised() -> None:
    registry = ToolRegistry()
    registry.register(_definition(tier=2), _noop)
    registry.set_tenant_tier("t1", "demo_read", 3)
    assert registry.effective_tier("t1", "demo_read") == 3
    assert registry.effective_tier("t2", "demo_read") == 2
    with pytest.raises(UaapError) as exc:
        registry.set_tenant_tier("t1", "demo_read", 2)
    assert exc.value.code == "FORBIDDEN"
    with pytest.raises(UaapError) as exc:
        registry.set_tenant_tier("t2", "demo_read", 1)
    assert exc.value.code == "FORBIDDEN"


def test_agents_cannot_hold_full_wildcard() -> None:
    agents = AgentRegistry()
    with pytest.raises(UaapError, match="'\\*'"):
        agents.register(AgentPrincipal("greedy-agent", "Greedy", frozenset({"*"}), frozenset()))


def test_agent_kill_switch() -> None:
    agents = AgentRegistry()
    agents.register(AgentPrincipal("finance-agent", "Finance", frozenset({"fin.report.read"}), frozenset()))
    agents.disable("finance-agent")
    agent = agents.get("finance-agent")
    assert agent is not None and not agent.enabled
    assert agent.principal == "agent:finance-agent"
