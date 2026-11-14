"""Human-in-the-Loop Approval Engine with constant-time token verification and atomic consumption."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from uaap.errors import UaapError
from uaap.obs.audit import AuditEvent, AuditSink
from uaap.runtime.state import (
    ApprovalRequest,
    ApprovalStatus,
    compute_payload_hash,
)


class ApprovalRecords(Protocol):
    async def save(self, approval: ApprovalRequest) -> None: ...

    async def load(self, tenant_id: str, approval_id: str) -> ApprovalRequest | None: ...


class ApprovalEngine:
    """Manages Tier-3 Human-in-the-Loop approval requests, dual-control, and token lifecycle."""

    def __init__(
        self,
        audit_sink: AuditSink | None = None,
        *,
        records: ApprovalRecords | None = None,
        token_secret: bytes | None = None,
    ) -> None:
        """`records` makes approvals durable; `token_secret` derives tokens so none is ever stored.

        With a secret, the token for an approval is HMAC-SHA256(secret, tenant|approval_id). The
        record keeps only its SHA-256 hash, so a restart loses nothing and the database holds no token.
        """
        if token_secret is not None and len(token_secret) < 32:
            raise UaapError("VALIDATION", "Approval token secret must be at least 32 bytes")
        self._records = records
        self._secret = token_secret
        self._audit_sink = audit_sink
        self._lock = asyncio.Lock()
        # Storage keyed by (tenant_id, approval_id)
        self._approvals: dict[tuple[str, str], ApprovalRequest] = {}

    def token_for(self, tenant_id: str, approval_id: str) -> str:
        if self._secret is None:
            raise UaapError("INTERNAL", "Approval tokens are random; no secret is configured")
        mac = hmac.new(self._secret, f"{tenant_id}|{approval_id}".encode(), hashlib.sha256)
        return mac.hexdigest()

    async def _lookup(self, tenant_id: str, approval_id: str) -> ApprovalRequest | None:
        found = self._approvals.get((tenant_id, approval_id))
        if found is None and self._records is not None:
            found = await self._records.load(tenant_id, approval_id)
            if found is not None:
                self._approvals[(tenant_id, approval_id)] = found
        return found

    async def _persist(self, approval: ApprovalRequest) -> None:
        if self._records is not None:
            await self._records.save(approval)

    def _emit_audit(self, event: AuditEvent) -> None:
        if self._audit_sink is not None:
            self._audit_sink.emit(event)

    async def request_approval(
        self,
        *,
        run_id: str,
        tenant_id: str,
        initiating_actor_id: str,
        action_name: str,
        summary: str,
        proposed_payload: dict[str, Any],
        risk_tier: int = 3,
        ttl_seconds: int = 300,
    ) -> tuple[ApprovalRequest, str]:
        """Create an approval request for a Tier-3 action. Returns (ApprovalRequest, raw_token)."""
        if risk_tier == 5:
            raise UaapError(
                "FORBIDDEN",
                f"Action '{action_name}' is Tier 5 (Permanently Blocked) and cannot be approved",
                {"action_name": action_name, "risk_tier": 5},
            )

        if risk_tier != 3:
            raise UaapError(
                "VALIDATION",
                f"Approval is strictly reserved for Tier 3 actions, got Tier {risk_tier}",
                {"action_name": action_name, "risk_tier": risk_tier},
            )

        if not tenant_id or not run_id or not initiating_actor_id:
            raise UaapError("VALIDATION", "tenant_id, run_id, and initiating_actor_id are required")

        # 2. Compute immutable payload hash
        payload_hash = compute_payload_hash(proposed_payload)

        # 3. Establish timestamps
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=ttl_seconds)
        approval_id = f"appr_{uuid.uuid4().hex[:12]}"
        # High-entropy single-use token: random, or derived from the server secret (never stored).
        raw_token = self.token_for(tenant_id, approval_id) if self._secret else secrets.token_urlsafe(32)
        single_use_token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        # 4. Create immutable record with hash only (raw token NEVER stored)
        approval = ApprovalRequest(
            approval_id=approval_id,
            run_id=run_id,
            tenant_id=tenant_id,
            initiating_actor_id=initiating_actor_id,
            action_name=action_name,
            risk_tier=3,
            summary=summary,
            proposed_payload=proposed_payload,
            payload_hash=payload_hash,
            single_use_token_hash=single_use_token_hash,
            created_at=now,
            expires_at=expires_at,
            status=ApprovalStatus.PENDING,
        )

        async with self._lock:
            self._approvals[(tenant_id, approval_id)] = approval
            await self._persist(approval)

        self._emit_audit(
            AuditEvent(
                at=now,
                request_id=approval_id,
                tenant_id=tenant_id,
                actor_id=initiating_actor_id,
                action="approval.requested",
                outcome="pending",
                prompt_hash=payload_hash,
            )
        )

        # Return raw token once to caller for out-of-band delivery to human approver
        return approval, raw_token

    async def approve(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approval_id: str,
        approving_actor_id: str,
        presented_raw_token: str,
        confirmed_payload: dict[str, Any],
    ) -> ApprovalRequest:
        """Indivisible atomic single-use approval verification and token consumption."""
        async with self._lock:
            key = (tenant_id, approval_id)
            approval = await self._lookup(tenant_id, approval_id)
            if approval is None:
                raise UaapError(
                    "NOT_FOUND",
                    "Approval request not found for tenant",
                    {"approval_id": approval_id},
                )

            if approval.run_id != run_id:
                raise UaapError("FORBIDDEN", "Approval does not belong to specified run")

            # Check single-use / replay
            if approval.status == ApprovalStatus.APPROVED or not approval.single_use_token_hash:
                raise UaapError(
                    "APPROVAL_ALREADY_CONSUMED",
                    "Approval token has already been consumed and cannot be replayed",
                    {"approval_id": approval_id},
                )

            if approval.status != ApprovalStatus.PENDING:
                raise UaapError(
                    "VALIDATION",
                    f"Approval is in '{approval.status.value}' state and cannot be approved",
                    {"status": approval.status.value},
                )

            now = datetime.now(UTC)

            # Check expiry
            if now > approval.expires_at:
                expired = ApprovalRequest(
                    approval_id=approval.approval_id,
                    run_id=approval.run_id,
                    tenant_id=approval.tenant_id,
                    initiating_actor_id=approval.initiating_actor_id,
                    action_name=approval.action_name,
                    risk_tier=approval.risk_tier,
                    summary=approval.summary,
                    proposed_payload=approval.proposed_payload,
                    payload_hash=approval.payload_hash,
                    single_use_token_hash="",  # Invalidate token hash
                    created_at=approval.created_at,
                    expires_at=approval.expires_at,
                    status=ApprovalStatus.EXPIRED,
                    rejection_reason="Approval expired before decision",
                )
                self._approvals[key] = expired
                await self._persist(expired)
                self._emit_audit(
                    AuditEvent(
                        at=now,
                        request_id=approval_id,
                        tenant_id=tenant_id,
                        actor_id=approving_actor_id,
                        action="approval.expired",
                        outcome="rejected",
                    )
                )
                raise UaapError(
                    "APPROVAL_EXPIRED",
                    "Approval request has expired",
                    {"approval_id": approval_id},
                )

            # Check dual-control separation of duties
            if approving_actor_id == approval.initiating_actor_id:
                raise UaapError(
                    "FORBIDDEN",
                    "Dual-control separation of duties violation: approver cannot be the initiator",
                    {"initiating_actor": approval.initiating_actor_id, "approving_actor": approving_actor_id},
                )

            # Constant-time token verification
            presented_hash = hashlib.sha256(presented_raw_token.encode("utf-8")).hexdigest()
            if not hmac.compare_digest(presented_hash, approval.single_use_token_hash):
                raise UaapError("UNAUTHENTICATED", "Invalid or mismatched approval token")

            # Verify payload integrity
            current_payload_hash = compute_payload_hash(confirmed_payload)
            if not hmac.compare_digest(current_payload_hash, approval.payload_hash):
                # Tampering detected: invalidate token and reject
                tampered = ApprovalRequest(
                    approval_id=approval.approval_id,
                    run_id=approval.run_id,
                    tenant_id=approval.tenant_id,
                    initiating_actor_id=approval.initiating_actor_id,
                    action_name=approval.action_name,
                    risk_tier=approval.risk_tier,
                    summary=approval.summary,
                    proposed_payload=approval.proposed_payload,
                    payload_hash=approval.payload_hash,
                    single_use_token_hash="",  # Invalidate
                    created_at=approval.created_at,
                    expires_at=approval.expires_at,
                    status=ApprovalStatus.REJECTED,
                    approving_actor_id=approving_actor_id,
                    rejection_reason="Payload tampering detected on approval",
                )
                self._approvals[key] = tampered
                await self._persist(tampered)
                self._emit_audit(
                    AuditEvent(
                        at=now,
                        request_id=approval_id,
                        tenant_id=tenant_id,
                        actor_id=approving_actor_id,
                        action="approval.tampered",
                        outcome="rejected",
                        prompt_hash=current_payload_hash,
                    )
                )
                raise UaapError("VALIDATION", "Confirmed payload hash does not match original proposal")

            # Indivisibly consume token and approve
            approved = ApprovalRequest(
                approval_id=approval.approval_id,
                run_id=approval.run_id,
                tenant_id=approval.tenant_id,
                initiating_actor_id=approval.initiating_actor_id,
                action_name=approval.action_name,
                risk_tier=approval.risk_tier,
                summary=approval.summary,
                proposed_payload=approval.proposed_payload,
                payload_hash=approval.payload_hash,
                single_use_token_hash="",  # Token consumed
                created_at=approval.created_at,
                expires_at=approval.expires_at,
                status=ApprovalStatus.APPROVED,
                approving_actor_id=approving_actor_id,
            )
            self._approvals[key] = approved
            await self._persist(approved)

            self._emit_audit(
                AuditEvent(
                    at=now,
                    request_id=approval_id,
                    tenant_id=tenant_id,
                    actor_id=approving_actor_id,
                    action="approval.accepted",
                    outcome="success",
                    prompt_hash=approval.payload_hash,
                )
            )

            return approved

    async def reject(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approval_id: str,
        rejecting_actor_id: str,
        reason: str = "Rejected by human approver",
    ) -> ApprovalRequest:
        """Reject approval request, invalidate token hash, and transition to REJECTED."""
        async with self._lock:
            key = (tenant_id, approval_id)
            approval = await self._lookup(tenant_id, approval_id)
            if approval is None:
                raise UaapError(
                    "NOT_FOUND",
                    "Approval request not found for tenant",
                    {"approval_id": approval_id},
                )

            if approval.run_id != run_id:
                raise UaapError("FORBIDDEN", "Approval does not belong to specified run")

            if approval.status != ApprovalStatus.PENDING:
                raise UaapError("VALIDATION", f"Cannot reject approval in status {approval.status.value}")

            now = datetime.now(UTC)
            rejected = ApprovalRequest(
                approval_id=approval.approval_id,
                run_id=approval.run_id,
                tenant_id=approval.tenant_id,
                initiating_actor_id=approval.initiating_actor_id,
                action_name=approval.action_name,
                risk_tier=approval.risk_tier,
                summary=approval.summary,
                proposed_payload=approval.proposed_payload,
                payload_hash=approval.payload_hash,
                single_use_token_hash="",  # Invalidate token hash
                created_at=approval.created_at,
                expires_at=approval.expires_at,
                status=ApprovalStatus.REJECTED,
                approving_actor_id=rejecting_actor_id,
                rejection_reason=reason,
            )
            self._approvals[key] = rejected
            await self._persist(rejected)

            self._emit_audit(
                AuditEvent(
                    at=now,
                    request_id=approval_id,
                    tenant_id=tenant_id,
                    actor_id=rejecting_actor_id,
                    action="approval.rejected",
                    outcome="rejected",
                    prompt_hash=approval.payload_hash,
                )
            )

            return rejected

    async def get_approval(self, tenant_id: str, approval_id: str) -> ApprovalRequest | None:
        async with self._lock:
            return await self._lookup(tenant_id, approval_id)

    async def clear_all(self) -> None:
        async with self._lock:
            self._approvals.clear()
