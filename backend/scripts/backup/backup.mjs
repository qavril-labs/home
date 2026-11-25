// Logical backup of the platform database (PLT-21).
//
//   DATABASE_URL=<owner connection string, direct not pooled> node backend/scripts/backup/backup.mjs [outDir]
//
// Optional: BACKUP_S3_URI=s3://bucket/prefix uploads the dump and manifest with the AWS CLI (server-side
// encrypted). PG_BIN points at the PostgreSQL client tools if they are not on PATH.
// Writes <outDir>/erp-<UTC timestamp>.dump (pg_dump custom format) and a .manifest.json beside it with
// the SHA-256, size, migration list and a row count per table, which restore-test.mjs checks.
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pg from "pg";
import { assertBypassesRls, exec, migrationNames, pgTool, redactUrl, sha256File, tableCounts } from "./lib.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required (the owner connection string, not the application role).");
  process.exit(2);
}
const outDir = resolve(process.argv[2] ?? "backups");
const s3Uri = process.env.BACKUP_S3_URI?.replace(/\/+$/, "");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const dumpPath = join(outDir, `erp-${stamp}.dump`);
const manifestPath = join(outDir, `erp-${stamp}.manifest.json`);

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await mkdir(outDir, { recursive: true });
  await client.connect();
  await assertBypassesRls(client);
  // Counts are read just before the dump. Rows written in between make the dump larger than the counts, never
  // smaller, so the restore test accepts a table with at least the manifest's rows.
  const counts = await tableCounts(client);
  const migrations = await migrationNames(client);

  await exec(pgTool("pg_dump"), ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath, databaseUrl]);
  const { size } = await stat(dumpPath);
  const sha256 = await sha256File(dumpPath);
  const manifest = {
    createdAt: new Date().toISOString(),
    source: redactUrl(databaseUrl),
    dumpFile: `erp-${stamp}.dump`,
    bytes: size,
    sha256,
    migrations,
    tables: counts,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (s3Uri) {
    for (const file of [dumpPath, manifestPath]) {
      const name = file.slice(outDir.length + 1);
      await exec("aws", ["s3", "cp", file, `${s3Uri}/${name}`, "--sse", "AES256", "--only-show-errors"]);
    }
    console.log(`uploaded to ${s3Uri}/erp-${stamp}.dump`);
  }
  console.log(JSON.stringify({ ok: true, dump: dumpPath, manifest: manifestPath, bytes: size, sha256, tables: Object.keys(counts).length }));
} catch (error) {
  console.error(`backup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
