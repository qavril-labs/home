"""Pending proposals awaiting a person's decision, per tenant.

The single-use approval token is held here, server-side, and is never returned by any API. Approvers
decide in the inbox instead: they must be signed in, be a different person from the initiator, hold
the product permission, and confirm the hash of the exact payload they reviewed.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any, Literal, Protocol

from uaap.errors import UaapError

InboxStatus = Literal["PENDING", "APPROVED", "REJECTED", "FAILED", "EXPIRED"]


@dataclass(frozen=True)
class InboxItem:
    approval_id: str
    tenant_id: str
    run_id: str
    agent_id: str
    initiator_id: str
    action: str
    summary: str
    payload: dict[str, Any]
    payload_hash: str
    created_at: datetime
    expires_at: datetime
    status: InboxStatus = "PENDING"
    decided_by: str | None = None
    decided_at: datetime | None = None
    outcome: str | None = None

    def public(self, viewer_id: str) -> dict[str, Any]:
        expired = self.status == "PENDING" and datetime.now(UTC) > self.expires_at
        return {
            "approval_id": self.approval_id,
            "run_id": self.run_id,
            "agent_id": self.agent_id,
            "initiator_id": self.initiator_id,
            "action": self.action,
            "summary": self.summary,
            "payload": self.payload,
            "payload_hash": self.payload_hash,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "status": "EXPIRED" if expired else self.status,
            # Dual control: the initiator can see but never decide their own proposal.
            "can_decide": self.status == "PENDING" and not expired and viewer_id != self.initiator_id,
            "decided_by": self.decided_by,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "outcome": self.outcome,
        }


class InboxHistory(Protocol):
    """Durable record of inbox items (Postgres `uaap.approvals`)."""

    def save(self, item: InboxItem) -> None: ...

    def load(self, tenant_id: str, approval_id: str | None = None) -> list[InboxItem]: ...


class ApprovalInbox:
    def __init__(
        self,
        on_change: Callable[[InboxItem], None] | None = None,
        *,
        history: InboxHistory | None = None,
        token_for: Callable[[str, str], str] | None = None,
    ) -> None:
        """`history` makes the inbox survive restarts. `token_for` derives each approval's token from
        the server secret, so no token is held anywhere; without it tokens are kept in memory only.
        Methods may block on the database: call them with `asyncio.to_thread` from async code.
        """
        self._on_change = on_change
        self._history = history
        self._token_for = token_for
        self._items: dict[tuple[str, str], InboxItem] = {}
        self._tokens: dict[tuple[str, str], str] = {}
        self._claimed: set[tuple[str, str]] = set()
        self._lock = threading.Lock()

    def _changed(self, item: InboxItem) -> None:
        if self._history is not None:
            self._history.save(item)
        if self._on_change is not None:
            self._on_change(item)

    def add(self, item: InboxItem, token: str) -> None:
        with self._lock:
            key = (item.tenant_id, item.approval_id)
            self._items[key] = item
            if self._token_for is None:
                self._tokens[key] = token
        self._changed(item)

    def list(self, tenant_id: str, status: str | None = None) -> list[InboxItem]:
        merged: dict[str, InboxItem] = {}
        if self._history is not None:
            merged = {i.approval_id: i for i in self._history.load(tenant_id)}
        with self._lock:
            merged.update({a: i for (t, a), i in self._items.items() if t == tenant_id})
        items = list(merged.values())
        if status:
            items = [i for i in items if i.status == status]
        return sorted(items, key=lambda i: i.created_at, reverse=True)

    def get(self, tenant_id: str, approval_id: str) -> InboxItem:
        with self._lock:
            item = self._items.get((tenant_id, approval_id))
        if item is None and self._history is not None:
            found = self._history.load(tenant_id, approval_id)
            if found:
                item = found[0]
                with self._lock:
                    self._items.setdefault((tenant_id, approval_id), item)
        if item is None:
            raise UaapError("NOT_FOUND", "Approval not found", {"approval_id": approval_id})
        return item

    def claim(self, tenant_id: str, approval_id: str) -> tuple[InboxItem, str]:
        """Reserve one decision. A second concurrent decision on the same approval is refused."""
        item = self.get(tenant_id, approval_id)
        key = (tenant_id, approval_id)
        with self._lock:
            if item.status != "PENDING" or key in self._claimed:
                raise UaapError("APPROVAL_ALREADY_CONSUMED", "This approval has already been decided")
            if self._token_for is not None:
                token: str | None = self._token_for(tenant_id, approval_id)
            else:
                token = self._tokens.pop(key, None)
            if token is None:
                raise UaapError("APPROVAL_ALREADY_CONSUMED", "This approval has already been decided")
            self._claimed.add(key)
        return item, token

    def release(self, item: InboxItem, token: str) -> None:
        """Undo a claim that was refused before the approval was used (e.g. wrong approver)."""
        key = (item.tenant_id, item.approval_id)
        with self._lock:
            self._claimed.discard(key)
            if self._token_for is None:
                self._tokens.setdefault(key, token)

    def resolve(self, item: InboxItem, status: InboxStatus, decided_by: str, outcome: str) -> InboxItem:
        updated = replace(
            item, status=status, decided_by=decided_by, decided_at=datetime.now(UTC), outcome=outcome
        )
        key = (item.tenant_id, item.approval_id)
        with self._lock:
            self._items[key] = updated
            self._tokens.pop(key, None)
            self._claimed.discard(key)
        self._changed(updated)
        return updated
