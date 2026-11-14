import { runMigrations } from "./migrate";
import { createPool } from "./pool";
import { MIGRATIONS_DIR } from "./paths";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = createPool(databaseUrl, 1);
try {
  const applied = await runMigrations(pool, MIGRATIONS_DIR);
  console.log(applied.length > 0 ? `Applied: ${applied.join(", ")}` : "Database is up to date");
} finally {
  await pool.end();
}
