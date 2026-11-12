"""Durable versions of the runtime stores: memory first, Postgres as the source of truth across restarts.

Writes go to Postgres before the call returns (so an acknowledged approval or run step is never lost)
and reads fall back to Postgres when memory has not seen the record, e.g. after a restart.
"""

from __future__ import annotations

import asyncio
import dataclasses
from datetime import UTC, datetime
from typing import Any

from psycopg.types.json import Jsonb

from uaap.approvals.inbox import InboxItem
from uaap.db.state import PgState
from uaap.runtime.checkpointer.base import CheckpointRecord
from uaap.runtime.checkpointer.in_memory import InMemoryCheckpointStore
from uaap.runtime.state import ApprovalRequest, ApprovalStatus
from uaap.tools.idempotency import InMemoryIdempotencyStore
from uaap.tools.types import ToolResult


class DurableCheckpointStore(InMemoryCheckpointStore):
    def __init__(self, state: PgState) -> None:
        super().__init__()
        self._pg = state

    async def put(
        self,
        tenant_id: str,
        run_id: str,
        checkpoint_id: str,
        state: dict[str, Any],
        metadata: dict[str, Any],
    ) -> None:
        await super().put(tenant_id, run_id, checkpoint_id, state, metadata)
        value = {"state": state, "metadata": metadata, "created_at": datetime.now(UTC).isoformat()}
        await asyncio.to_thread(self._pg.put, tenant_id, "checkpoint", f"{run_id}/{checkpoint_id}", value)

    async def get(
        self, tenant_id: str, run_id: str, checkpoint_id: str | None = None
    ) -> CheckpointRecord | None:
        found = await super().get(tenant_id, run_id, checkpoint_id)
        if found is not None:
            return found
        if checkpoint_id is not None:
            value = await asyncio.to_thread(
                self._pg.get, tenant_id, "checkpoint", f"{run_id}/{checkpoint_id}"
            )
            return self._record(tenant_id, run_id, checkpoint_id, value) if value else None
        rows = await asyncio.to_thread(self._pg.list_prefix, tenant_id, "checkpoint", f"{run_id}/")
        if not rows:
            return None
        key, value = rows[0]
        return self._record(tenant_id, run_id, key.split("/", 1)[1], value)

    @staticmethod
    def _record(tenant_id: str, run_id: str, checkpoint_id: str, value: dict[str, Any]) -> CheckpointRecord:
        return CheckpointRecord(
            tenant_id=tenant_id,
            run_id=run_id,
            checkpoint_id=checkpoint_id,
            state=value["state"],
            metadata=value.get("metadata", {}),
            created_at=datetime.fromisoformat(value["created_at"]),
        )


def approval_to_json(a: ApprovalRequest) -> dict[str, Any]:
    return {
        "approval_id": a.approval_id,
        "run_id": a.run_id,
        "tenant_id": a.tenant_id,
        "initiating_actor_id": a.initiating_actor_id,
        "action_name": a.action_name,
        "risk_tier": a.risk_tier,
        "summary": a.summary,
        "proposed_payload": a.proposed_payload,
        "payload_hash": a.payload_hash,
        "single_use_token_hash": a.single_use_token_hash,
        "created_at": a.created_at.isoformat(),
        "expires_at": a.expires_at.isoformat(),
        "status": a.status.value,
        "approving_actor_id": a.approving_actor_id,
        "rejection_reason": a.rejection_reason,
    }


def approval_from_json(v: dict[str, Any]) -> ApprovalRequest:
    return ApprovalRequest(
        approval_id=v["approval_id"],
        run_id=v["run_id"],
        tenant_id=v["tenant_id"],
        initiating_actor_id=v["initiating_actor_id"],
        action_name=v["action_name"],
        risk_tier=v["risk_tier"],
        summary=v["summary"],
        proposed_payload=v["proposed_payload"],
        payload_hash=v["payload_hash"],
        single_use_token_hash=v["single_use_token_hash"],
        created_at=datetime.fromisoformat(v["created_at"]),
        expires_at=datetime.fromisoformat(v["expires_at"]),
        status=ApprovalStatus(v["status"]),
        approving_actor_id=v.get("approving_actor_id"),
        rejection_reason=v.get("rejection_reason"),
    )


class PgApprovalRecords:
    """Persistence hook for ApprovalEngine (records hold only the token hash, never the token)."""

    def __init__(self, state: PgState) -> None:
        self._pg = state

    async def save(self, approval: ApprovalRequest) -> None:
        await asyncio.to_thread(
            self._pg.put, approval.tenant_id, "approval", approval.approval_id, approval_to_json(approval)
        )

    async def load(self, tenant_id: str, approval_id: str) -> ApprovalRequest | None:
        value = await asyncio.to_thread(self._pg.get, tenant_id, "approval", approval_id)
        return approval_from_json(value) if value else None


class DurableIdempotencyStore(InMemoryIdempotencyStore):
    def __init__(self, state: PgState) -> None:
        super().__init__()
        self._pg = state

    def lookup(self, tenant_id: str, tool_name: str, key: str, arguments_hash: str) -> ToolResult | None:
        found = super().lookup(tenant_id, tool_name, key, arguments_hash)
        if found is not None:
            return found
        value = self._pg.get(tenant_id, "idempotency", f"{tool_name}/{key}")
        if value is None:
            return None
        result = ToolResult(
            tool_name=value["tool_name"],
            tier=value["tier"],
            output=value["output"],
            is_ai_draft=value["is_ai_draft"],
        )
        super().store(tenant_id, tool_name, key, value["arguments_hash"], result)
        return super().lookup(tenant_id, tool_name, key, arguments_hash)  # Raises on argument mismatch.

    def store(
        self, tenant_id: str, tool_name: str, key: str, arguments_hash: str, result: ToolResult
    ) -> None:
        super().store(tenant_id, tool_name, key, arguments_hash, result)
        self._pg.put(
            tenant_id,
            "idempotency",
            f"{tool_name}/{key}",
            {
                "arguments_hash": arguments_hash,
                "tool_name": result.tool_name,
                "tier": result.tier,
                "output": result.output,
                "is_ai_draft": result.is_ai_draft,
            },
        )


class PgInboxHistory:
    """Synchronous inbox history for ApprovalInbox (`uaap.approvals`)."""

    def __init__(self, state: PgState) -> None:
        self._pg = state

    def save(self, item: InboxItem) -> None:
        record = dataclasses.asdict(item)
        record["payload"] = Jsonb(item.payload)
        self._pg.save_approval(record)

    def load(self, tenant_id: str, approval_id: str | None = None) -> list[InboxItem]:
        fields = {f.name for f in dataclasses.fields(InboxItem)}
        return [
            InboxItem(**{k: v for k, v in row.items() if k in fields})
            for row in self._pg.approvals(tenant_id, approval_id)
        ]
