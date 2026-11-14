"""Tests for InMemoryMeteringService."""

import pytest

from uaap.errors import UaapError
from uaap.gateway.metering import InMemoryMeteringService


def test_rate_limiting():
    metering = InMemoryMeteringService()
    tenant = "tenant_test_1"

    # Limit = 2 RPM
    metering.check_limits(tenant, requests_per_minute=2, daily_token_budget=10_000)
    metering.check_limits(tenant, requests_per_minute=2, daily_token_budget=10_000)

    # 3rd request should fail
    with pytest.raises(UaapError) as exc_info:
        metering.check_limits(tenant, requests_per_minute=2, daily_token_budget=10_000)
    assert exc_info.value.code == "RATE_LIMITED"


def test_daily_token_quota():
    metering = InMemoryMeteringService()
    tenant = "tenant_test_2"

    # Budget = 100 tokens
    metering.record_usage(tenant, prompt_tokens=60, completion_tokens=30)  # total 90

    # Next request estimating 20 tokens exceeds budget 100
    with pytest.raises(UaapError) as exc_info:
        metering.check_limits(tenant, requests_per_minute=60, daily_token_budget=100, estimated_tokens=20)
    assert exc_info.value.code == "QUOTA_EXCEEDED"


def test_usage_accumulation():
    metering = InMemoryMeteringService()
    tenant = "tenant_test_3"

    metering.record_usage(tenant, prompt_tokens=100, completion_tokens=50)
    metering.record_usage(tenant, prompt_tokens=200, completion_tokens=100)

    stats = metering.get_tenant_usage(tenant)
    assert stats["total_prompt_tokens"] == 300
    assert stats["total_completion_tokens"] == 150
    assert stats["used_today"] == 450
