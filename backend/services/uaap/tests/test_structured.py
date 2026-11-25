"""Tests for structured output schema validation and repair loop."""

import pytest

from uaap.errors import UaapError
from uaap.gateway.structured import execute_structured_request, validate_json_schema
from uaap.gateway.types import Message, ProviderRequest, ProviderResponse


def test_valid_json_schema():
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"},
        },
        "required": ["name", "age"],
    }
    raw = '{"name": "Alice", "age": 30}'
    data = validate_json_schema(raw, schema)
    assert data["name"] == "Alice"
    assert data["age"] == 30


def test_malformed_json_fails():
    schema = {"type": "object"}
    with pytest.raises(UaapError) as exc_info:
        validate_json_schema("not a json string", schema)
    assert exc_info.value.code == "UPSTREAM_INVALID_RESPONSE"


def test_schema_mismatch_fails():
    schema = {
        "type": "object",
        "properties": {"count": {"type": "integer"}},
        "required": ["count"],
    }
    with pytest.raises(UaapError) as exc_info:
        validate_json_schema('{"count": "invalid_string"}', schema)
    assert exc_info.value.code == "UPSTREAM_INVALID_RESPONSE"


@pytest.mark.asyncio
async def test_repair_loop_success():
    schema = {
        "type": "object",
        "properties": {"action": {"type": "string"}},
        "required": ["action"],
    }
    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="do something"),),
    )

    call_count = 0

    async def mock_caller(r: ProviderRequest) -> ProviderResponse:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First reply is invalid
            return ProviderResponse(model=r.model, content="not json", prompt_tokens=10, completion_tokens=5)
        # Second reply repairs the JSON
        return ProviderResponse(
            model=r.model,
            content='{"action": "create_user"}',
            prompt_tokens=25,
            completion_tokens=8,
        )

    res, parsed = await execute_structured_request(req, schema, mock_caller)
    assert parsed["action"] == "create_user"
    assert call_count == 2
    assert res.prompt_tokens == 35
    assert res.completion_tokens == 13


@pytest.mark.asyncio
async def test_repair_loop_exhausted():
    schema = {
        "type": "object",
        "properties": {"action": {"type": "string"}},
        "required": ["action"],
    }
    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="do something"),),
    )

    async def mock_caller(r: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(
            model=r.model,
            content="still invalid json",
            prompt_tokens=5,
            completion_tokens=5,
        )

    with pytest.raises(UaapError) as exc_info:
        await execute_structured_request(req, schema, mock_caller)
    assert exc_info.value.code == "UPSTREAM_INVALID_RESPONSE"
    assert "after repair" in exc_info.value.message
