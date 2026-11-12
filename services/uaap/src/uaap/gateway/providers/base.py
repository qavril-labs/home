"""Provider interface and authentication strategies."""

from __future__ import annotations

from typing import Protocol

from pydantic import SecretStr

from uaap.gateway.types import ProviderRequest, ProviderResponse
from uaap.obs.redact import SECRETS


class AuthStrategy(Protocol):
    def headers(self) -> dict[str, str]: ...


class NoAuth:
    def headers(self) -> dict[str, str]:
        return {}


class BearerAuth:
    """Bearer credential held as SecretStr and registered for log redaction. Never repr'd."""

    def __init__(self, secret: SecretStr) -> None:
        self._secret = secret
        SECRETS.register(secret.get_secret_value())

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._secret.get_secret_value()}"}

    def __repr__(self) -> str:
        return "BearerAuth(secret=**********)"


class Provider(Protocol):
    name: str

    async def chat(self, request: ProviderRequest) -> ProviderResponse: ...

    async def health(self) -> bool: ...
