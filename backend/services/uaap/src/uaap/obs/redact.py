"""Secret redaction and safe logging. Redaction is defence in depth, not a licence to log secrets."""

from __future__ import annotations

import logging
import re
import threading

_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=\-]+"), "Bearer [REDACTED]"),
    (
        re.compile(
            r"(?i)\b(api[_-]?key|access[_-]?token|token|secret|password|authorization)(\s*[=:]\s*)(?!Bearer\b|\[REDACTED\])[^\s,;\"']+"
        ),
        r"\1\2[REDACTED]",
    ),
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}"), "[REDACTED]"),
    # Product session token shape: <tenant uuid>.<random>
    (
        re.compile(
            r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
            r"\.[A-Za-z0-9_\-]{12,}"
        ),
        "[REDACTED]",
    ),
)


class SecretRegistry:
    """Exact secret values that must never appear in output."""

    def __init__(self) -> None:
        self._values: set[str] = set()
        self._lock = threading.Lock()

    def register(self, value: str) -> None:
        if len(value) >= 4:
            with self._lock:
                self._values.add(value)

    def values(self) -> list[str]:
        with self._lock:
            return sorted(self._values, key=len, reverse=True)

    def clear(self) -> None:
        with self._lock:
            self._values.clear()


SECRETS = SecretRegistry()


def redact(text: str) -> str:
    for secret in SECRETS.values():
        text = text.replace(secret, "[REDACTED]")
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage())
        record.args = ()
        return True


LOGGER_NAME = "uaap"


def get_logger() -> logging.Logger:
    """Single flat logger so the redaction filter always applies."""
    logger = logging.getLogger(LOGGER_NAME)
    if not any(isinstance(f, RedactingFilter) for f in logger.filters):
        logger.addFilter(RedactingFilter())
    return logger
