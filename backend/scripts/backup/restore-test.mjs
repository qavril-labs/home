// Proves a backup can be restored (PLT-21): restores the dump into a new scratch database and checks it
// against the manifest. It never touches the source database.
//
//   RESTORE_ADMIN_URL=<server where a scratch database may be created, never production> \
//     node backend/scripts/backup/restore-test.mjs <path to .dump> [path to .manifest.json]
//
// The manifest defaults to the dump's name with .manifest.json. Exit code 0 only when the checksum matches,
// the restore finishes, the migration list matches, and every table has at least the manifest's rows
// (a live database may have gained rows between the count and the dump, never lost them).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { exec, migrationNames, pgTool, sha256File, tableCounts } from "./lib.mjs";

const adminUrl = process.env.RESTORE_ADMIN_URL;
const dumpArg = process.argv[2];
if (!adminUrl || !dumpArg) {
  console.error("Usage: RESTORE_ADMIN_URL=<scratch server> node restore-test.mjs <file.dump> [file.manifest.json]");
  process.exit(2);
}
const dumpPath = resolve(dumpArg);
const manifestPath = resolve(process.argv[3] ?? dumpArg.replace(/\.dump$/, ".manifest.json"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const scratch = `restore_test_${Date.now().toString(36)}`;
const scratchUrl = new URL(adminUrl);
scratchUrl.pathname = `/${scratch}`;
if (new URL(adminUrl).pathname.slice(1) === scratch) throw new Error("scratch name collided with the admin database");

const failures = [];
const admin = new pg.Client({ connectionString: adminUrl });
let created = false;
try {
  const actual = await sha256File(dumpPath);
  if (actual !== manifest.sha256) failures.push(`checksum differs: manifest ${manifest.sha256}, file ${actual}`);

  await admin.connect();
  await admin.query(`CREATE DATABASE "${scratch}"`);
  created = true;
  await exec(pgTool("pg_restore"), ["--no-owner", "--no-privileges", "--exit-on-error", "--dbname", scratchUrl.toString(), dumpPath]);

  const restored = new pg.Client({ connectionString: scratchUrl.toString() });
  await restored.connect();
  try {
    const migrations = await migrationNames(restored);
    if (JSON.stringify(migrations) !== JSON.stringify(manifest.migrations)) failures.push("applied migrations differ from the manifest");
    const counts = await tableCounts(restored);
    for (const [table, expected] of Object.entries(manifest.tables)) {
      if (!(table in counts)) failures.push(`table ${table} is missing after restore`);
      else if (BigInt(counts[table]) < BigInt(expected)) failures.push(`table ${table}: restored ${counts[table]} rows, manifest ${expected}`);
    }
  } finally {
    await restored.end();
  }
} catch (error) {
  failures.push(error.message);
} finally {
  if (created) await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`).catch((e) => console.error(`could not drop ${scratch}: ${e.message}`));
  await admin.end().catch(() => {});
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, restoredTo: scratch, tables: Object.keys(manifest.tables).length, migrations: manifest.migrations.length }));
