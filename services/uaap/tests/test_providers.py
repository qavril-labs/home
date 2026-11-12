"""Tests for OllamaProvider using FakeOllamaServer."""

import httpx
import pytest

from uaap.errors import ProviderError
from uaap.gateway.providers.fake_server import FakeOllamaServer
from uaap.gateway.providers.ollama import OllamaProvider
from uaap.gateway.types import Message, ProviderRequest


@pytest.fixture
def fake_server():
    server = FakeOllamaServer()
    server.reset()
    return server


@pytest.fixture
def provider(fake_server):
    transport = httpx.ASGITransport(app=fake_server.app)
    return OllamaProvider(base_url="http://testserver", transport=transport)


@pytest.mark.asyncio
async def test_successful_chat(fake_server, provider):
    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="Hello world"),),
    )
    res = await provider.chat(req)
    assert res.model == "test-model-fast"
    assert "reply to: Hello world" in res.content
    assert res.prompt_tokens is not None
    assert res.completion_tokens is not None


@pytest.mark.asyncio
async def test_health_check(fake_server, provider):
    assert await provider.health() is True


@pytest.mark.asyncio
async def test_provider_rate_limit(fake_server, provider):
    fake_server.script("test-model-fast", [{"status": 429, "retry_after": "2"}])
    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="Ping"),),
    )
    with pytest.raises(ProviderError) as exc_info:
        await provider.chat(req)
    assert exc_info.value.kind == "rate_limited"
    assert exc_info.value.retry_after == 2.0


@pytest.mark.asyncio
async def test_provider_server_error(fake_server, provider):
    fake_server.script("test-model-fast", [{"status": 500}])
    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="Ping"),),
    )
    with pytest.raises(ProviderError) as exc_info:
        await provider.chat(req)
    assert exc_info.value.kind == "server"
    assert exc_info.value.retryable is True


@pytest.mark.asyncio
async def test_provider_malformed_response(fake_server, provider):
    fake_server.script("test-model-fast", [{"raw": "invalid-json-body", "status": 200}])
    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="Ping"),),
    )
    with pytest.raises(ProviderError) as exc_info:
        await provider.chat(req)
    assert exc_info.value.kind == "malformed"


@pytest.mark.asyncio
async def test_provider_auth_rejection():
    server = FakeOllamaServer(required_bearer="secret-token-xyz")
    transport = httpx.ASGITransport(app=server.app)
    unauthed_provider = OllamaProvider(base_url="http://testserver", transport=transport)

    req = ProviderRequest(
        model="test-model-fast",
        messages=(Message(role="user", content="Ping"),),
    )
    with pytest.raises(ProviderError) as exc_info:
        await unauthed_provider.chat(req)
    assert exc_info.value.kind == "auth"
    assert exc_info.value.allows_fallback is False
