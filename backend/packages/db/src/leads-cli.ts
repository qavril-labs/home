import { listLeads, leadsToCsv } from "./leads";
import { createPool } from "./pool";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const limitArg = process.argv[2] ?? "1000";
const limit = Number(limitArg);
if (!Number.isInteger(limit) || limit < 1 || limit > 100_000) {
  console.error("Usage: npm run leads:export -- [limit]   (limit: 1 to 100000, default 1000)");
  process.exit(1);
}

const pool = createPool(databaseUrl, 1);
try {
  process.stdout.write(leadsToCsv(await listLeads(pool, limit)));
} finally {
  await pool.end();
}
