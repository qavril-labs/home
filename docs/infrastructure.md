# Infrastructure

How QAVRIL LABS is laid out as a backend, a frontend and databases, run locally and deployed. Read with [build-plan.md](build-plan.md).

## 1. Three parts

| Part | Folder | Runs as | Owner |
|---|---|---|---|
| **Backend (BE)** | `apps/api/` (HTTP API), `apps/worker/` (queues and outbox relay), `packages/*` (domain), `services/uaap/` (agent service) | Node.js 22 processes; the agent service in Python | Claude Code |
| **Frontend (FE)** | `apps/web/` (web app), `site/` (marketing site) | Static files built by Vite, served from a CDN | Antigravity |
| **Databases (DB)** | `packages/db/migrations/` (core), `packages/<product>/migrations/` (each product) | Neon Postgres | Claude Code |

The frontend talks to the backend only over the API contract (`apps/api/openapi.yaml`). The backend talks to databases and Redis. Nothing in the frontend connects to a database.

## 2. Neon: one core project, one project per product family

| Neon project | Databases | Holds |
|---|---|---|
| **qavril-saas** (main) | `core` | Tenants, users and sessions, master data, the general ledger, numbering, audit log, the outbox, entitlements, leads |
| **qavril-agents** | `agents` | `services/uaap`: agent runs, checkpoints, approvals inbox, memory |
| **qavril-pack-<name>** | `pack` | One industry product family, created when that pack starts (for example `qavril-pack-ds` for distribution and FMCG) |

Each Neon project has branches: `main` (production), `dev` (shared development), and one short-lived branch per pull request for previews and migration tests.

### Rules that keep separate databases safe

1. **Each database owns its tables.** No query joins across databases, and no service writes another database.
2. **Money always posts to the core ledger.** A product records its own documents in its database, then emits an event; the core consumes it and posts the ledger entry. That is architecture rule 4, across databases.
3. **Every database has its own outbox.** A product write and its event commit in the same transaction in that product's database. The worker relays each outbox into BullMQ.
4. **Consumers are idempotent.** Each event id is handled once per consumer (`processed_events`), because queues deliver at least once.
5. **Tenant isolation everywhere.** Every tenant table in every database has `tenant_id` and row-level security, and services connect with an app role that has neither superuser nor `BYPASSRLS`. The owner role runs migrations only.
6. **Products read core master data through the API or events**, keeping a local read copy if they need joins. They never connect to `core`.

Create a product database only when its pack starts. Until then, its tables do not exist.

## 3. Redis and BullMQ

Redis 6.2 or newer (8.2 is installed locally) backs BullMQ queues. The queue names live in `packages/queue/src/index.ts`:

| Queue | Work | Catalog |
|---|---|---|
| `events` | Domain events relayed from every outbox | PLT-06 |
| `notifications` | Email, SMS and WhatsApp sends | PLT-10 |
| `bots` | Bot runs: signals in, findings and drafts out | AGT-01 |
| `imports` | CSV and file imports | PLT-14 |
| `reports` | Report builds and exports | PLT-13 |
| `scheduled` | Repeating jobs: nightly checks, scheduled reports | AUT-02 |

How an event travels: the API writes a document and its event in one transaction; the worker claims the event from the outbox and adds it to the `events` queue with the event id as the job id (so a retry never makes a duplicate); consumers handle it idempotently; after 5 failed attempts with exponential backoff a job is kept as failed for inspection. Redis holds jobs only; the outbox in Postgres remains the record of truth.

Production Redis: a managed Redis such as Upstash or Redis Cloud, with TLS (`rediss://`) and `noeviction` memory policy, which BullMQ requires.

## 4. Running locally

```bash
npm run dev:all
```

This starts Redis (if not running), applies migrations, creates the non-superuser `erp_dev_app` role, then runs the API (port 3002), the worker and the site (port 8080). Settings come from the environment; [.env.example](../.env.example) lists them.

To run against Neon instead of local Postgres, set `DATABASE_URL` to the Neon owner connection string (migrations) and `APP_DATABASE_URL` to the Neon app role's connection string. Use the `dev` branch, never `main`.

## 5. Deploying

| Part | Where | Notes |
|---|---|---|
| API and worker | A Node host that runs long-lived processes (for example Render, Railway or Fly.io) | Separate services from one image; the worker scales by queue |
| Agent service | Same host, Python service | Its own Neon project |
| Web app and marketing site | Static hosting with a CDN (for example Cloudflare Pages or Vercel) | `apiBase` points at the API's public address |
| Databases | Neon | Migrations run in CI against a branch first, then on `main` |
| Redis | Managed Redis | TLS, `noeviction` |

Hosting choices other than Neon are proposals; confirm them before the first deploy.

## 6. Other tools in use

| Tool | Use |
|---|---|
| **BullMQ** | Job queues, retries, scheduled and repeating jobs |
| **ioredis** | The Redis client BullMQ uses |
| **Fastify** and **zod** | HTTP API and input validation |
| **pg** | Postgres driver |
| **Vitest** | Unit and integration tests |
| **Playwright** | End-to-end browser tests (Antigravity) |
| **three.js** | 3D scenes in the frontend |
| **Vite**, **React**, **Tailwind** | The web app (Antigravity) |
| **GitHub Actions** | Typecheck, tests and site check on every pull request |
