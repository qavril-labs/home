"""Bot API and approvals inbox (inbox calls may hit Postgres, so they run in a worker thread).

POST /v1/agents/{agent_id}/messages      talk to an agent
GET  /v1/agents                          agents available to the caller
GET  /v1/approvals?status=PENDING        the tenant's approvals inbox
GET  /v1/approvals/{approval_id}         one proposal with the exact payload to review
POST /v1/approvals/{approval_id}/decision approve or reject; approve must confirm the payload hash

Identity always comes from Core SaaS (`get_trusted_caller`). Approval tokens never leave the server.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from uaap.agents.base import AgentCatalog, AgentInput, AgentReply, BaseAgent
from uaap.api.deps import get_agent_catalog, get_approval_inbox, get_trusted_caller
from uaap.approvals.inbox import ApprovalInbox, InboxItem, InboxStatus
from uaap.errors import UaapError
from uaap.tools.types import CallerContext

router = APIRouter()

_DATE = r"^\d{4}-\d{2}-\d{2}$"
_UUID = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"


class MessageBody(BaseModel):
    message: str = Field(..., max_length=20_000)
    company_id: str | None = Field(None, pattern=_UUID)
    today: str | None = Field(None, pattern=_DATE, description="Business date; defaults to today in UTC.")


class DecisionBody(BaseModel):
    decision: Literal["approve", "reject"]
    payload_hash: str | None = Field(
        None, description="Required to approve: hash of the payload you reviewed."
    )
    reason: str | None = Field(None, max_length=500)


def _agent(catalog: AgentCatalog, agent_id: str) -> BaseAgent:
    agent = catalog.get(agent_id)
    if agent is None:
        raise UaapError("NOT_FOUND", "Agent not found", {"agent_id": agent_id})
    return agent


def _reply_json(reply: AgentReply) -> dict[str, Any]:
    approval = None
    if reply.approval is not None:
        approval = {
            "approval_id": reply.approval.approval_id,
            "summary": reply.approval.summary,
            "expires_at": reply.approval.expires_at.isoformat(),
        }
    # approval_token is deliberately absent: it stays in the inbox on the server.
    return {
        "status": reply.status,
        "text": reply.text,
        "run_id": reply.run_id,
        "approval": approval,
        "error_code": reply.error_code,
        "guardrail_events": list(reply.guardrail_events),
        "data": reply.data,
    }


@router.get("/v1/agents")
async def list_agents(
    caller: Annotated[CallerContext, Depends(get_trusted_caller)],
    catalog: Annotated[AgentCatalog, Depends(get_agent_catalog)],
) -> dict[str, Any]:
    return {
        "agents": [
            {
                "agent_id": a.card.agent_id,
                "name": a.card.name,
                "purpose": a.card.purpose,
                "enabled": a.enabled,
                "use_cases": [{"title": u.title, "example": u.example} for u in a.card.use_cases],
                "out_of_scope": list(a.card.out_of_scope),
            }
            for a in catalog.all()
        ]
    }


@router.post("/v1/agents/{agent_id}/messages")
async def send_message(
    agent_id: str,
    body: MessageBody,
    caller: Annotated[CallerContext, Depends(get_trusted_caller)],
    catalog: Annotated[AgentCatalog, Depends(get_agent_catalog)],
    inbox: Annotated[ApprovalInbox, Depends(get_approval_inbox)],
) -> dict[str, Any]:
    agent = _agent(catalog, agent_id)
    today = body.today or datetime.now(UTC).date().isoformat()
    reply = await agent.respond(
        caller, AgentInput(message=body.message, today=today, company_id=body.company_id)
    )
    if reply.status == "awaiting_approval" and reply.approval is not None and reply.approval_token:
        a = reply.approval
        await asyncio.to_thread(
            inbox.add,
            InboxItem(
                approval_id=a.approval_id,
                tenant_id=caller.tenant_id,
                run_id=a.run_id,
                agent_id=agent.card.agent_id,
                initiator_id=caller.actor_id,
                action=a.action_name,
                summary=a.summary,
                payload=a.proposed_payload,
                payload_hash=a.payload_hash,
                created_at=a.created_at,
                expires_at=a.expires_at,
            ),
            reply.approval_token,
        )
    return _reply_json(reply)


@router.get("/v1/approvals")
async def list_approvals(
    caller: Annotated[CallerContext, Depends(get_trusted_caller)],
    inbox: Annotated[ApprovalInbox, Depends(get_approval_inbox)],
    status: Literal["PENDING", "APPROVED", "REJECTED", "FAILED", "EXPIRED"] | None = None,
) -> dict[str, Any]:
    items = [i.public(caller.actor_id) for i in await asyncio.to_thread(inbox.list, caller.tenant_id)]
    if status:
        items = [i for i in items if i["status"] == status]
    return {"approvals": items}


@router.get("/v1/approvals/{approval_id}")
async def get_approval(
    approval_id: str,
    caller: Annotated[CallerContext, Depends(get_trusted_caller)],
    inbox: Annotated[ApprovalInbox, Depends(get_approval_inbox)],
) -> dict[str, Any]:
    item = await asyncio.to_thread(inbox.get, caller.tenant_id, approval_id)
    return item.public(caller.actor_id)


@router.post("/v1/approvals/{approval_id}/decision")
async def decide(
    approval_id: str,
    body: DecisionBody,
    caller: Annotated[CallerContext, Depends(get_trusted_caller)],
    catalog: Annotated[AgentCatalog, Depends(get_agent_catalog)],
    inbox: Annotated[ApprovalInbox, Depends(get_approval_inbox)],
) -> dict[str, Any]:
    item, token = await asyncio.to_thread(inbox.claim, caller.tenant_id, approval_id)
    if caller.actor_id == item.initiator_id:
        await asyncio.to_thread(inbox.release, item, token)
        raise UaapError("FORBIDDEN", "You cannot decide your own proposal")
    if datetime.now(UTC) > item.expires_at:
        await asyncio.to_thread(inbox.resolve, item, "EXPIRED", caller.actor_id, "Expired before a decision")
        raise UaapError("APPROVAL_EXPIRED", "This approval has expired")
    agent = _agent(catalog, item.agent_id)

    if body.decision == "reject":
        reply = await agent.reject(
            caller, run_id=item.run_id, approval_id=approval_id, reason=body.reason or "Rejected by approver"
        )
        updated = await asyncio.to_thread(
            inbox.resolve, item, "REJECTED", caller.actor_id, body.reason or "Rejected"
        )
        return {"approval": updated.public(caller.actor_id), "reply": _reply_json(reply)}

    if body.payload_hash != item.payload_hash:
        await asyncio.to_thread(inbox.release, item, token)
        raise UaapError("VALIDATION", "payload_hash does not match the proposal; review it again")
    try:
        reply = await agent.approve(
            caller,
            run_id=item.run_id,
            approval_id=approval_id,
            approval_token=token,
            confirmed_payload=item.payload,
        )
    except UaapError as exc:
        if exc.code in ("FORBIDDEN", "UNAUTHENTICATED"):
            await asyncio.to_thread(inbox.release, item, token)  # Refused before the approval was used.
        else:
            await asyncio.to_thread(
                inbox.resolve,
                item,
                "EXPIRED" if exc.code == "APPROVAL_EXPIRED" else "FAILED",
                caller.actor_id,
                exc.code,
            )
        raise
    status: InboxStatus = "APPROVED" if reply.status == "answered" else "FAILED"
    updated = await asyncio.to_thread(
        inbox.resolve, item, status, caller.actor_id, reply.error_code or reply.status
    )
    return {"approval": updated.public(caller.actor_id), "reply": _reply_json(reply)}
