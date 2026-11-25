import type { FastifyRequest } from "fastify";
import { IdentityService, tenantFromToken, type Principal } from "@erp/identity";
import { PgIdentityRepository, PgTenantRepository, withTenantTransaction, type Pool } from "@erp/db";
import { DomainError, systemClock, type Clock } from "@erp/kernel";

export function bearerToken(request: FastifyRequest): string {
  const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? "");
  if (!match?.[1]) {
    throw new DomainError("UNAUTHENTICATED", "Missing bearer token");
  }
  return match[1];
}

/**
 * Resolves the bearer token to a principal. The tenant comes from the token itself, so the
 * tenant's status and the session are both checked inside that tenant's context.
 */
export function createAuthenticator(pool: Pool, clock: Clock = systemClock): (request: FastifyRequest) => Promise<Principal> {
  return async (request) => {
    const token = bearerToken(request);
    const tenantId = tenantFromToken(token);
    if (!tenantId) {
      throw new DomainError("UNAUTHENTICATED", "Session is invalid or expired");
    }
    const tenant = await new PgTenantRepository(pool).findTenantById(tenantId);
    if (!tenant || tenant.status !== "ACTIVE") {
      throw new DomainError("UNAUTHENTICATED", "Session is invalid or expired");
    }
    return withTenantTransaction(pool, tenantId, (tx) =>
      new IdentityService(new PgIdentityRepository(tx), tenantId, clock).authenticate(token),
    );
  };
}
