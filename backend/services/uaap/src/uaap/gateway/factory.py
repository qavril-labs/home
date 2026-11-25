"""Builds the configured model provider. The only place outside `gateway.providers` that names a concrete
provider, so the API layer depends on the `Provider` interface alone."""

from __future__ import annotations

from uaap.config import Settings
from uaap.gateway.providers.base import BearerAuth, NoAuth, Provider
from uaap.gateway.providers.ollama import OllamaProvider
from uaap.gateway.registry import DEFAULT_TEST_MODELS, ModelRegistry, ModelSpec


def build_provider(settings: Settings) -> Provider:
    auth = BearerAuth(settings.ollama_api_key) if settings.ollama_api_key else NoAuth()
    return OllamaProvider(base_url=settings.ollama_base_url, auth=auth)


def build_model_registry(settings: Settings) -> ModelRegistry:
    """Fake mode uses the test models; live mode uses UAAP_LIVE_MODELS, cheapest first."""
    if settings.provider_mode != "live":
        return ModelRegistry(DEFAULT_TEST_MODELS)
    return ModelRegistry(
        tuple(
            ModelSpec(model_id, "ollama", frozenset({"text", "json"}), cost_tier=i + 1, context_window=32_768)
            for i, model_id in enumerate(settings.live_model_ids)
        )
    )
