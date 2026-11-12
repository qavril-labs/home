# ERP Platform: working agreements

Read these before changing code:

- `ERP-Product-Catalog.md`: product IDs, sizes, phases, and dependencies. Reference product IDs in commits, specs, and comments.
- `docs/phase-0-status.md`: what is implemented, partial, or not started.
- `docs/industry-portfolio.md`: which industries are covered by which catalog packs, and the level each belongs to.
- `docs/build-plan.md` and `docs/ui-contract.md`: Claude Code is the backend lane (packages, API, contract, bot service) and Antigravity the frontend lane (`apps/web/`, site, 3D, end-to-end tests). Folder ownership, the bot parts, and the UI rules every screen follows. Tokens live in `design/`. Antigravity reads `AGENTS.md`.

## Commands

- `npm install`: install workspaces.
- `npm test`: unit tests plus Postgres integration tests. Set `TEST_DATABASE_URL` to a server whose role can create databases and roles (for example a local superuser). Without it, tests start an embedded Postgres, which does not start on the Windows machine used so far.
- `npm run typecheck`: TypeScript across all packages.
- `npm run migrate`: apply SQL migrations. Needs `DATABASE_URL`.
- `npm run dev:api`: run the HTTP API. Needs `DATABASE_URL` and `PLATFORM_ADMIN_KEY` (32+ characters).
- `npm run dev:all`: run Redis, the API (port 3002), the worker and the site (port 8080). Creates `erp_dev` and the non-superuser role `erp_dev_app`, applies migrations, and runs the API and worker as that role so row-level security applies. Set `DATABASE_URL` and `APP_DATABASE_URL` to use Neon.
- `docs/infrastructure.md`: backend, frontend and databases; Neon projects; Redis and BullMQ queues; deployment.
- `npm run site:check`: check the marketing site (links, structured data, form fields, sitemap, preview image). Needs no browser or database.
- `npm run leads:export -- [limit]`: print recent public leads as CSV. Needs `DATABASE_URL`.
- `npm run catalog:generate`: rebuild the product registry in `packages/catalog` from `ERP-Product-Catalog.md`. Run it after editing the catalog. Never edit `products.generated.ts` by hand.

## Architecture rules

1. **Modular monolith.** Each product is a package or module with its own folder, tests, and migrations. Split into services only when a module needs independent scaling.
2. **Shared kernel.** Master data every module reads (company, branch, party, item, unit of measure, currency, chart of accounts, tax codes, sequences, users, roles) lives in shared packages. Do not duplicate it.
3. **Events, not direct writes.** Modules communicate through domain events appended to the outbox in the same transaction as the business write. No module writes another module's tables.
4. **Accounting is the sink.** Every money or stock movement emits an event that posts to the ledger. Build the general ledger before any module that posts money.
5. **Country and industry differences are data.** Tax rates, payroll rules, e-invoicing connectors, and chart-of-accounts templates are configuration, not forks.
6. **Tenant isolation.** Every tenant-owned table has `tenant_id` and row-level security. Query tenant data only through `withTenantTransaction`. Never query tenant tables with the bare pool.
7. **Definition of done** for a module: permissions, audit trail, import and export, reports, translatable strings, responsive UI, API documentation, and tests. Money-moving code needs balance tests.

## Conventions

- **Money** comes from `@erp/money`. Amounts are integer minor units (`bigint`). Never use floats or `Number` for money. Serialize amounts as decimal strings.
- **Dates.** Business dates are `YYYY-MM-DD` strings. Timestamps are UTC ISO 8601.
- **IDs.** Use `newId()` from `@erp/kernel` (time-ordered UUID v7).
- **Errors.** Throw `DomainError` with a code. The API maps codes to HTTP statuses.
- **Corrections.** Never update or delete ledger or audit rows. Post a reversal instead. The `audit_log` table rejects updates and deletes at the database level.
- **Document numbers** come from `NumberingService` inside the same transaction as the document, so rollbacks do not leave gaps.
- **Sessions.** Tokens are `<tenantId>.<random>`. Only the SHA-256 hash is stored.
- **Tests.** Each package has a `test/` folder. Rounding, tax, and currency changes need edge-case tests (negative amounts, half-cent rounding, zero-decimal currencies).
- **Dependencies.** Add one only with a reason. State the reason in the commit message.

## AI agents and industry packs (`services/uaap`)

- Every agent follows `docs/ai-agent-readiness/UAAP_AGENT_STANDARD.md` and is specified with the prompt template in `docs/ai-agent-readiness/BOT_BUILD_SPLIT.md`, which also says which tool owns which bot and which shared files only Claude Code edits.
- Never implement an industry agent before verifying its data sources, ERP dependencies, catalog entitlement and policy requirements. Agents never fabricate business data or regulatory rules.
- Incomplete data returns `READY`, `PARTIAL` or `BLOCKED`, naming the missing inputs. Every number in an output traces to source data or a deterministic calculation.
- Regulatory content comes only from approved, versioned configuration. Agents check against it and never write or modify rules.
- Build only the shared infrastructure the current pack needs. No speculative engine packages. All packs use UAAP registration, versioning, tenant policy enforcement and conformance tests.

## Layout

- `packages/*`: domain packages. Plain TypeScript with no HTTP framework.
- `packages/db`: Postgres adapters, migrations, and the test database helper. Domain packages do not import `pg`.
- `apps/api`: HTTP layer (Fastify). Thin: parse input, open a tenant transaction, call services, map errors.
