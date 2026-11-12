// Runs the whole platform on this machine: Redis, the API, the background worker and the site.
// Creates the local database if it is missing and applies migrations first.
//   Site: http://localhost:8080/   API: http://localhost:3002/   Redis: 127.0.0.1:6379
// Set DATABASE_URL (admin) and APP_DATABASE_URL (app role) to run against Neon instead of local Postgres.
// Override DATABASE_URL to use another server. The default matches a local PostgreSQL that trusts
// the postgres user on 127.0.0.1, which is how this project's Windows machine is set up.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL || "postgres://postgres@127.0.0.1:5432/erp_dev";
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const usingNeon = /neon\.tech/.test(databaseUrl);
// The API must not connect as a superuser: superusers bypass row-level security, so one tenant
// could see another's rows. Migrations run as the admin URL; the API runs as this role.
const APP_ROLE = "erp_dev_app";
const APP_PASSWORD = process.env.DEV_APP_PASSWORD || "erp-dev-app-local-only";

async function ensureDatabase() {
  const target = new URL(databaseUrl);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unexpected database name: ${name}`);
  const server = new URL(databaseUrl);
  server.pathname = "/postgres";
  const client = new pg.Client({ connectionString: server.toString() });
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (found.rowCount === 0) {
      await client.query(`CREATE DATABASE ${name}`);
      console.log(`[DB] Created database ${name}`);
    }
  } finally {
    await client.end();
  }
}

function run(label, command, args, env) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env }, shell: true });
  child.on("close", (code) => console.log(`[${label}] exited with code ${code}`));
  return child;
}

// Neon databases are created in the Neon console or API, not here.
if (!usingNeon) await ensureDatabase();
console.log("[DB] Applying migrations ...");
await new Promise((resolve, reject) => {
  run("DB", "npm", ["run", "migrate"], { DATABASE_URL: databaseUrl }).on("close", (code) =>
    code === 0 ? resolve() : reject(new Error("Migrations failed")),
  );
});

async function ensureAppRole() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [APP_ROLE]);
    if (found.rowCount === 0) {
      await client.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
      console.log(`[DB] Created role ${APP_ROLE}`);
    }
    await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
  } finally {
    await client.end();
  }
  const appUrl = new URL(databaseUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;
  return appUrl.toString();
}
const apiDatabaseUrl = process.env.APP_DATABASE_URL || (usingNeon ? null : await ensureAppRole());
if (!apiDatabaseUrl) throw new Error("Set APP_DATABASE_URL to the Neon app role's connection string (never the owner role).");

/** Starts a local Redis unless one is already listening. BullMQ needs Redis 5 or newer. */
function redisListening() {
  const { hostname, port } = new URL(redisUrl);
  return new Promise((resolve) => {
    const socket = net.connect(Number(port || 6379), hostname, () => { socket.end(); resolve(true); });
    socket.on("error", () => resolve(false));
  });
}
let redis = null;
if (!(await redisListening())) {
  if (!/127\.0\.0\.1|localhost/.test(redisUrl)) throw new Error(`Redis at ${redisUrl} is not reachable`);
  console.log("[REDIS] Starting local redis-server on 6379");
  redis = run("REDIS", "redis-server", ["--port", "6379", "--save", '""', "--appendonly", "no"], {});
  for (let i = 0; i < 50 && !(await redisListening()); i += 1) await new Promise((r) => setTimeout(r, 200));
}

console.log("[SITE] http://localhost:8080/");
const site = run("SITE", "node", ["scripts/serve-site.mjs"], { PORT: "8080", HOST: "127.0.0.1" });

console.log("[API] http://localhost:3002/");
const api = run("API", "npm", ["run", "start", "-w", "@erp/api"], {
  PORT: "3002",
  HOST: "127.0.0.1",
  DATABASE_URL: apiDatabaseUrl,
  PLATFORM_ADMIN_KEY: process.env.PLATFORM_ADMIN_KEY || "local-dev-only-platform-key-0123456789",
  CORS_ORIGINS: "http://127.0.0.1:8080,http://localhost:8080",
  REDIS_URL: redisUrl,
});

console.log("[WORKER] outbox relay and queues");
const worker = run("WORKER", "npm", ["run", "start", "-w", "@erp/worker"], {
  DATABASE_URL: apiDatabaseUrl,
  REDIS_URL: redisUrl,
});

process.on("SIGINT", () => {
  site.kill();
  api.kill();
  worker.kill();
  if (redis) redis.kill();
  process.exit();
});
