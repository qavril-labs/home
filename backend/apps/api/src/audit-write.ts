import type { FastifyRequest } from "fastify";
import { AuditLog } from "@erp/audit";
import { PgAuditStore, type Queryable } from "@erp/db";
import type { Principal } from "@erp/identity";
import type { Clock } from "@erp/kernel";

export interface AuditWriteInput {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: Readonly<Record<string, unknown>> | null;
  readonly after?: Readonly<Record<string, unknown>> | null;
}

/**
 * Appends one audit entry inside the caller's transaction, so the entry exists exactly when the
 * business write does. Call it from inside the same `withTenantTransaction` as the write, and
 * inside the idempotent callback so a replayed request does not log twice.
 */
export async function auditWrite(
  tx: Queryable,
  clock: Clock,
  principal: Principal,
  request: FastifyRequest,
  input: AuditWriteInput,
): Promise<void> {
  await new AuditLog(new PgAuditStore(tx), clock).record({
    tenantId: principal.tenantId,
    actorId: principal.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: request.id,
  });
}

/** The fields of a document worth keeping in an audit entry: identity, status and amounts, never line detail. */
export function pick(source: unknown, fields: readonly string[]): Record<string, unknown> {
  const record = (source ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (record[field] !== undefined) out[field] = record[field];
  }
  return out;
}
