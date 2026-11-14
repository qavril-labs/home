"""Tests for UAAP Settings and A2 safeguards."""

import pytest
from pydantic import SecretStr, ValidationError

from uaap.config import Settings

KEY = SecretStr("k" * 20)


def test_default_settings():
    s = Settings()
    assert s.env == "local"
    assert s.provider_mode == "fake"
    assert s.ollama_base_url == "http://fake-ollama.invalid"
    assert s.has_provider_credential is False


def test_live_provider_mode_safeguard():
    with pytest.raises(ValidationError, match="requires UAAP_OLLAMA_API_KEY"):
        Settings(provider_mode="live")
    with pytest.raises(ValidationError, match="https"):
        Settings(provider_mode="live", ollama_api_key=KEY, ollama_base_url="http://ollama.local")
    with pytest.raises(ValidationError, match="UAAP_LIVE_MODELS"):
        Settings(provider_mode="live", ollama_api_key=KEY, ollama_base_url="https://ollama.com")
    live = Settings(
        provider_mode="live", ollama_api_key=KEY, ollama_base_url="https://ollama.com", live_models="a, b"
    )
    assert live.live_model_ids == ("a", "b")
    assert live.provider_mode == "live" and KEY.get_secret_value() not in repr(live)


def test_production_env_safeguard():
    with pytest.raises(ValidationError, match="env=production is not supported in milestone A2"):
        Settings(env="production")


def test_secret_str_masking():
    s = Settings(ollama_api_key=SecretStr("very-secret-token-12345"))
    assert s.has_provider_credential is True
    assert "very-secret-token-12345" not in repr(s)
    assert s.ollama_api_key is not None
    assert s.ollama_api_key.get_secret_value() == "very-secret-token-12345"


def test_validation_bounds():
    with pytest.raises(ValidationError):
        Settings(max_attempts=0)
    with pytest.raises(ValidationError):
        Settings(request_timeout_seconds=-5.0)
