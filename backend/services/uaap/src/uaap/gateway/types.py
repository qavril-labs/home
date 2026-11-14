"""Provider-neutral gateway types."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Message:
    role: str
    content: str


@dataclass(frozen=True)
class ProviderRequest:
    model: str
    messages: tuple[Message, ...]
    json_mode: bool = False
    temperature: float = 0.2
    max_tokens: int | None = None


@dataclass(frozen=True)
class ProviderResponse:
    model: str
    content: str
    prompt_tokens: int | None
    completion_tokens: int | None
