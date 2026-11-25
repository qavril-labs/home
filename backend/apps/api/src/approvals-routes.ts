import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { DomainError, type Clock } from "@erp/kernel";
import type { Company } from "@erp/tenancy";
import {
  PgApprovalsStore,
  PgTenantRepository,
  withTenantTransaction,
  type Pool,
  type Queryable,
} from "@erp/db";
import { realtimeEvents } from "./invoicing-routes";

export interface ApprovalsRouteDeps {
  pool: Pool;
  clock?: Clock;
  approvalsStore?: PgApprovalsStore;
  authenticateRequest?: (req: FastifyRequest) => Promise<Principal | null>;
  findCompany?: (queryable: Queryable, tenantId: string) => Promise<Company | null>;
}

const CreateApprovalSchema = z.object({
  id: z.string().optional(),
  botId: z.string().min(1),
  botName: z.string().min(1),
  actionType: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  amount: z.string().optional().nullable(),
  currency: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  confidenceScore: z.number().optional(),
});

const DecideApprovalSchema = z.object({
  reason: z.string().optional(),
});

export function registerApprovalsRoutes(
  app: FastifyInstance,
  deps: ApprovalsRouteDeps
): void {
  const store = deps.approvalsStore ?? new PgApprovalsStore(deps.clock);

  async function resolvePrincipalAndCompany(req: FastifyRequest): Promise<{
    principal: Principal;
    company: Company;
  }> {
    const principal = deps.authenticateRequest
      ? await deps.authenticateRequest(req)
      : (req as FastifyRequest & { principal?: Principal }).principal;

    if (!principal) {
      throw new DomainError("UNAUTHENTICATED", "Authentication required");
    }

    const company = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        if (deps.findCompany) {
          return deps.findCompany(tx, principal.tenantId);
        }
        const { rows } = await tx.query<{ id: string }>(
          "SELECT id FROM companies WHERE tenant_id = $1 ORDER BY id LIMIT 1",
          [principal.tenantId]
        );
        const id = rows[0]?.id;
        return id ? new PgTenantRepository(tx).findCompany(id) : null;
      }
    );

    if (!company) {
      throw new DomainError("NOT_FOUND", "No company found for tenant");
    }

    return { principal, company };
  }

  // -------------------------------------------------------------------------
  // GET /v1/approval-requests: List approval requests
  // -------------------------------------------------------------------------
  app.get("/v1/approval-requests", async (req: FastifyRequest, reply: FastifyReply) => {
    const { principal } = await resolvePrincipalAndCompany(req);

    const query = req.query as {
      status?: string;
      botId?: string;
      limit?: string;
    };

    const requests = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        return store.listApprovalRequests(tx, {
          status: query.status,
          botId: query.botId,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
      }
    );

    return reply.status(200).send({ requests });
  });

  // -------------------------------------------------------------------------
  // GET /v1/approval-requests/:id: Get a specific approval request
  // -------------------------------------------------------------------------
  app.get("/v1/approval-requests/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const { principal } = await resolvePrincipalAndCompany(req);
    const { id } = req.params as { id: string };

    const request = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        return store.findApprovalRequest(tx, id);
      }
    );

    if (!request) {
      throw new DomainError("NOT_FOUND", `Approval request not found: ${id}`);
    }

    return reply.status(200).send(request);
  });

  // -------------------------------------------------------------------------
  // POST /v1/approval-requests: Create an approval request
  // -------------------------------------------------------------------------
  app.post("/v1/approval-requests", async (req: FastifyRequest, reply: FastifyReply) => {
    const { principal, company } = await resolvePrincipalAndCompany(req);
    const body = CreateApprovalSchema.parse(req.body);

    const created = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        return store.createApprovalRequest(tx, principal.tenantId, {
          ...body,
          companyId: company.id,
        });
      }
    );

    // Broadcast real-time SSE event to all connected clients
    realtimeEvents.broadcast(principal.tenantId, "approvals.request.created", created);

    return reply.status(201).send(created);
  });

  // -------------------------------------------------------------------------
  // POST /v1/approval-requests/:id/approve: Approve an action
  // -------------------------------------------------------------------------
  app.post("/v1/approval-requests/:id/approve", async (req: FastifyRequest, reply: FastifyReply) => {
    const { principal, company } = await resolvePrincipalAndCompany(req);
    const { id } = req.params as { id: string };
    const body = DecideApprovalSchema.parse(req.body || {});

    const decided = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        const result = await store.decideApproval(tx, {
          id,
          decision: "approved",
          decidedBy: principal.userId || principal.email || "Lead Operator",
          reason: body.reason,
        });

        // Record audit log
        await store.recordAgentAuditLog(tx, principal.tenantId, {
          companyId: company.id,
          botId: result.botId,
          eventType: "approval.authorized",
          action: `Approve: ${result.title}`,
          entityType: "approval_request",
          entityId: result.id,
          details: {
            actionType: result.actionType,
            amount: result.amount,
            decidedBy: principal.userId || principal.email,
            reason: body.reason,
          },
        });

        return result;
      }
    );

    // Broadcast real-time SSE event
    realtimeEvents.broadcast(principal.tenantId, "approvals.request.approved", decided);

    return reply.status(200).send(decided);
  });

  // -------------------------------------------------------------------------
  // POST /v1/approval-requests/:id/reject: Decline an action
  // -------------------------------------------------------------------------
  app.post("/v1/approval-requests/:id/reject", async (req: FastifyRequest, reply: FastifyReply) => {
    const { principal, company } = await resolvePrincipalAndCompany(req);
    const { id } = req.params as { id: string };
    const body = DecideApprovalSchema.parse(req.body || {});

    const decided = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        const result = await store.decideApproval(tx, {
          id,
          decision: "rejected",
          decidedBy: principal.userId || principal.email || "Lead Operator",
          reason: body.reason,
        });

        // Record audit log
        await store.recordAgentAuditLog(tx, principal.tenantId, {
          companyId: company.id,
          botId: result.botId,
          eventType: "approval.rejected",
          action: `Reject: ${result.title}`,
          entityType: "approval_request",
          entityId: result.id,
          details: {
            actionType: result.actionType,
            amount: result.amount,
            decidedBy: principal.userId || principal.email,
            reason: body.reason,
          },
        });

        return result;
      }
    );

    // Broadcast real-time SSE event
    realtimeEvents.broadcast(principal.tenantId, "approvals.request.rejected", decided);

    return reply.status(200).send(decided);
  });

  // -------------------------------------------------------------------------
  // GET /v1/approval-requests/audit-logs: List agent audit logs
  // -------------------------------------------------------------------------
  app.get("/v1/approval-requests/audit-logs", async (req: FastifyRequest, reply: FastifyReply) => {
    const { principal } = await resolvePrincipalAndCompany(req);
    const query = req.query as { botId?: string; limit?: string };

    const logs = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        return store.listAgentAuditLogs(tx, {
          botId: query.botId,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });
      }
    );

    return reply.status(200).send({ logs });
  });
}
