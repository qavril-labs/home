"""Typed tool registry with JSON-Schema contracts and code-enforced tiers.

Rules (UAAP security spec, section 3):
- Unknown tools are Tier 5.
- Tier 5 tools are registered without an executor; nothing can run them.
- A tenant can raise a tool's tier, never lower it.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass

import jsonschema
from jsonschema import Draft202012Validator

from uaap.errors import UaapError
from uaap.tools.types import BLOCKED_TIER, MAX_TIER, MIN_TIER, ToolDefinition, ToolHandler

_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,63}$")


@dataclass(frozen=True)
class RegisteredTool:
    definition: ToolDefinition
    handler: ToolHandler | None

    @property
    def blocked(self) -> bool:
        return self.handler is None


def _check_schema(tool_name: str, label: str, schema: dict[str, object]) -> None:
    try:
        Draft202012Validator.check_schema(schema)
    except jsonschema.SchemaError as exc:
        raise UaapError(
            "VALIDATION",
            f"Tool '{tool_name}' has an invalid {label} schema: {exc.message}",
            {"tool_name": tool_name},
        ) from exc
    if schema.get("type") != "object":
        raise UaapError(
            "VALIDATION",
            f"Tool '{tool_name}' {label} schema must describe a JSON object",
            {"tool_name": tool_name},
        )


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, RegisteredTool] = {}
        self._tenant_tiers: dict[tuple[str, str], int] = {}
        self._lock = threading.Lock()

    def register(self, definition: ToolDefinition, handler: ToolHandler | None) -> None:
        name = definition.name
        if not _NAME_PATTERN.match(name):
            raise UaapError("VALIDATION", f"Invalid tool name '{name}'", {"tool_name": name})
        if not MIN_TIER <= definition.tier <= MAX_TIER:
            raise UaapError("VALIDATION", f"Tool '{name}' tier must be 1 to 5", {"tool_name": name})
        if definition.tier == BLOCKED_TIER and handler is not None:
            raise UaapError(
                "VALIDATION",
                f"Tool '{name}' is Tier 5 and cannot have an executor",
                {"tool_name": name},
            )
        if definition.tier != BLOCKED_TIER and handler is None:
            raise UaapError("VALIDATION", f"Tool '{name}' needs an executor", {"tool_name": name})
        if not definition.permission:
            raise UaapError("VALIDATION", f"Tool '{name}' must declare a permission", {"tool_name": name})
        if definition.timeout_seconds <= 0:
            raise UaapError("VALIDATION", f"Tool '{name}' timeout must be positive", {"tool_name": name})
        _check_schema(name, "input", definition.input_schema)
        if definition.output_schema is not None:
            _check_schema(name, "output", definition.output_schema)

        with self._lock:
            if name in self._tools:
                raise UaapError("VALIDATION", f"Tool '{name}' is already registered", {"tool_name": name})
            self._tools[name] = RegisteredTool(definition=definition, handler=handler)

    def get(self, name: str) -> RegisteredTool | None:
        with self._lock:
            return self._tools.get(name)

    def all(self) -> list[RegisteredTool]:
        with self._lock:
            return sorted(self._tools.values(), key=lambda t: t.definition.name)

    def effective_tier(self, tenant_id: str, name: str) -> int:
        """Tier for this tenant. Unknown tools are Tier 5."""
        with self._lock:
            tool = self._tools.get(name)
            if tool is None:
                return BLOCKED_TIER
            override = self._tenant_tiers.get((tenant_id, name))
        base = tool.definition.tier
        return max(base, override) if override is not None else base

    def set_tenant_tier(self, tenant_id: str, name: str, tier: int) -> None:
        if not tenant_id:
            raise UaapError("VALIDATION", "tenant_id is required")
        if not MIN_TIER <= tier <= MAX_TIER:
            raise UaapError("VALIDATION", "Tier must be 1 to 5", {"tier": tier})
        with self._lock:
            tool = self._tools.get(name)
            if tool is None:
                raise UaapError("NOT_FOUND", f"Tool '{name}' is not registered", {"tool_name": name})
            current = max(tool.definition.tier, self._tenant_tiers.get((tenant_id, name), MIN_TIER))
            if tier < current:
                raise UaapError(
                    "FORBIDDEN",
                    f"Tool '{name}' tier can only be raised (current {current}, requested {tier})",
                    {"tool_name": name, "current_tier": current, "requested_tier": tier},
                )
            self._tenant_tiers[(tenant_id, name)] = tier
