"""Tests for ResilientCaller and CircuitBreaker."""

import asyncio

import pytest

from uaap.errors import ProviderError
from uaap.gateway.resilience import BreakerState, CircuitBreaker, ResilientCaller


@pytest.mark.asyncio
async def test_successful_execution():
    caller = ResilientCaller(max_attempts=3)
    call_count = 0

    async def sample_action():
        nonlocal call_count
        call_count += 1
        return "success"

    result = await caller.execute(sample_action)
    assert result == "success"
    assert call_count == 1


@pytest.mark.asyncio
async def test_retry_on_retryable_error():
    caller = ResilientCaller(max_attempts=3, backoff_base_seconds=0.01)
    call_count = 0

    async def flaky_action():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ProviderError("server", "temporary server failure")
        return "recovered"

    result = await caller.execute(flaky_action)
    assert result == "recovered"
    assert call_count == 3


@pytest.mark.asyncio
async def test_exhausted_retries():
    caller = ResilientCaller(max_attempts=2, backoff_base_seconds=0.01)

    async def failing_action():
        raise ProviderError("network", "unreachable host")

    with pytest.raises(ProviderError) as exc_info:
        await caller.execute(failing_action)
    assert exc_info.value.kind == "network"


@pytest.mark.asyncio
async def test_circuit_breaker_transitions():
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.05)
    caller = ResilientCaller(max_attempts=1, breaker=breaker)

    async def failing_action():
        raise ProviderError("server", "bad server")

    # Failure 1
    with pytest.raises(ProviderError):
        await caller.execute(failing_action)
    assert breaker.state == BreakerState.CLOSED

    # Failure 2 -> triggers OPEN
    with pytest.raises(ProviderError):
        await caller.execute(failing_action)
    assert breaker.state == BreakerState.OPEN  # type: ignore[comparison-overlap]

    # In OPEN state, immediately rejected without calling action
    with pytest.raises(ProviderError) as exc_info:
        await caller.execute(failing_action)
    assert "circuit breaker open" in str(exc_info.value)

    # Wait for cooldown
    await asyncio.sleep(0.06)
    assert breaker.allow_request() is True
    assert breaker.state == BreakerState.HALF_OPEN

    # Success resets to CLOSED
    async def ok_action():
        return "healed"

    res = await caller.execute(ok_action)
    assert res == "healed"
    assert breaker.state == BreakerState.CLOSED
