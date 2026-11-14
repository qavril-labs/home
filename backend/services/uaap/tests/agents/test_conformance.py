"""Every agent in service must meet the agent standard. New agents are covered automatically."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from uaap.agents.base import (
    MANDATORY_ERROR_CODES,
    AgentCard,
    AgentCatalog,
    BaseAgent,
    validate_card,
)
from uaap.agents.finance import CARD, PRINCIPAL
from uaap.agents.guardrails import MANDATORY_GUARDRAILS
from uaap.api.deps import get_agent_catalog, get_tool_registry
from uaap.errors import UaapError
from uaap.tools.agents import AgentRegistry

TESTS_DIR = Path(__file__).resolve().parent.parent


def _all_test_names() -> set[str]:
    names: set[str] = set()
    for path in TESTS_DIR.rglob("test_*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and node.name.startswith("test_"):
                names.add(node.name)
    return names


SERVICE_AGENTS = get_agent_catalog().all()


def test_service_has_agents() -> None:
    assert SERVICE_AGENTS, "no agents registered"


@pytest.mark.parametrize("agent", SERVICE_AGENTS, ids=lambda a: a.card.agent_id)
def test_agent_meets_the_standard(agent: BaseAgent) -> None:
    assert isinstance(agent, BaseAgent)
    assert validate_card(agent.card, agent.principal, get_tool_registry()) == []
    assert agent.card.guardrails >= MANDATORY_GUARDRAILS
    assert agent.card.error_handling.keys() >= MANDATORY_ERROR_CODES
    assert "*" not in agent.principal.grants
    assert "<user_request>" in agent.system_prompt


@pytest.mark.parametrize("agent", SERVICE_AGENTS, ids=lambda a: a.card.agent_id)
def test_every_edge_case_names_a_real_test(agent: BaseAgent) -> None:
    existing = _all_test_names()
    missing = sorted({e.test for e in agent.card.edge_cases} - existing)
    assert missing == [], f"edge cases point at tests that do not exist: {missing}"


@pytest.mark.parametrize("agent", SERVICE_AGENTS, ids=lambda a: a.card.agent_id)
def test_agents_override_only_handle_and_formatting(agent: BaseAgent) -> None:
    # The fixed pipeline cannot be replaced by an agent.
    for name in ("respond", "_ground_reply", "ask_model", "run_tool", "approve", "error_reply"):
        assert getattr(type(agent), name) is getattr(BaseAgent, name), f"{name} must not be overridden"


def _broken(**changes: object) -> AgentCard:
    import dataclasses

    return dataclasses.replace(CARD, **changes)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("changes", "fragment"),
    [
        ({"edge_cases": CARD.edge_cases[:2]}, "edge cases"),
        ({"case_stories": ()}, "case story"),
        ({"guardrails": frozenset()}, "missing guardrails"),
        ({"error_handling": {"INTERNAL": "x"}}, "missing error handling"),
        ({"error_handling": {**CARD.error_handling, "INTERNAL": "Retry in 5 minutes"}}, "no figures"),
        ({"use_cases": CARD.use_cases[1:]}, "no use case documents it"),
        ({"kpis": ()}, "KPI"),
        ({"out_of_scope": ()}, "out_of_scope"),
    ],
)
def test_catalog_refuses_incomplete_cards(changes: dict[str, object], fragment: str) -> None:
    problems = validate_card(_broken(**changes), PRINCIPAL, get_tool_registry())
    assert any(fragment in p for p in problems), problems


def test_card_tier_must_match_registry() -> None:
    import dataclasses

    wrong = dataclasses.replace(CARD.use_cases[1], tier=1)
    problems = validate_card(
        _broken(use_cases=(CARD.use_cases[0], wrong, *CARD.use_cases[2:])), PRINCIPAL, get_tool_registry()
    )
    assert any("Tier 1" in p for p in problems)


def test_catalog_add_raises_for_bad_card() -> None:
    class Bad(BaseAgent):
        card = _broken(case_stories=())
        principal = PRINCIPAL
        system_prompt = "<user_request>"

        async def _handle(self, caller, inp, trace):
            raise AssertionError

    catalog = AgentCatalog(AgentRegistry(), get_tool_registry())
    with pytest.raises(UaapError) as exc:
        catalog.add(Bad(model=None, runner=None))  # type: ignore[arg-type]
    assert exc.value.code == "VALIDATION"
    assert catalog.registry.get(PRINCIPAL.agent_id) is None
