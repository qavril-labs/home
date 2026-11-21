import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Principal } from "@erp/identity";
import { DomainError } from "@erp/kernel";
import { PgNotificationStore, type Pool } from "@erp/db";
import type { NotificationRecord } from "@erp/notifications";

export interface NotificationRouteDeps {
  pool: Pool;
  authenticate: (req: FastifyRequest) => Promise<Principal>;
}

/** Delivery state only. The message body is not returned: callers need status, not content. */
function toView(r: NotificationRecord) {
  return {
    id: r.id,
    channel: r.channel,
    templateKey: r.templateKey,
    toAddress: r.toAddress,
    subject: r.subject,
    status: r.status,
    attempts: r.attempts,
    providerMessageId: r.providerMessageId,
    error: r.error,
    createdAt: r.createdAt,
    sentAt: r.sentAt,
  };
}

export function registerNotificationRoutes(app: FastifyInstance, deps: NotificationRouteDeps): void {
  const store = new PgNotificationStore(deps.pool);

  app.get("/v1/notifications", async (request) => {
    const principal = await deps.authenticate(request);
    const query = request.query as { status?: string; limit?: string };
    if (query.status && !["queued", "sent", "failed"].includes(query.status)) {
      throw new DomainError("VALIDATION", "status must be queued, sent or failed");
    }
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const rows = await store.list(principal.tenantId, {
      status: query.status as NotificationRecord["status"] | undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return { notifications: rows.map(toView) };
  });

  app.get("/v1/notifications/:id", async (request) => {
    const principal = await deps.authenticate(request);
    const { id } = request.params as { id: string };
    const row = await store.find(principal.tenantId, id);
    if (!row) throw new DomainError("NOT_FOUND", `Notification not found: ${id}`);
    return toView(row);
  });
}
