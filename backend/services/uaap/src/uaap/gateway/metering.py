"""Thread-safe in-memory usage metering and rate/quota limiting for A2."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from uaap.errors import UaapError


@dataclass
class TenantUsage:
    requests_last_minute: deque[float] = field(default_factory=deque)
    daily_tokens: dict[date, int] = field(default_factory=lambda: defaultdict(int))
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_requests: int = 0


class InMemoryMeteringService:
    """Tracks per-tenant requests and token usage, enforcing RPM and daily quotas."""

    def __init__(self) -> None:
        self._tenants: dict[str, TenantUsage] = defaultdict(TenantUsage)
        self._lock = threading.Lock()

    def check_limits(
        self,
        tenant_id: str,
        *,
        requests_per_minute: int,
        daily_token_budget: int,
        estimated_tokens: int = 0,
    ) -> None:
        now = time.monotonic()
        today = date.today()

        with self._lock:
            usage = self._tenants[tenant_id]

            # Clean up timestamps older than 60 seconds
            while usage.requests_last_minute and now - usage.requests_last_minute[0] > 60.0:
                usage.requests_last_minute.popleft()

            # Check RPM
            if len(usage.requests_last_minute) >= requests_per_minute:
                raise UaapError(
                    "RATE_LIMITED",
                    f"Rate limit exceeded: {requests_per_minute} requests/minute limit reached",
                    {"tenant_id": tenant_id, "limit": requests_per_minute},
                )

            # Check daily quota
            current_daily = usage.daily_tokens[today]
            if current_daily + estimated_tokens > daily_token_budget:
                raise UaapError(
                    "QUOTA_EXCEEDED",
                    f"Daily token quota exceeded: budget of {daily_token_budget} tokens reached",
                    {
                        "tenant_id": tenant_id,
                        "used_today": current_daily,
                        "budget": daily_token_budget,
                    },
                )

            # Register request timestamp
            usage.requests_last_minute.append(now)
            usage.total_requests += 1

    def record_usage(self, tenant_id: str, prompt_tokens: int, completion_tokens: int) -> None:
        today = date.today()
        total = prompt_tokens + completion_tokens

        with self._lock:
            usage = self._tenants[tenant_id]
            usage.daily_tokens[today] += total
            usage.total_prompt_tokens += prompt_tokens
            usage.total_completion_tokens += completion_tokens

    def get_tenant_usage(self, tenant_id: str) -> dict[str, Any]:
        today = date.today()
        with self._lock:
            usage = self._tenants[tenant_id]
            return {
                "tenant_id": tenant_id,
                "used_today": usage.daily_tokens[today],
                "total_prompt_tokens": usage.total_prompt_tokens,
                "total_completion_tokens": usage.total_completion_tokens,
                "total_requests": usage.total_requests,
            }

    def reset(self) -> None:
        with self._lock:
            self._tenants.clear()
