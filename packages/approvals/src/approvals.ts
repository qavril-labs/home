import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";

/**
 * The approval queue (PLT-07). Every bot action and every sensitive change becomes a request here. A
 * person decides it, with a reason. The person who asked can never decide their own request.
 */
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalRequest {
  readonly id: string;
  readonly companyId: string;
  /** What is being approved, for example BOT_ACTION, CREDIT_NOTE or PURCHASE_ORDER. */
  readonly kind: string;
  /** Why the action is needed. Shown to the approver. */
  readonly reason: string;
  /** The action itself, as the approver will see it. Stored as written. */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestedBy: string;
  readonly status: ApprovalStatus;
  readonly requestedAt: string;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
}

export interface RequestInput {
  readonly companyId: string;
  readonly kind: string;
  readonly reason: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestedBy: string;
}

export interface ApprovalStore {
  get(companyId: string, id: string): Promise<ApprovalRequest | undefined>;
  save(request: ApprovalRequest): Promise<void>;
  list(companyId: string, status?: ApprovalStatus): Promise<ApprovalRequest[]>;
}

const KIND = /^[A-Z][A-Z_]{1,39}$/;

export function validateRequest(input: RequestInput): RequestInput {
  if (!KIND.test(input.kind)) {
    throw new DomainError("VALIDATION", "Approval kind must be upper case letters and underscores");
  }
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new DomainError("VALIDATION", "A reason of 10 to 500 characters is required");
  }
  if (!input.requestedBy) {
    throw new DomainError("VALIDATION", "The requester is required");
  }
  return { ...input, reason };
}

export class ApprovalQueue {
  constructor(private readonly store: ApprovalStore, private readonly clock: Clock = systemClock) {}

  async request(input: RequestInput): Promise<ApprovalRequest> {
    const valid = validateRequest(input);
    const request: ApprovalRequest = {
      id: newId(this.clock.now().getTime()),
      companyId: valid.companyId,
      kind: valid.kind,
      reason: valid.reason,
      payload: valid.payload,
      requestedBy: valid.requestedBy,
      status: "PENDING",
      requestedAt: this.clock.now().toISOString(),
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    };
    await this.store.save(request);
    return request;
  }

  async approve(companyId: string, id: string, approver: string, note?: string): Promise<ApprovalRequest> {
    return this.decide(companyId, id, approver, "APPROVED", note ?? null);
  }

  /** A rejection needs a reason, so the requester knows what to change. */
  async reject(companyId: string, id: string, approver: string, note: string): Promise<ApprovalRequest> {
    if (note.trim().length < 5) {
      throw new DomainError("VALIDATION", "A rejection needs a note of at least 5 characters");
    }
    return this.decide(companyId, id, approver, "REJECTED", note.trim());
  }

  /** Only the requester can withdraw, and only while the request is still pending. */
  async withdraw(companyId: string, id: string, requester: string): Promise<ApprovalRequest> {
    const request = await this.require(companyId, id);
    if (request.requestedBy !== requester) {
      throw new DomainError("FORBIDDEN", "Only the requester can withdraw a request");
    }
    this.assertPending(request);
    const updated: ApprovalRequest = { ...request, status: "WITHDRAWN", decidedBy: requester, decidedAt: this.clock.now().toISOString() };
    await this.store.save(updated);
    return updated;
  }

  async list(companyId: string, status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    return this.store.list(companyId, status);
  }

  async get(companyId: string, id: string): Promise<ApprovalRequest | undefined> {
    return this.store.get(companyId, id);
  }

  private async decide(
    companyId: string,
    id: string,
    approver: string,
    status: "APPROVED" | "REJECTED",
    note: string | null,
  ): Promise<ApprovalRequest> {
    const request = await this.require(companyId, id);
    this.assertPending(request);
    if (request.requestedBy === approver) {
      throw new DomainError("FORBIDDEN", "You cannot approve or reject your own request");
    }
    const updated: ApprovalRequest = {
      ...request,
      status,
      decidedBy: approver,
      decidedAt: this.clock.now().toISOString(),
      decisionNote: note,
    };
    await this.store.save(updated);
    return updated;
  }

  private async require(companyId: string, id: string): Promise<ApprovalRequest> {
    const request = await this.store.get(companyId, id);
    if (!request) {
      throw new DomainError("NOT_FOUND", "Approval request not found");
    }
    return request;
  }

  private assertPending(request: ApprovalRequest): void {
    if (request.status !== "PENDING") {
      throw new DomainError("CONFLICT", `This request is already ${request.status.toLowerCase()}`);
    }
  }
}
