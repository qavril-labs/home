"""End-to-end API tests for UAAP A2 Gateway endpoints."""

import httpx
import pytest

from uaap.api.main import create_app
from uaap.gateway.providers.fake_server import FakeOllamaServer
from uaap.gateway.providers.ollama import OllamaProvider


@pytest.fixture
def fake_ollama():
    server = FakeOllamaServer()
    server.reset()
    return server


@pytest.fixture
def test_app(fake_ollama):
    app = create_app()
    transport = httpx.ASGITransport(app=fake_ollama.app)
    app.state.provider = OllamaProvider(base_url="http://fake-ollama", transport=transport)
    return app


@pytest.fixture
async def client(test_app):
    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_healthz(client):
    res = await client.get("/healthz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "uaap"
    assert data["provider_mode"] == "fake"


@pytest.mark.asyncio
async def test_readyz(client):
    res = await client.get("/readyz")
    assert res.status_code == 200
    data = res.json()
    assert data["ready"] is True
    assert "test-model-fast" in data["models"]


@pytest.mark.asyncio
async def test_auth_rejection(client):
    # No auth header
    res = await client.get("/v1/models")
    assert res.status_code == 401
    err = res.json()["error"]
    assert err["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_missing_tenant_header(client):
    # Auth header but missing tenant
    headers = {"Authorization": "Bearer test-token"}
    res = await client.get("/v1/models", headers=headers)
    assert res.status_code == 400
    err = res.json()["error"]
    assert err["code"] == "VALIDATION"


@pytest.mark.asyncio
async def test_list_models_success(client):
    headers = {"Authorization": "Bearer test-token", "X-Tenant-ID": "tenant_1"}
    res = await client.get("/v1/models", headers=headers)
    assert res.status_code == 200
    data = res.json()
    model_ids = [m["id"] for m in data["models"]]
    assert "test-model-fast" in model_ids
    assert "test-model-reasoning" in model_ids


@pytest.mark.asyncio
async def test_chat_endpoint_success(client):
    headers = {
        "Authorization": "Bearer test-token",
        "X-Tenant-ID": "tenant_demo",
        "X-Actor-ID": "operator_42",
    }
    payload = {
        "messages": [{"role": "user", "content": "What is 2 + 2?"}],
        "model": "test-model-fast",
    }
    res = await client.post("/v1/model/chat", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "test-model-fast"
    assert "reply to: What is 2 + 2?" in data["content"]
    assert data["total_tokens"] > 0
    assert "request_id" in data


@pytest.mark.asyncio
async def test_chat_structured_json(client, fake_ollama):
    fake_ollama.script(
        "test-model-fast",
        [{"json_body": {"message": {"role": "assistant", "content": '{"summary": "ok", "score": 95}'}}}],
    )
    headers = {"Authorization": "Bearer test-token", "X-Tenant-ID": "tenant_demo"}
    payload = {
        "messages": [{"role": "user", "content": "Analyze performance"}],
        "json_schema": {
            "type": "object",
            "properties": {"summary": {"type": "string"}, "score": {"type": "integer"}},
            "required": ["summary", "score"],
        },
    }
    res = await client.post("/v1/model/chat", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["structured_data"] == {"summary": "ok", "score": 95}


@pytest.mark.asyncio
async def test_model_fallback(client, fake_ollama):
    # Make test-model-fast fail all retry attempts with 500 so router falls back to next capable model
    fake_ollama.script("test-model-fast", [{"status": 500}, {"status": 500}, {"status": 500}])

    headers = {"Authorization": "Bearer test-token", "X-Tenant-ID": "tenant_fallback"}
    payload = {
        "messages": [{"role": "user", "content": "Hello fallback"}],
        "capabilities": ["text"],
    }
    res = await client.post("/v1/model/chat", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    # Fell back to next capable model
    assert data["model"] != "test-model-fast"
