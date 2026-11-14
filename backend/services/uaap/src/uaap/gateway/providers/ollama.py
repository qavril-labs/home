"""Ollama-compatible HTTP provider (`/api/chat`, `/api/tags`).

In A2 it is only ever pointed at the in-process fake server. Live use is blocked by Settings.
Provider failures are mapped to typed `ProviderError`; response bodies are never copied into messages.
"""

from __future__ import annotations

import httpx

from uaap.errors import ProviderError
from uaap.gateway.providers.base import AuthStrategy, NoAuth
from uaap.gateway.types import ProviderRequest, ProviderResponse


def _retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        seconds = float(value)
    except ValueError:
        return None
    return max(0.0, min(seconds, 30.0))


class OllamaProvider:
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        *,
        auth: AuthStrategy | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        connect_timeout: float = 5.0,
    ) -> None:
        self._auth = auth or NoAuth()
        self._client = httpx.AsyncClient(
            base_url=base_url, transport=transport, timeout=httpx.Timeout(None, connect=connect_timeout)
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def chat(self, request: ProviderRequest) -> ProviderResponse:
        options: dict[str, float | int] = {"temperature": request.temperature}
        if request.max_tokens is not None:
            options["num_predict"] = request.max_tokens
        body: dict[str, object] = {
            "model": request.model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "stream": False,
            "options": options,
        }
        if request.json_mode:
            body["format"] = "json"
        try:
            response = await self._client.post("/api/chat", json=body, headers=self._auth.headers())
        except httpx.TimeoutException as exc:
            raise ProviderError("timeout", "provider request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderError("network", f"provider unreachable ({type(exc).__name__})") from exc
        return self._parse(request.model, response)

    def _parse(self, model: str, response: httpx.Response) -> ProviderResponse:
        status = response.status_code
        if status == 429:
            raise ProviderError(
                "rate_limited",
                "provider rate limit",
                status_code=status,
                retry_after=_retry_after(response.headers.get("retry-after")),
            )
        if status in (401, 403):
            raise ProviderError("auth", "provider rejected credentials", status_code=status)
        if status == 404:
            raise ProviderError("not_found", "model not found at provider", status_code=status)
        if status >= 500:
            raise ProviderError("server", f"provider server error ({status})", status_code=status)
        if status >= 400:
            raise ProviderError("rejected", f"provider rejected request ({status})", status_code=status)
        try:
            data = response.json()
            content = data["message"]["content"]
        except (ValueError, KeyError, TypeError) as exc:
            raise ProviderError(
                "malformed",
                "provider returned a malformed response",
                status_code=status,
            ) from exc
        if not isinstance(content, str):
            raise ProviderError("malformed", "provider returned a malformed response", status_code=status)
        return ProviderResponse(
            model=str(data.get("model", model)),
            content=content,
            prompt_tokens=_int_or_none(data.get("prompt_eval_count")),
            completion_tokens=_int_or_none(data.get("eval_count")),
        )

    async def health(self) -> bool:
        try:
            response = await self._client.get("/api/tags", headers=self._auth.headers())
        except httpx.HTTPError:
            return False
        return response.status_code == 200


def _int_or_none(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None
