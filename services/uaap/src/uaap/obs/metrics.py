"""Per-agent metrics. In memory until the A5 database; shape is stable so a persistent sink can replace it.

Counted per agent and tenant: requests, outcomes by status, error codes, guardrail events,
approvals (requested, approved, rejected), tool calls, model calls and latency.
"""

from __future__ import annotations

import threading
from collections import Counter, deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

_LATENCY_WINDOW = 500


@dataclass
class _AgentStats:
    requests: int = 0
    statuses: Counter[str] = field(default_factory=Counter)
    errors: Counter[str] = field(default_factory=Counter)
    guardrails: Counter[str] = field(default_factory=Counter)
    approvals: Counter[str] = field(default_factory=Counter)
    tool_calls: int = 0
    model_calls: int = 0
    latency_ms: deque[int] = field(default_factory=lambda: deque(maxlen=_LATENCY_WINDOW))
    latency_max_ms: int = 0


def _percentile(values: list[int], pct: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(pct * (len(ordered) - 1))))
    return ordered[index]


class AgentMetrics:
    def __init__(self, on_record: Callable[[str, dict[str, Any]], None] | None = None) -> None:
        """`on_record(tenant_id, row)` receives every event, e.g. to queue it for Postgres."""
        self._on_record = on_record
        self._stats: dict[tuple[str, str], _AgentStats] = {}
        self._lock = threading.Lock()

    def _get(self, agent_id: str, tenant_id: str) -> _AgentStats:
        key = (agent_id, tenant_id)
        stats = self._stats.get(key)
        if stats is None:
            stats = self._stats[key] = _AgentStats()
        return stats

    def record_request(
        self,
        agent_id: str,
        tenant_id: str,
        *,
        status: str,
        latency_ms: int,
        error_code: str | None = None,
        guardrail_events: list[str] | None = None,
        tool_calls: int = 0,
        model_calls: int = 0,
        approval_requested: bool = False,
    ) -> None:
        with self._lock:
            stats = self._get(agent_id, tenant_id)
            stats.requests += 1
            stats.statuses[status] += 1
            if error_code:
                stats.errors[error_code] += 1
            for event in guardrail_events or []:
                stats.guardrails[event] += 1
            stats.tool_calls += tool_calls
            stats.model_calls += model_calls
            if approval_requested:
                stats.approvals["requested"] += 1
            stats.latency_ms.append(latency_ms)
            stats.latency_max_ms = max(stats.latency_max_ms, latency_ms)
        if self._on_record is not None:
            self._on_record(
                tenant_id,
                {
                    "agent_id": agent_id,
                    "kind": "request",
                    "status": status,
                    "latency_ms": latency_ms,
                    "error_code": error_code,
                    "guardrail_events": list(guardrail_events or []),
                    "tool_calls": tool_calls,
                    "model_calls": model_calls,
                },
            )

    def record_approval(self, agent_id: str, tenant_id: str, decision: str) -> None:
        with self._lock:
            self._get(agent_id, tenant_id).approvals[decision] += 1
        if self._on_record is not None:
            self._on_record(
                tenant_id,
                {
                    "agent_id": agent_id,
                    "kind": "approval",
                    "status": decision,
                    "latency_ms": 0,
                    "error_code": None,
                    "guardrail_events": [],
                    "tool_calls": 0,
                    "model_calls": 0,
                },
            )

    def snapshot(self, agent_id: str | None = None, tenant_id: str | None = None) -> dict[str, Any]:
        """Aggregated metrics per agent, optionally filtered to one agent or tenant."""
        with self._lock:
            grouped: dict[str, list[tuple[str, _AgentStats]]] = {}
            for (aid, tid), stats in self._stats.items():
                if (agent_id is None or aid == agent_id) and (tenant_id is None or tid == tenant_id):
                    grouped.setdefault(aid, []).append((tid, stats))
            out: dict[str, Any] = {}
            for aid, rows in grouped.items():
                statuses: Counter[str] = Counter()
                errors: Counter[str] = Counter()
                guardrails: Counter[str] = Counter()
                approvals: Counter[str] = Counter()
                latencies: list[int] = []
                requests = tool_calls = model_calls = latency_max = 0
                for _, s in rows:
                    requests += s.requests
                    statuses.update(s.statuses)
                    errors.update(s.errors)
                    guardrails.update(s.guardrails)
                    approvals.update(s.approvals)
                    tool_calls += s.tool_calls
                    model_calls += s.model_calls
                    latencies.extend(s.latency_ms)
                    latency_max = max(latency_max, s.latency_max_ms)
                answered = statuses.get("answered", 0)
                out[aid] = {
                    "requests": requests,
                    "tenants": len(rows),
                    "statuses": dict(statuses),
                    "errors": dict(errors),
                    "guardrail_events": dict(guardrails),
                    "approvals": dict(approvals),
                    "tool_calls": tool_calls,
                    "model_calls": model_calls,
                    "answer_rate": round(answered / requests, 4) if requests else 0.0,
                    "failure_rate": round(statuses.get("failed", 0) / requests, 4) if requests else 0.0,
                    "latency_ms": {
                        "p50": _percentile(latencies, 0.5),
                        "p95": _percentile(latencies, 0.95),
                        "max": latency_max,
                        "window": len(latencies),
                    },
                }
            return out

    def reset(self) -> None:
        with self._lock:
            self._stats.clear()
