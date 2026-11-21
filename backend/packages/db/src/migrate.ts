import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

const LOCK_KEY = "erp_schema_migrations";

/** Old name -> new name, for migrations renamed after being applied somewhere. Never remove an entry. */
export const RENAMED_MIGRATIONS: Record<string, string> = {
  "0007_invoicing.sql": "0009_invoicing.sql",
};

/**
 * Applies each pending migration file in name order, one transaction per file.
 * Holds an advisory lock so two deployments cannot migrate at the same time.
 * Returns the names of the files applied in this run.
 */
export async function runMigrations(pool: Pool, directory: string): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_KEY]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name));
    // Files renamed after they were applied. A database that ran the old name counts the new name
    // as applied too, so the renamed file is not run twice.
    for (const [oldName, newName] of Object.entries(RENAMED_MIGRATIONS)) {
      if (applied.has(oldName) && !applied.has(newName)) {
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [newName]);
        applied.add(newName);
      }
    }
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    const ran: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(directory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      ran.push(file);
    }
    return ran;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
