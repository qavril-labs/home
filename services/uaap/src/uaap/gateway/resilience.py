"""Resilience mechanisms: bounded retries, exponential jitter backoff, and circuit breaker."""

from __future__ import annotations

import asyncio
import secrets
import time
from collections.abc import Awaitable, Callable
from enum import StrEnum
from typing import TypeVar

from uaap.errors import ProviderError

T = TypeVar("T")


class BreakerState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Standard 3-state circuit breaker. Thread/async-safe within an event loop."""

    def __init__(self, failure_threshold: int = 5, cooldown_seconds: float = 30.0) -> None:
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state: BreakerState = BreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0.0

    def allow_request(self) -> bool:
        now = time.monotonic()
        if self.state == BreakerState.CLOSED:
            return True
        if self.state == BreakerState.OPEN:
            if now - self.last_failure_time >= self.cooldown_seconds:
                self.state = BreakerState.HALF_OPEN
                return True
            return False
        # In HALF_OPEN state, allow single trial request
        return True

    def record_success(self) -> None:
        self.failure_count = 0
        self.state = BreakerState.CLOSED

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.monotonic()
        if self.state == BreakerState.HALF_OPEN or self.failure_count >= self.failure_threshold:
            self.state = BreakerState.OPEN

    def reset(self) -> None:
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = BreakerState.CLOSED


class ResilientCaller:
    """Executes provider requests with timeouts, bounded exponential backoff, and breaker protection."""

    def __init__(
        self,
        *,
        timeout_seconds: float = 30.0,
        max_attempts: int = 3,
        backoff_base_seconds: float = 0.1,
        backoff_max_seconds: float = 2.0,
        breaker: CircuitBreaker | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.max_attempts = max_attempts
        self.backoff_base_seconds = backoff_base_seconds
        self.backoff_max_seconds = backoff_max_seconds
        self.breaker = breaker or CircuitBreaker()

    def _calculate_backoff(self, attempt: int, retry_after: float | None = None) -> float:
        if retry_after is not None and retry_after > 0:
            return min(retry_after, self.backoff_max_seconds)
        # Exponential backoff with full jitter
        exponential = min(self.backoff_max_seconds, self.backoff_base_seconds * (2**attempt))
        return float(exponential * (0.5 + 0.5 * secrets.SystemRandom().random()))

    async def execute(self, action: Callable[[], Awaitable[T]]) -> T:
        last_error: Exception | None = None

        for attempt in range(self.max_attempts):
            if not self.breaker.allow_request():
                raise ProviderError(
                    "server",
                    f"circuit breaker open ({self.breaker.cooldown_seconds}s cooldown)",
                    status_code=503,
                )

            try:
                result = await asyncio.wait_for(action(), timeout=self.timeout_seconds)
                self.breaker.record_success()
                return result
            except TimeoutError as exc:
                self.breaker.record_failure()
                last_error = ProviderError("timeout", f"request timed out after {self.timeout_seconds}s")
                if attempt + 1 >= self.max_attempts:
                    raise last_error from exc
                delay = self._calculate_backoff(attempt)
                await asyncio.sleep(delay)
            except ProviderError as exc:
                self.breaker.record_failure()
                last_error = exc
                if not exc.retryable or attempt + 1 >= self.max_attempts:
                    raise
                delay = self._calculate_backoff(attempt, exc.retry_after)
                await asyncio.sleep(delay)
            except Exception as exc:
                self.breaker.record_failure()
                raise ProviderError("server", f"unexpected upstream failure: {type(exc).__name__}") from exc

        if last_error is not None:
            raise last_error
        raise ProviderError("server", "exhausted execution attempts")
