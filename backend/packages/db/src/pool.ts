import pg from "pg";
import type { Pool, QueryResult, QueryResultRow } from "pg";

export type { Pool, PoolClient } from "pg";

/** The part of Pool and PoolClient the adapters use. Works inside or outside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export function createPool(connectionString: string, max = 10): Pool {
  return new pg.Pool({ connectionString, max });
}
