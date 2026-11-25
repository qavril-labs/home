// Shared helpers for the logical backup and restore-test scripts (PLT-21).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Finds a PostgreSQL client tool on PATH, in PG_BIN, or in the usual Windows install folders. */
export function pgTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(join(process.env.PG_BIN, exe));
  if (process.platform === "win32") {
    for (const version of ["18", "17", "16", "15"]) candidates.push(`C:\\Program Files\\PostgreSQL\\${version}\\bin\\${exe}`);
  }
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return name; // fall back to PATH
}

export async function exec(file, args, options = {}) {
  try {
    return await run(file, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  } catch (error) {
    const detail = String(error.stderr || error.message).trim().split("\n").slice(-5).join(" | ");
    throw new Error(`${file} failed: ${detail}`);
  }
}

export function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

/** A connection string with the password removed, safe to write into a manifest or a log. */
export function redactUrl(url) {
  const parsed = new URL(url);
  parsed.password = "";
  parsed.username = "";
  return parsed.toString();
}

/**
 * Row counts for every table in the public schema, read with row-level security off. The caller must
 * be a role that bypasses it; checked by `assertBypassesRls`.
 */
export async function tableCounts(client) {
  await client.query("SET row_security = off");
  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const counts = {};
  if (rows.length === 0) return counts;
  // One statement for every table: a round trip per table is slow against a remote database (about a second
  // each on Neon), which made the backup test time out. The names come from pg_tables and are quoted.
  const literal = (s) => `'${s.replaceAll("'", "''")}'`;
  const quote = (s) => `"${s.replaceAll('"', '""')}"`;
  const sql = rows
    .map(({ tablename }) => `SELECT ${literal(tablename)} AS t, count(*)::text AS n FROM ${quote(tablename)}`)
    .join(" UNION ALL ");
  const result = await client.query(sql);
  for (const { t, n } of result.rows) counts[t] = n;
  // Keep the same key order as before (alphabetical, as listed).
  return Object.fromEntries(rows.map(({ tablename }) => [tablename, counts[tablename]]));
}

/**
 * Tables use FORCE ROW LEVEL SECURITY, so a role that does not bypass it would dump nothing, or
 * error. Refuse to run rather than write a backup that looks complete and is empty.
 */
export async function assertBypassesRls(client) {
  const { rows } = await client.query("SELECT rolname, rolsuper OR rolbypassrls AS ok FROM pg_roles WHERE rolname = current_user");
  if (!rows[0]?.ok) {
    throw new Error(
      `The backup role "${rows[0]?.rolname}" is subject to row-level security, so a dump would be empty or partial. Use the database owner or a role with BYPASSRLS (not the application role).`,
    );
  }
}

export async function migrationNames(client) {
  const { rows } = await client.query("SELECT name FROM schema_migrations ORDER BY name");
  return rows.map((row) => row.name);
}
