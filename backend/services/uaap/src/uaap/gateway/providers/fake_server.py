"""In-process fake Ollama-compatible server for tests and local development.

Models are test-only identifiers. Behaviour is scriptable per model so failure handling can be exercised:
  {"status": 200, "content": "..."}   normal reply (token counts derived from text length)
  {"status": 429, "retry_after": "0"} rate limit
  {"status": 500}                      server error
  {"delay": 0.2}                       sleeps before replying (timeout tests)
  {"raw": "not json", "status": 200}   malformed body
  {"json_body": {...}}                 arbitrary JSON body
Unscripted calls get a deterministic echo reply. The server never returns or logs credentials.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

Behavior = dict[str, Any]


@dataclass
class RecordedRequest:
    path: str
    headers: dict[str, str]
    body: dict[str, Any]


@dataclass
class FakeOllamaServer:
    models: tuple[str, ...] = (
        "test-model-fast",
        "test-model-reasoning",
        "test-model-vision",
        "test-model-long",
    )
    required_bearer: str | None = None
    requests: list[RecordedRequest] = field(default_factory=list)
    _scripts: dict[str, deque[Behavior]] = field(default_factory=lambda: defaultdict(deque))
    app: FastAPI = field(init=False)

    def __post_init__(self) -> None:
        self.app = self._build()

    def script(self, model: str, behaviors: list[Behavior]) -> None:
        self._scripts[model].extend(behaviors)

    def reset(self) -> None:
        self.requests.clear()
        self._scripts.clear()

    def _build(self) -> FastAPI:
        app = FastAPI()

        def unauthorized(request: Request) -> bool:
            if self.required_bearer is None:
                return False
            return request.headers.get("authorization") != f"Bearer {self.required_bearer}"

        @app.get("/api/tags")
        async def tags(request: Request) -> Response:
            if unauthorized(request):
                return JSONResponse({"error": "unauthorized"}, status_code=401)
            return JSONResponse({"models": [{"name": m} for m in self.models]})

        @app.post("/api/chat")
        async def chat(request: Request) -> Response:
            body = await request.json()
            self.requests.append(RecordedRequest("/api/chat", dict(request.headers), body))
            if unauthorized(request):
                return JSONResponse({"error": "unauthorized"}, status_code=401)
            model = str(body.get("model", ""))
            if model not in self.models:
                return JSONResponse({"error": "model not found"}, status_code=404)
            queue = self._scripts[model]
            behavior: Behavior = queue.popleft() if queue else {}
            if "delay" in behavior:
                await asyncio.sleep(float(behavior["delay"]))
            status = int(behavior.get("status", 200))
            if "raw" in behavior:
                return Response(
                    content=str(behavior["raw"]),
                    status_code=status,
                    media_type="application/json",
                )
            if "json_body" in behavior:
                return JSONResponse(behavior["json_body"], status_code=status)
            if status != 200:
                headers = {"retry-after": str(behavior["retry_after"])} if "retry_after" in behavior else {}
                return JSONResponse({"error": "scripted failure"}, status_code=status, headers=headers)
            messages = body.get("messages", [])
            last = messages[-1]["content"] if messages else ""
            content = str(behavior.get("content", f"[{model}] reply to: {last}"))
            prompt_chars = sum(len(str(m.get("content", ""))) for m in messages)
            return JSONResponse(
                {
                    "model": model,
                    "message": {"role": "assistant", "content": content},
                    "done": True,
                    "prompt_eval_count": max(1, prompt_chars // 4),
                    "eval_count": max(1, len(content) // 4),
                }
            )

        return app
