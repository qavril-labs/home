"""Tests for ModelRegistry and capability Router."""

import pytest

from uaap.errors import UaapError
from uaap.gateway.registry import DEFAULT_TEST_MODELS, ModelRegistry, Router


def test_registry_lookups():
    reg = ModelRegistry()
    assert len(reg) == len(DEFAULT_TEST_MODELS)
    fast = reg.get("test-model-fast")
    assert fast is not None
    assert fast.cost_tier == 1
    assert "text" in fast.capabilities


def test_router_capability_planning():
    reg = ModelRegistry()
    router = Router(reg)

    # Text capability should select cheapest capable model first
    plan = router.plan(required=frozenset({"text"}))
    assert plan[0].id == "test-model-fast"

    # Vision capability should select test-model-vision
    vision_plan = router.plan(required=frozenset({"vision"}))
    assert vision_plan[0].id == "test-model-vision"

    # Reasoning capability
    reasoning_plan = router.plan(required=frozenset({"reasoning"}))
    assert reasoning_plan[0].id == "test-model-reasoning"


def test_router_preferred_model():
    reg = ModelRegistry()
    router = Router(reg)

    plan = router.plan(required=frozenset({"text"}), preferred="test-model-reasoning")
    assert plan[0].id == "test-model-reasoning"


def test_router_preferred_model_lacks_capability():
    reg = ModelRegistry()
    router = Router(reg)

    with pytest.raises(UaapError) as exc_info:
        router.plan(required=frozenset({"vision"}), preferred="test-model-fast")
    assert exc_info.value.code == "VALIDATION"


def test_router_unknown_capability():
    reg = ModelRegistry()
    router = Router(reg)

    with pytest.raises(UaapError) as exc_info:
        router.plan(required=frozenset({"quantum_computing"}))
    assert exc_info.value.code == "VALIDATION"
