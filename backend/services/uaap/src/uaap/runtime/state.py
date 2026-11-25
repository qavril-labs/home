"""Typed Agent State, Lifecycle Enums, and Approval Contracts for UAAP Milestone A3."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

from uaap.errors import UaapError
from uaap.gateway.types import Message


class AgentStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


# Canonical 5-Tier Permission Model (Frozen UAAP Standard)
CANONICAL_TIERS: dict[int, str] = {
    1: "Read-Only (Autonomous read operations, read-only queries, no side effects)",
    2: "Non-Binding Draft (Autonomous drafting of messages/plans/tickets, non-binding)",
    3: "Approval-Required (Binding/sensitive mutations, financial, external communications)",
    4: (
        "Operational Write (Low-risk, reversible, schema-validated operational writes only; "
        "no financial/identity)"
    ),
    5: "Permanently Blocked (Raw SQL, table drop, audit tampering, auth bypass, secret exfiltration)",
}

# Valid State Transitions
VALID_TRANSITIONS: dict[AgentStatus, set[AgentStatus]] = {
    AgentStatus.PENDING: {AgentStatus.RUNNING, AgentStatus.FAILED, AgentStatus.CANCELLED},
    AgentStatus.RUNNING: {
        AgentStatus.AWAITING_APPROVAL,
        AgentStatus.COMPLETED,
        AgentStatus.FAILED,
        AgentStatus.CANCELLED,
    },
    AgentStatus.AWAITING_APPROVAL: {
        AgentStatus.RUNNING,
        AgentStatus.REJECTED,
        AgentStatus.CANCELLED,
        AgentStatus.FAILED,
    },
    AgentStatus.COMPLETED: set(),
    AgentStatus.FAILED: set(),
    AgentStatus.REJECTED: set(),
    AgentStatus.CANCELLED: set(),
}


def validate_state_transition(current: AgentStatus, target: AgentStatus) -> None:
    """Enforce valid runtime state transitions; reject invalid transitions with typed error."""
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise UaapError(
            "VALIDATION",
            f"Invalid agent state transition from {current.value} to {target.value}",
            {
                "current_state": current.value,
                "target_state": target.value,
                "allowed": [s.value for s in allowed],
            },
        )


def compute_payload_hash(payload: dict[str, Any]) -> str:
    """Deterministic SHA-256 hash of canonicalized JSON payload."""
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ApprovalRequest:
    approval_id: str
    run_id: str
    tenant_id: str
    initiating_actor_id: str
    action_name: str
    risk_tier: int  # Must equal 3 for approval-required
    summary: str
    proposed_payload: dict[str, Any]
    payload_hash: str  # Immutable SHA-256 of proposed_payload
    single_use_token_hash: str  # SHA-256 hash only; raw token is NEVER persisted
    created_at: datetime
    expires_at: datetime
    status: ApprovalStatus = ApprovalStatus.PENDING
    approving_actor_id: str | None = None
    rejection_reason: str | None = None

    def __post_init__(self) -> None:
        if self.risk_tier != 3:
            raise UaapError(
                "VALIDATION",
                f"ApprovalRequest only applies to Tier 3 actions, got Tier {self.risk_tier}",
                {"risk_tier": self.risk_tier},
            )


@dataclass(frozen=True)
class AgentState:
    run_id: str
    tenant_id: str
    actor_id: str
    step_count: int = 0
    max_steps: int = 25
    status: AgentStatus = AgentStatus.PENDING
    messages: tuple[Message, ...] = ()
    working_context: dict[str, Any] = field(default_factory=dict)
    pending_approval: ApprovalRequest | None = None
    error: str | None = None
    agent_id: str | None = None
