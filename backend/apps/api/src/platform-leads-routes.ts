import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { PgAuditStore, withTenantTransaction, type Pool } from "@erp/db";
import { DomainError, newId, type Clock } from "@erp/kernel";
import { hasPermission, type Principal } from "@erp/identity";

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["new", "contacted", "booked", "closed"]).optional(),
});
const IdParams = z.object({ id: z.uuid() });
const DraftBody = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
});

export interface PlatformLeadsDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
  /** The platform workspace's tenant id. Without it these routes refuse everyone. */
  readonly platformTenantId?: string;
}

interface LeadRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  country: string | null;
  interest: string;
  industry: string | null;
  message: string | null;
  source: string;
  created_at: Date;
  status: string;
  consent_at: Date | null;
  last_draft_at: Date | null;
}

function leadView(row: LeadRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    country: row.country,
    interest: row.interest,
    industry: row.industry,
    message: row.message,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    status: row.status,
    consentAt: row.consent_at ? row.consent_at.toISOString() : null,
    lastDraftAt: row.last_draft_at ? row.last_draft_at.toISOString() : null,
  };
}

/**
 * Marketing leads are platform data, not tenant data. Only users of the platform workspace who hold
 * the permission may read them; every other tenant, including tenant admins, is refused. Fails closed
 * when no platform workspace is configured.
 */
export function registerPlatformLeadsRoutes(app: FastifyInstance, deps: PlatformLeadsDeps): void {
  const { pool, clock, authenticate, platformTenantId } = deps;

  async function platformUser(request: FastifyRequest, permission: string): Promise<Principal> {
    const principal = await authenticate(request);
    if (!platformTenantId || principal.tenantId !== platformTenantId) {
      throw new DomainError("FORBIDDEN", "Platform leads are only available to the platform workspace");
    }
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return principal;
  }

  app.get("/v1/platform/leads", async (request) => {
    const principal = await platformUser(request, "platform.leads.read");
    const { limit, status } = ListQuery.parse(request.query);
    const leads = await withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const { rows } = await tx.query<LeadRow>(
        `SELECT l.id, l.name, l.email, l.company, l.country, l.interest, l.industry, l.message, l.source,
                l.created_at, l.status, l.consent_at,
                (SELECT max(d.created_at) FROM lead_followup_drafts d WHERE d.lead_id = l.id) AS last_draft_at
           FROM leads l
          WHERE ($1::text IS NULL OR l.status = $1)
          ORDER BY l.created_at DESC
          LIMIT $2`,
        [status ?? null, limit],
      );
      return rows.map(leadView);
    });
    return { ok: true, leads };
  });

  app.post("/v1/platform/leads/:id/followup-drafts", async (request, reply) => {
    const principal = await platformUser(request, "platform.leads.draft");
    const { id } = IdParams.parse(request.params);
    const input = DraftBody.parse(request.body);
    const draft = await withTenantTransaction(pool, principal.tenantId, async (tx) => {
      const lead = await tx.query<{ id: string; consent_at: Date | null }>(
        "SELECT id, consent_at FROM leads WHERE id = $1",
        [id],
      );
      if (lead.rows.length === 0) throw new DomainError("NOT_FOUND", "Lead not found");
      if (!lead.rows[0]!.consent_at) {
        throw new DomainError("CONFLICT", "This lead has not recorded consent to be contacted");
      }
      const draftId = newId(clock.now().getTime());
      const { rows } = await tx.query<{ created_at: Date }>(
        `INSERT INTO lead_followup_drafts (id, tenant_id, lead_id, subject, body, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING created_at`,
        [draftId, principal.tenantId, id, input.subject, input.body, principal.userId, clock.now().toISOString()],
      );
      await new AuditLog(new PgAuditStore(tx), clock).record({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: "platform.lead.followup_draft.create",
        entityType: "lead_followup_draft",
        entityId: draftId,
        before: null,
        after: { leadId: id, subject: input.subject },
        requestId: request.id,
      });
      return { id: draftId, leadId: id, subject: input.subject, body: input.body, createdAt: rows[0]!.created_at.toISOString() };
    });
    return reply.status(201).send({ ok: true, draft });
  });
}
