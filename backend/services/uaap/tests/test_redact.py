"""Tests for secret redaction and log filtering."""

import logging

from uaap.obs.redact import SECRETS, RedactingFilter, redact


def test_pattern_redaction():
    text = "Authorization: Bearer my-top-secret-token"
    assert redact(text) == "Authorization: Bearer [REDACTED]"

    key_text = "api_key=sk-1234567890abcdef"
    assert redact(key_text) == "api_key=[REDACTED]"

    session_text = "tenant 12345678-1234-1234-1234-123456789abc.sessiontoken123456"
    assert "[REDACTED]" in redact(session_text)


def test_registered_secret_redaction():
    SECRETS.register("SuperConfidentialOllamaKey999")
    try:
        sample = "Connecting with SuperConfidentialOllamaKey999 to server"
        assert redact(sample) == "Connecting with [REDACTED] to server"
    finally:
        SECRETS.clear()


def test_logging_filter(caplog):
    logger = logging.getLogger("test_redact_logger")
    logger.setLevel(logging.INFO)
    logger.addFilter(RedactingFilter())

    with caplog.at_level(logging.INFO):
        logger.info("Token is Bearer abcdef123456")

    assert "abcdef123456" not in caplog.text
    assert "Bearer [REDACTED]" in caplog.text
