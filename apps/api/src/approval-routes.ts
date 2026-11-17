import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { ApprovalQueue, APPROVAL_STATUSES, type ApprovalRequest } from "@erp/approvals";
import { hasPermission, type Principal } from "@erp/identity";
import { DomainError, type Clock } from "@erp/kernel";
import { PgApprovalStore, PgAuditStore, PgTenantRepository, withTenantTransaction, type Pool } from "@erp/db";

const RequestBody = z.object({
  companyId: z.uuid(),
  kind: z.string(),
  reason: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const DecisionBody = z.object({
  companyId: z.uuid(),
  note: z.string().optional(),
});

const ListQuery = z.object({
  companyId: z.uuid(),
  status: z.enum(APPROVAL_STATUSES).optional(),
});

const IdParams = z.object({ id: z.uuid() });

export interface ApprovalRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

/**
 * Approval queue routes (PLT-07). Requesting needs approvals.request; deciding needs approvals.decide,
 * and the requester can never decide their own request. Every decision is written to the audit chain.
 */
export function registerApprovalRoutes(app: FastifyInstance, deps: ApprovalRouteDeps): void {
  async function withQueue<T>(
    request: FastifyRequest,
    permission: string,
    companyId: string,
    work: (queue: ApprovalQueue, audit: AuditLog, principal: Principal) => Promise<T>,
  ): Promise<T> {
    const principal = await deps.authenticate(request);
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await new PgTenantRepository(tx).findCompany(companyId);
      if (!company) {
        throw new DomainError("NOT_FOUND", "Company not found");
      }
      const queue = new ApprovalQueue(new PgApprovalStore(tx, principal.tenantId), deps.clock);
      const audit = new AuditLog(new PgAuditStore(tx), deps.clock);
      return work(queue, audit, principal);
    });
  }

  /** Writes one audit entry for a decision, with the state before and after. */
  async function auditDecision(audit: AuditLog, tenantId: string, actor: string, action: string, before: ApprovalRequest, after: ApprovalRequest) {
    await audit.record({
      tenantId,
      actorId: actor,
      action,
      entityType: "approval",
      entityId: after.id,
      before: { status: before.status, decidedBy: before.decidedBy },
      after: { status: after.status, decidedBy: after.decidedBy, decisionNote: after.decisionNote },
    });
  }

  app.post("/v1/approvals", async (request, reply) => {
    const body = RequestBody.parse(request.body);
    const created = await withQueue(request, "approvals.request", body.companyId, async (queue, audit, principal) => {
      const item = await queue.request({
        companyId: body.companyId,
        kind: body.kind,
        reason: body.reason,
        payload: body.payload,
        requestedBy: principal.userId,
      });
      await audit.record({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: "REQUEST",
        entityType: "approval",
        entityId: item.id,
        after: { status: item.status, kind: item.kind, reason: item.reason },
      });
      return item;
    });
    return reply.status(201).send(created);
  });

  app.get("/v1/approvals", async (request) => {
    const query = ListQuery.parse(request.query);
    return withQueue(request, "approvals.read", query.companyId, (queue) => queue.list(query.companyId, query.status));
  });

  app.post("/v1/approvals/:id/approve", async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = DecisionBody.parse(request.body);
    return withQueue(request, "approvals.decide", body.companyId, async (queue, audit, principal) => {
      const before = await queue.get(body.companyId, id);
      if (!before) throw new DomainError("NOT_FOUND", "Approval request not found");
      const after = await queue.approve(body.companyId, id, principal.userId, body.note);
      await auditDecision(audit, principal.tenantId, principal.userId, "APPROVE", before, after);
      return after;
    });
  });

  app.post("/v1/approvals/:id/reject", async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = DecisionBody.parse(request.body);
    return withQueue(request, "approvals.decide", body.companyId, async (queue, audit, principal) => {
      const before = await queue.get(body.companyId, id);
      if (!before) throw new DomainError("NOT_FOUND", "Approval request not found");
      const after = await queue.reject(body.companyId, id, principal.userId, body.note ?? "");
      await auditDecision(audit, principal.tenantId, principal.userId, "REJECT", before, after);
      return after;
    });
  });

  app.post("/v1/approvals/:id/withdraw", async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = DecisionBody.parse(request.body);
    return withQueue(request, "approvals.request", body.companyId, async (queue, audit, principal) => {
      const before = await queue.get(body.companyId, id);
      if (!before) throw new DomainError("NOT_FOUND", "Approval request not found");
      const after = await queue.withdraw(body.companyId, id, principal.userId);
      await auditDecision(audit, principal.tenantId, principal.userId, "WITHDRAW", before, after);
      return after;
    });
  });
}
