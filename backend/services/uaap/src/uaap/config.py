"""UAAP settings. Values come from process environment only (no env files are read).

Secrets are `SecretStr` and are never rendered in repr, logs or errors.
"""

from __future__ import annotations

from typing import Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="UAAP_", env_file=None, extra="ignore", frozen=True)

    env: Literal["local", "test", "staging", "production"] = "local"
    provider_mode: Literal["fake", "live"] = "fake"
    ollama_base_url: str = "http://fake-ollama.invalid"
    ollama_api_key: SecretStr | None = None
    # Live model ids, cheapest first, comma-separated (for example "gemma4:31b-cloud,glm-5.3-flash:cloud").
    live_models: str = ""

    request_timeout_seconds: float = 30.0
    max_attempts: int = 3
    backoff_base_seconds: float = 0.25
    backoff_max_seconds: float = 4.0
    breaker_failure_threshold: int = 5
    breaker_cooldown_seconds: float = 30.0

    # A4 tool boundary. Core SaaS is reached only over its HTTP API.
    core_saas_base_url: str = "http://core-saas.invalid"
    tool_timeout_seconds: float = 15.0
    max_tool_calls_per_run: int = 20

    # UAAP's own PostgreSQL (schema `uaap`, ADR-003). Provisioning is milestone A5; until then these
    # settings are validated and shown in the admin console, and only TCP reachability is checked.
    database_url: SecretStr | None = None
    database_schema: str = "uaap"
    database_pool_min: int = 1
    database_pool_max: int = 10
    database_statement_timeout_ms: int = 15_000
    database_ssl_mode: Literal["disable", "prefer", "require", "verify-full"] = "prefer"

    # Approval tokens are derived as HMAC(secret, tenant|approval) so no token is ever stored.
    # Required when a database is configured, so pending approvals survive restarts.
    approval_token_secret: SecretStr | None = None

    # Admin console. Disabled (fail closed) unless a key of 32+ characters is set.
    admin_key: SecretStr | None = None

    # Agent standard.
    agent_max_input_chars: int = 4000
    # How long a proposal waits in the approvals inbox before it expires.
    approval_ttl_seconds: int = 86_400

    max_output_tokens: int = 4096
    daily_token_budget: int = 1_000_000
    requests_per_minute: int = 60

    @field_validator(
        "max_attempts",
        "breaker_failure_threshold",
        "max_output_tokens",
        "max_tool_calls_per_run",
        "database_pool_min",
        "database_pool_max",
        "database_statement_timeout_ms",
        "agent_max_input_chars",
        "approval_ttl_seconds",
    )
    @classmethod
    def _positive_int(cls, value: int) -> int:
        if value < 1:
            raise ValueError("must be >= 1")
        return value

    @field_validator(
        "request_timeout_seconds",
        "backoff_base_seconds",
        "backoff_max_seconds",
        "breaker_cooldown_seconds",
        "tool_timeout_seconds",
    )
    @classmethod
    def _positive_float(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("must be > 0")
        return value

    @field_validator("database_url")
    @classmethod
    def _database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None or not value.get_secret_value():
            return None
        parsed = urlsplit(value.get_secret_value())
        if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname:
            raise ValueError("must be a postgres:// or postgresql:// URL with a host")
        return value

    @field_validator("database_schema")
    @classmethod
    def _schema_name(cls, value: str) -> str:
        if not value.isidentifier() or not value.islower():
            raise ValueError("must be a lowercase SQL identifier")
        return value

    @field_validator("admin_key")
    @classmethod
    def _admin_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None or not value.get_secret_value():
            return None
        if len(value.get_secret_value()) < 32:
            raise ValueError("must be at least 32 characters")
        return value

    @model_validator(mode="after")
    def _database_guards(self) -> Settings:
        if self.database_url is not None and (
            self.approval_token_secret is None or len(self.approval_token_secret.get_secret_value()) < 32
        ):
            raise ValueError("UAAP_APPROVAL_TOKEN_SECRET (32+ characters) is required with a database")
        if self.database_pool_min > self.database_pool_max:
            raise ValueError("database_pool_min must not exceed database_pool_max")
        if (
            self.env == "staging"
            and self.database_url is not None
            and self.database_ssl_mode in ("disable", "prefer")
        ):
            raise ValueError("staging requires database_ssl_mode=require or verify-full")
        return self

    @model_validator(mode="after")
    def _a2_guards(self) -> Settings:
        if self.provider_mode == "live":
            # Live models need a real endpoint and a key from the environment (ADR-009). The key is
            # never read from files; the operator sets UAAP_OLLAMA_API_KEY.
            if not self.has_provider_credential:
                raise ValueError("provider_mode=live requires UAAP_OLLAMA_API_KEY")
            host = urlsplit(self.ollama_base_url).hostname or ""
            if not host or host.endswith(".invalid") or not self.ollama_base_url.startswith("https://"):
                raise ValueError("provider_mode=live requires an https UAAP_OLLAMA_BASE_URL")
            if not self.live_model_ids:
                raise ValueError("provider_mode=live requires UAAP_LIVE_MODELS")
        if self.env == "production":
            raise ValueError("env=production is not supported in milestone A2")
        return self

    @property
    def live_model_ids(self) -> tuple[str, ...]:
        return tuple(m.strip() for m in self.live_models.split(",") if m.strip())

    @property
    def has_provider_credential(self) -> bool:
        return self.ollama_api_key is not None and bool(self.ollama_api_key.get_secret_value())
