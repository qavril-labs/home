import { describe, expect, it } from "vitest";
import { startTestDatabase } from "@erp/db/testing";
import { runMigrations } from "../src/migrate";
import { MIGRATIONS_DIR } from "../src/paths";

describe("renamed migrations", () => {
  it("does not run the invoicing migration again when it was applied under its old name", async () => {
    const db = await startTestDatabase();
    try {
      // Simulate a database that applied 0007_invoicing.sql before the file was renamed to 0009.
      await db.adminPool.query("DELETE FROM schema_migrations WHERE name = '0009_invoicing.sql'");
      await db.adminPool.query("INSERT INTO schema_migrations (name) VALUES ('0007_invoicing.sql')");

      const ran = await runMigrations(db.adminPool, MIGRATIONS_DIR);

      expect(ran).toEqual([]);
      const { rows } = await db.adminPool.query<{ name: string }>(
        "SELECT name FROM schema_migrations WHERE name LIKE '%invoicing%' ORDER BY name",
      );
      expect(rows.map((r) => r.name)).toEqual(["0007_invoicing.sql", "0009_invoicing.sql"]);
    } finally {
      await db.stop();
    }
  }, 600_000);
});
