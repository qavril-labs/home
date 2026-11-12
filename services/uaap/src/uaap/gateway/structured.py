"""Structured output validator with single-attempt repair loop."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

import jsonschema

from uaap.errors import UaapError
from uaap.gateway.types import Message, ProviderRequest, ProviderResponse


def validate_json_schema(content: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Parse JSON and validate against a JSON schema."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise UaapError("UPSTREAM_INVALID_RESPONSE", f"Malformed JSON from model: {exc.msg}") from exc

    if not isinstance(data, dict):
        raise UaapError(
            "UPSTREAM_INVALID_RESPONSE",
            f"Expected JSON object, got {type(data).__name__}",
            {"received_type": type(data).__name__},
        )

    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as exc:
        raise UaapError(
            "UPSTREAM_INVALID_RESPONSE",
            f"JSON schema validation failed: {exc.message}",
            {"path": list(exc.path), "schema_error": exc.message},
        ) from exc

    return data


async def execute_structured_request(
    request: ProviderRequest,
    schema: dict[str, Any],
    caller: Callable[[ProviderRequest], Awaitable[ProviderResponse]],
) -> tuple[ProviderResponse, dict[str, Any]]:
    """Execute a request expecting JSON matching schema, with up to one repair retry on validation failure."""
    req = ProviderRequest(
        model=request.model,
        messages=request.messages,
        json_mode=True,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )

    first_response = await caller(req)
    try:
        validated = validate_json_schema(first_response.content, schema)
        return first_response, validated
    except UaapError as first_err:
        # Single repair attempt
        repair_instruction = (
            f"Your previous output failed JSON validation: {first_err.message}. "
            f"Please output ONLY valid JSON matching this schema: {json.dumps(schema)}"
        )
        repair_messages = (
            *request.messages,
            Message(role="assistant", content=first_response.content),
            Message(role="user", content=repair_instruction),
        )
        repair_req = ProviderRequest(
            model=request.model,
            messages=repair_messages,
            json_mode=True,
            temperature=0.0,  # Zero temperature for deterministic schema adherence
            max_tokens=request.max_tokens,
        )
        repair_response = await caller(repair_req)
        try:
            validated = validate_json_schema(repair_response.content, schema)
            # Combine token counts if present
            prompt_tokens = (first_response.prompt_tokens or 0) + (repair_response.prompt_tokens or 0)
            completion_tokens = (first_response.completion_tokens or 0) + (
                repair_response.completion_tokens or 0
            )
            combined_response = ProviderResponse(
                model=repair_response.model,
                content=repair_response.content,
                prompt_tokens=prompt_tokens if prompt_tokens > 0 else None,
                completion_tokens=completion_tokens if completion_tokens > 0 else None,
            )
            return combined_response, validated
        except UaapError as repair_err:
            raise UaapError(
                "UPSTREAM_INVALID_RESPONSE",
                f"Structured output schema validation failed after repair: {repair_err.message}",
                {
                    "first_error": first_err.message,
                    "repair_error": repair_err.message,
                    "schema": schema,
                },
            ) from repair_err
