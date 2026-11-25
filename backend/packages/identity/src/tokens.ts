import { createHash, randomBytes } from "node:crypto";
import { isUuid } from "@erp/kernel";

/**
 * Session tokens look like "<tenantId>.<random>". The tenant prefix lets the server choose
 * the right tenant context before it queries anything. It is not a secret; the random part is.
 */
export function createSessionToken(tenantId: string): string {
  return `${tenantId}.${randomBytes(32).toString("base64url")}`;
}

export function tenantFromToken(token: string): string | null {
  const separator = token.indexOf(".");
  if (separator <= 0) {
    return null;
  }
  const tenantId = token.slice(0, separator);
  return isUuid(tenantId) ? tenantId : null;
}

/** Only the hash is stored, so a database leak does not expose live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
