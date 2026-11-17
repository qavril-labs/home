import type { ApprovalRequest, ApprovalStatus, ApprovalStore } from "./approvals";

export class MemoryApprovalStore implements ApprovalStore {
  private readonly requests = new Map<string, ApprovalRequest>();

  async get(companyId: string, id: string): Promise<ApprovalRequest | undefined> {
    const request = this.requests.get(id);
    return request?.companyId === companyId ? request : undefined;
  }

  async save(request: ApprovalRequest): Promise<void> {
    this.requests.set(request.id, request);
  }

  async list(companyId: string, status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    return [...this.requests.values()]
      .filter((request) => request.companyId === companyId && (status === undefined || request.status === status))
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }
}
