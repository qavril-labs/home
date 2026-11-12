import type { Pool, PoolClient } from "pg";
import { DomainError, isUuid } from "@erp/kernel";

/** Runs `work` in a transaction: commits on success, rolls back on any error. */
export async function withTransaction<T>(pool: Pool, work: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs `work` in a transaction bound to one tenant. Row-level security limits every tenant
 * table to that tenant until the transaction ends. Every tenant-data query goes through here.
 */
export async function withTenantTransaction<T>(
  pool: Pool,
  tenantId: string,
  work: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  if (!isUuid(tenantId)) {
    throw new DomainError("VALIDATION", "Invalid tenant id");
  }
  return withTransaction(pool, async (tx) => {
    await tx.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    return work(tx);
  });
}
