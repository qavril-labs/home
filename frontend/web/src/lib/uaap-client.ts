/**
 * Client for the UAAP bot API (contracts/openapi.yaml, operations listAgents, listApprovals,
 * getApproval, decideApproval, sendAgentMessage). Served by services/uaap, not the core API.
 *
 * Rules (docs/ui-contract.md): every figure comes from the API, nothing is invented, and an
 * action is shown as done only after the API confirms it. There is no offline fallback data.
 * Field names are snake_case, as the server returns them.
 */
import { getApiSessionToken } from "./api-client";

export type UaapApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "FAILED" | "EXPIRED";

export interface UaapApproval {
  approval_id: string;
  run_id: string;
  agent_id: string;
  initiator_id: string;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  created_at: string;
  expires_at: string;
  status: UaapApprovalStatus;
  can_decide: boolean;
  decided_by: string | null;
  decided_at: string | null;
  outcome: string | null;
}

export interface UaapAgent {
  agent_id: string;
  name: string;
  purpose: string;
  enabled: boolean;
  use_cases: { title: string; example: string }[];
  out_of_scope: string[];
}

export interface UaapReply {
  status: "answered" | "awaiting_approval" | "needs_clarification" | "refused" | "failed";
  text: string;
  run_id: string | null;
  approval: { approval_id: string; summary: string; expires_at: string } | null;
  error_code: string | null;
  guardrail_events: string[];
  data: Record<string, unknown>;
}

export interface UaapDecisionResult {
  approval: UaapApproval;
  reply: UaapReply;
}

export class UaapError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;

  constructor(code: string, message: string, status: number, requestId: string | null) {
    super(message);
    this.name = "UaapError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

/** The UAAP base URL: window.ERP_CONFIG.uaapBase, then VITE_UAAP_URL, then local development. */
export function getUaapBaseUrl(): string {
  if (typeof window !== "undefined") {
    const configured = (window as unknown as { ERP_CONFIG?: { uaapBase?: string } }).ERP_CONFIG?.uaapBase;
    if (configured) return configured.replace(/\/+$/, "");
  }
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_UAAP_URL ?? "http://localhost:8090").replace(/\/+$/, "");
}

/** Session tokens look like `<tenantId>.<random>`. The tenant is the part before the dot. */
export function tenantFromSession(): string | null {
  const token = getApiSessionToken();
  if (!token || !token.includes(".")) return null;
  return token.slice(0, token.indexOf("."));
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getApiSessionToken();
  const tenant = tenantFromSession();
  if (!token || !tenant) {
    throw new UaapError("UNAUTHENTICATED", "Sign in to see this.", 401, null);
  }
  let response: Response;
  try {
    response = await fetch(`${getUaapBaseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenant,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new UaapError("UPSTREAM_FAILED", "The approvals service is unreachable. Nothing was changed.", 0, null);
  }
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; request_id?: string } }
    | T
    | null;
  if (!response.ok) {
    const err = (body as { error?: { code?: string; message?: string; request_id?: string } } | null)?.error;
    throw new UaapError(
      err?.code ?? "INTERNAL",
      err?.message ?? "Something went wrong. Nothing was changed.",
      response.status,
      err?.request_id ?? null,
    );
  }
  return body as T;
}

export async function listAgents(): Promise<UaapAgent[]> {
  const body = await call<{ agents: UaapAgent[] }>("/v1/agents");
  return body.agents;
}

export async function listApprovals(status?: UaapApprovalStatus): Promise<UaapApproval[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const body = await call<{ approvals: UaapApproval[] }>(`/v1/approvals${query}`);
  return body.approvals;
}

export async function getApproval(approvalId: string): Promise<UaapApproval> {
  return call<UaapApproval>(`/v1/approvals/${encodeURIComponent(approvalId)}`);
}

/** Approve with the hash of the payload the person reviewed. The server refuses a mismatch. */
export async function approveProposal(approvalId: string, payloadHash: string): Promise<UaapDecisionResult> {
  return call<UaapDecisionResult>(`/v1/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: "POST",
    body: { decision: "approve", payload_hash: payloadHash },
  });
}

export async function rejectProposal(approvalId: string, reason: string): Promise<UaapDecisionResult> {
  return call<UaapDecisionResult>(`/v1/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: "POST",
    body: { decision: "reject", reason: reason.slice(0, 500) },
  });
}

export async function sendAgentMessage(
  agentId: string,
  message: string,
  companyId?: string,
): Promise<UaapReply> {
  return call<UaapReply>(`/v1/agents/${encodeURIComponent(agentId)}/messages`, {
    method: "POST",
    body: { message, ...(companyId ? { company_id: companyId } : {}) },
  });
}
