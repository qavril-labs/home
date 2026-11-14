"""FastAPI application entry point for UAAP."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from uaap.api.admin import router as admin_router
from uaap.api.agents_api import router as agents_router
from uaap.api.routes import router
from uaap.errors import UaapError, envelope
from uaap.obs.redact import get_logger

logger = get_logger()


def create_app() -> FastAPI:
    app = FastAPI(
        title="QAVRIL LABS UAAP - Universal AI Agent Platform",
        version="0.1.0a4",
        description="Model gateway, agent runtime and tool execution boundary (A4)",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Any) -> Any:
        req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response

    @app.exception_handler(UaapError)
    async def uaap_error_handler(request: Request, exc: UaapError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        logger.warning("UAAP Error [%s]: %s (request_id=%s)", exc.code, exc.message, req_id)
        return JSONResponse(
            status_code=exc.http_status,
            content=envelope(exc.code, exc.message, req_id, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        logger.info("Validation Error: %s (request_id=%s)", exc.errors(), req_id)
        details = {"errors": exc.errors()}
        return JSONResponse(
            status_code=400,
            content=envelope("VALIDATION", "Invalid request body or parameters", req_id, details),
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        logger.error("Unhandled Exception: %s (request_id=%s)", type(exc).__name__, req_id, exc_info=exc)
        return JSONResponse(
            status_code=500,
            content=envelope("INTERNAL", "An internal error occurred", req_id),
        )

    app.include_router(router)
    app.include_router(admin_router)
    app.include_router(agents_router)
    return app


app = create_app()
