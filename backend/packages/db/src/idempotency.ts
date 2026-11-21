import type { Queryable } from "./pool";

export interface IdempotencyClaim {
  /** True when this request now owns the key and must do the work. */
  readonly claimed: boolean;
  /** Set when the key already existed. */
  readonly existing: {
    readonly requestHash: string;
    /** Null while the first request is still running. */
    readonly statusCode: number | null;
    readonly response: unknown;
  } | null;
}

/**
 * Claims an idempotency key inside the caller's tenant transaction. If another request holds the
 * key, this waits for it to finish (the insert blocks on the row), then reports what it stored.
 */
export async function claimIdempotencyKey(
  db: Queryable,
  tenantId: string,
  scope: string,
  key: string,
  requestHash: string,
): Promise<IdempotencyClaim> {
  const inserted = await db.query(
    `INSERT INTO idempotency_keys (tenant_id, scope, key, request_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [tenantId, scope, key, requestHash],
  );
  if (inserted.rowCount === 1) return { claimed: true, existing: null };

  const { rows } = await db.query<{ request_hash: string; status_code: number | null; response: unknown }>(
    `SELECT request_hash, status_code, response
       FROM idempotency_keys
      WHERE tenant_id = $1 AND scope = $2 AND key = $3`,
    [tenantId, scope, key],
  );
  const row = rows[0];
  if (!row) throw new Error("idempotency key vanished between insert and read");
  return {
    claimed: false,
    existing: { requestHash: row.request_hash, statusCode: row.status_code, response: row.response },
  };
}

/** Stores the response of the request that owns the key. Runs in the same transaction as the work. */
export async function storeIdempotencyResponse(
  db: Queryable,
  tenantId: string,
  scope: string,
  key: string,
  statusCode: number,
  response: unknown,
): Promise<void> {
  await db.query(
    `UPDATE idempotency_keys SET status_code = $4, response = $5::jsonb
      WHERE tenant_id = $1 AND scope = $2 AND key = $3`,
    [tenantId, scope, key, statusCode, JSON.stringify(response)],
  );
}
