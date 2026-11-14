import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { Pool } from "pg";
import { runMigrations } from "../migrate";
import { MIGRATIONS_DIR } from "../paths";
import { createPool } from "../pool";

export interface TestDatabase {
  /** Owner connection. Used for migrations and setup only. */
  readonly adminPool: Pool;
  /** Non-superuser connection the application uses, so row-level security applies. */
  readonly appPool: Pool;
  stop(): Promise<void>;
}

const APP_ROLE = "erp_app";
const APP_PASSWORD = "erp_app_test_password";
const ADMIN_PASSWORD = "erp_admin_test_password";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not find a free port"));
      });
    });
  });
}

/**
 * Starts a throwaway Postgres server, applies the migrations, and creates a non-superuser
 * application role. Tests that check tenant isolation must use `appPool`: superusers bypass RLS.
 */
/**
 * Starts a test database. If TEST_DATABASE_URL is set, uses that server: it must accept a role
 * that can create databases and roles (for example a local superuser). Otherwise starts an
 * embedded server. Each call creates its own database and application role, and drops both on stop().
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const serverUrl = process.env.TEST_DATABASE_URL;
  return serverUrl ? startExternalDatabase(serverUrl) : startEmbeddedDatabase();
}

async function startExternalDatabase(serverUrl: string): Promise<TestDatabase> {
  const suffix = randomUUID().replace(/-/g, "");
  const databaseName = `erp_test_${suffix}`;
  const roleName = `erp_app_${suffix.slice(0, 16)}`;
  const rolePassword = randomBytes(16).toString("hex");

  const maintenanceUrl = new URL(serverUrl);
  maintenanceUrl.pathname = "/postgres";
  const maintenance = createPool(maintenanceUrl.toString(), 1);
  await maintenance.query(`CREATE DATABASE ${databaseName}`);

  const databaseUrl = new URL(serverUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const adminPool = createPool(databaseUrl.toString());
  await runMigrations(adminPool, MIGRATIONS_DIR);
  await adminPool.query(`CREATE ROLE ${roleName} LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOBYPASSRLS`);
  await adminPool.query(`GRANT USAGE ON SCHEMA public TO ${roleName}`);
  await adminPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roleName}`);

  const appUrl = new URL(databaseUrl.toString());
  appUrl.username = roleName;
  appUrl.password = rolePassword;
  const appPool = createPool(appUrl.toString());

  return {
    adminPool,
    appPool,
    async stop() {
      await appPool.end();
      await adminPool.end();
      await maintenance.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
      await maintenance.query(`DROP ROLE IF EXISTS ${roleName}`);
      await maintenance.end();
    },
  };
}

async function startEmbeddedDatabase(): Promise<TestDatabase> {
  const port = await freePort();
  const dataRoot = await mkdtemp(join(tmpdir(), "erp-pg-"));
  const server = new EmbeddedPostgres({
    databaseDir: join(dataRoot, "data"),
    user: "postgres",
    password: ADMIN_PASSWORD,
    port,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });
  await server.initialise();
  await server.start();

  const host = `127.0.0.1:${port}`;
  const bootstrap = createPool(`postgres://postgres:${ADMIN_PASSWORD}@${host}/postgres`, 1);
  await bootstrap.query("CREATE DATABASE erp_test");
  await bootstrap.end();

  const adminPool = createPool(`postgres://postgres:${ADMIN_PASSWORD}@${host}/erp_test`);
  await runMigrations(adminPool, MIGRATIONS_DIR);
  await adminPool.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
  await adminPool.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
  await adminPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);

  const appPool = createPool(`postgres://${APP_ROLE}:${APP_PASSWORD}@${host}/erp_test`);
  return {
    adminPool,
    appPool,
    async stop() {
      await appPool.end();
      await adminPool.end();
      await server.stop();
      await rm(dataRoot, { recursive: true, force: true });
    },
  };
}
