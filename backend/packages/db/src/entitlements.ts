import type { Queryable } from "./pool";

/** Products the current tenant has bought. Runs inside a tenant transaction. */
export async function listEntitlements(db: Queryable): Promise<Set<string>> {
  const { rows } = await db.query<{ product_id: string }>("SELECT product_id FROM tenant_products");
  return new Set(rows.map((row) => row.product_id));
}
