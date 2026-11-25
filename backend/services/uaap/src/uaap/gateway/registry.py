"""Model registry and capability-based routing.

Identifiers here are TEST-ONLY and not verified provider tags.
"""

from __future__ import annotations

from dataclasses import dataclass

from uaap.errors import UaapError

CAPABILITIES = frozenset({"text", "json", "vision", "reasoning", "long_context"})


@dataclass(frozen=True)
class ModelSpec:
    id: str
    provider: str
    capabilities: frozenset[str]
    cost_tier: int  # lower is cheaper
    context_window: int


DEFAULT_TEST_MODELS: tuple[ModelSpec, ...] = (
    ModelSpec("test-model-fast", "ollama", frozenset({"text", "json"}), 1, 8_192),
    ModelSpec("test-model-vision", "ollama", frozenset({"text", "vision"}), 2, 8_192),
    ModelSpec("test-model-reasoning", "ollama", frozenset({"text", "json", "reasoning"}), 3, 32_768),
    ModelSpec("test-model-long", "ollama", frozenset({"text", "json", "long_context"}), 4, 131_072),
)


class ModelRegistry:
    def __init__(self, models: tuple[ModelSpec, ...] = DEFAULT_TEST_MODELS) -> None:
        self._models = {m.id: m for m in models}

    def get(self, model_id: str) -> ModelSpec | None:
        return self._models.get(model_id)

    def all(self) -> list[ModelSpec]:
        return sorted(self._models.values(), key=lambda m: (m.cost_tier, m.id))

    def __len__(self) -> int:
        return len(self._models)


class Router:
    def __init__(self, registry: ModelRegistry) -> None:
        self._registry = registry

    def plan(self, required: frozenset[str], preferred: str | None = None) -> list[ModelSpec]:
        """Ordered attempt list: preferred model first (if given), then cheapest capable models."""
        unknown = required - CAPABILITIES
        if unknown:
            raise UaapError("VALIDATION", "Unknown capability requested", {"unknown": sorted(unknown)})
        capable = [m for m in self._registry.all() if required <= m.capabilities]
        if preferred is not None:
            spec = self._registry.get(preferred)
            if spec is None:
                raise UaapError("VALIDATION", "Unknown model", {"model": preferred})
            if not required <= spec.capabilities:
                raise UaapError(
                    "VALIDATION",
                    "Requested model lacks required capabilities",
                    {"model": preferred, "required": sorted(required)},
                )
            return [spec, *[m for m in capable if m.id != preferred]]
        if not capable:
            raise UaapError(
                "VALIDATION",
                "No model supports the required capabilities",
                {"required": sorted(required)},
            )
        return capable
