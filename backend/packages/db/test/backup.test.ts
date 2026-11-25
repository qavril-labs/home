import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

const run = promisify(execFile);
const SCRIPTS = resolve(__dirname, "../../../scripts/backup");

function pgToolPresent(): boolean {
  if (process.env.PG_BIN) return true;
  if (process.platform === "win32") return ["18", "17", "16", "15"].some((v) => existsSync(`C:\\Program Files\\PostgreSQL\\${v}\\bin\\pg_dump.exe`));
  return true; // on Linux and macOS the script falls back to PATH; the test fails loudly if it is missing
}

async function script(name: string, args: string[], env: Record<string, string>): Promise<{ code: number; out: string; err: string }> {
  try {
    const { stdout, stderr } = await run(process.execPath, [join(SCRIPTS, name), ...args], { env: { ...process.env, NODE_NO_WARNINGS: "1", ...env } });
    return { code: 0, out: stdout, err: stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, out: e.stdout ?? "", err: e.stderr ?? "" };
  }
}

describe.skipIf(!pgToolPresent())("logical backup and restore test (PLT-21)", () => {
  let db: TestDatabase;
  let dir: string;
  let adminUrl: string;
  let appUrl: string;
  let serverUrl: string;
  let dump: string;
  let manifest: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    dir = await mkdtemp(join(tmpdir(), "erp-backup-"));
    adminUrl = (db.adminPool as unknown as { options: { connectionString: string } }).options.connectionString;
    appUrl = (db.appPool as unknown as { options: { connectionString: string } }).options.connectionString;
    const server = new URL(adminUrl);
    server.pathname = "/postgres";
    serverUrl = server.toString();
    // Seed rows in a tenant table and a non-tenant table, as the owner (the test role bypasses row security).
    const tenant = "01900000-0000-7000-8000-0000000000aa";
    await db.adminPool.query("INSERT INTO tenants (id, slug, name, region, status) VALUES ($1, 'backup-co', 'Backup Co', 'US', 'ACTIVE')", [tenant]);
    await db.adminPool.query("INSERT INTO leads (id, name, email, company, message, source) VALUES ('00000000-0000-4000-8000-000000000001', 'A', 'a@example.com', 'C', 'hello', 'test')").catch(() => undefined);
  }, 600_000);

  afterAll(async () => {
    await db?.stop();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("refuses to back up with the application role, which cannot see all rows", async () => {
    const result = await script("backup.mjs", [dir], { DATABASE_URL: appUrl });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/row-level security/);
  });

  it("writes a dump and a manifest with a checksum and per-table counts, without a password", async () => {
    const result = await script("backup.mjs", [dir], { DATABASE_URL: adminUrl });
    expect(result.err).toBe("");
    expect(result.code).toBe(0);
    const summary = JSON.parse(result.out.trim().split("\n").pop() as string) as { dump: string; manifest: string };
    dump = summary.dump;
    manifest = summary.manifest;
    const parsed = JSON.parse(await readFile(manifest, "utf8")) as { sha256: string; tables: Record<string, string>; migrations: string[]; source: string };
    expect(parsed.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(parsed.tables.tenants)).toBeGreaterThanOrEqual(1);
    expect(parsed.migrations.length).toBeGreaterThan(10);
    expect(parsed.source).not.toMatch(/:[^/@]+@/);
  });

  it("restores the dump into a scratch database and verifies it against the manifest", async () => {
    const result = await script("restore-test.mjs", [dump, manifest], { RESTORE_ADMIN_URL: serverUrl });
    expect(result.err).toBe("");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out.trim())).toMatchObject({ ok: true });
    // The scratch database is dropped afterwards.
    const left = await db.adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'restore_test_%'");
    expect(left.rows).toEqual([]);
  });

  it("fails the restore test when the dump has been altered", async () => {
    const bad = join(dir, "tampered.dump");
    const bytes = await readFile(dump);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    await writeFile(bad, bytes);
    const result = await script("restore-test.mjs", [bad, manifest], { RESTORE_ADMIN_URL: serverUrl });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/checksum differs/);
    const left = await db.adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'restore_test_%'");
    expect(left.rows).toEqual([]);
  });

  it("fails when a table has fewer rows after restore than the manifest says", async () => {
    const lying = JSON.parse(await readFile(manifest, "utf8")) as { tables: Record<string, string> };
    lying.tables.tenants = "999";
    const lyingPath = join(dir, "lying.manifest.json");
    await writeFile(lyingPath, JSON.stringify(lying));
    const result = await script("restore-test.mjs", [dump, lyingPath], { RESTORE_ADMIN_URL: serverUrl });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/table tenants: restored/);
  });
});
