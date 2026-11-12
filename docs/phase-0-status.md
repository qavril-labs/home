# Phase 0 status

Phase 0 is the platform foundation from [ERP-Product-Catalog.md](../ERP-Product-Catalog.md). This is a foundation slice: the core mechanisms are implemented and tested, and most product-facing foundation items are not started yet.

Status key: **Implemented** means working and tested. **Partial** means the core mechanism works and named pieces are missing. **Not started** means no code yet.

| ID | Product | Status | What exists | Missing |
|---|---|---|---|---|
| PLT-01 | Identity & Access | Partial | Password login (scrypt), hashed sessions with expiry and logout, built-in roles, permission wildcards | SSO, MFA, tenant-defined roles, attribute-based rules |
| PLT-02 | Tenancy & Organization | Partial | Tenants, companies, branches, row-level security, slug and region validation | Subscriptions, delegated admin, org hierarchy beyond branches |
| PLT-03 | Localization | Partial | Message catalog with locale fallback and placeholders, right-to-left detection, money and date formatting | Translation workflow, non-Gregorian calendars |
| PLT-04 | Tax & Country Rules Engine | Partial | Tax codes with effective-dated rates, exclusive and inclusive pricing, reverse charge, overlap validation | Country rule packs, compound taxes, withholding, document-level rounding |
| PLT-05 | Multi-currency & FX | Partial | Exact money arithmetic, zero-decimal and three-decimal currencies, effective-dated rates, inverse rates | Realized and unrealized gain/loss posting, revaluation, rate import |
| PLT-06 | Events, Posting & Jobs | Partial | Domain events, transactional outbox (Postgres), dispatcher with leases, retries, dead-lettering, idempotent consumers | Worker process, dead-letter tooling, per-aggregate ordering, scheduler |
| PLT-07 | Workflow & Approvals | Not started | | Approval chains, thresholds, delegation |
| PLT-08 | Document Numbering | Partial | Gap-free counters with row locks, yearly and monthly resets, scoped counters | Configurable number patterns, per-branch rules in the UI |
| PLT-09 | Custom Fields & Layouts | Not started | | Everything |
| PLT-10 | Notifications | Not started | | Email, SMS, WhatsApp, push, templates |
| PLT-11 | Documents & Files | Not started | | Storage, versions, retention, e-signature |
| PLT-12 | Print & PDF | Not started | | Templates, PDF output, labels |
| PLT-13 | Reporting & BI | Not started | | Report builder, dashboards |
| PLT-14 | Import, Export & Migration | Not started | | Validated import, migrators |
| PLT-15 | Integration Hub | Not started | | API keys, webhooks, rate limits |
| PLT-16 | Audit Trail | Partial | Append-only log with field-level diffs, enforced by a database trigger | Hash chaining for tamper evidence, viewer UI |
| PLT-17 | Global Search | Not started | | Everything |
| PLT-18 | Feature & Module Licensing | Partial | Product registry generated from the catalog (320 products), dependency checks when enabling products, entitlement enforced on ledger routes | Enforcement on the other modules' routes as they are built, admin UI for products |
| PLT-19 | Mobile & Offline Shell | Not started | | PWA or native shell, offline queue |
| PLT-20 | SaaS Billing (for you) | Not started | | Plans, invoices, dunning |
| PLT-21 | Security & Data Residency | Partial | Tenant isolation through row-level security, scrypt hashing, hashed session tokens, suspended-tenant checks | Encryption configuration, region-pinned deployments, backups and disaster recovery, rate limiting |
| PLT-22 | Observability & Support | Partial | Structured request logging through Fastify | Metrics, error tracking, support console with consent |
| PLT-23 | Onboarding & Help | Partial | Tenant bootstrap endpoint; self-service sign-up (`POST /v1/public/signup`) that creates the workspace in USD with the ledger on, 15 starter accounts and this fiscal year, and signs the owner in; sign-up and sign-in pages; the signed-in dashboard (`site/app.html`) with totals, a six-month chart, quick entries, recent entries, balances, and a bot crew panel computed in the browser from the overview | Email verification, password reset, sample data, help, bots that act (today they only report and draft) |

## Verification

Last full run (2026-11-11): typecheck passes, and 184 tests pass across 19 files (unit, Postgres integration, API, lead intake, sign-up and dashboard). `npm run site:check` passes 4,093 checks. The database run used PostgreSQL 18.6 on Windows through `TEST_DATABASE_URL`.

```bash
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm test
```

The URL's role must be able to create databases and roles. Each run creates and drops its own database and application role. Without the variable, the tests start an embedded Postgres, which stalls in `initdb` on the Windows machine used for this build.

## Product progress

Products come from [ERP-Product-Catalog.md](../ERP-Product-Catalog.md). `npm run catalog:generate` rebuilds the registry from that file and refuses to write if a row is malformed or depends on an unknown product.

| Product | Status | What works now | Not yet |
|---|---|---|---|
| FIN-01 General Ledger | Partial | Chart of accounts, monthly fiscal periods, balanced entries, multi-currency posting at the rate on the entry date, period closing, reversals at original base amounts, trial balance, retry-safe references, append-only storage | Posting from other modules' events, reopening periods, dimensions (FIN-08), statements (FIN-09) |
| SAL-01 Sales and invoicing (slice) | Partial | Invoices numbered from the sequence, posted to receivables, income and tax; payments; voiding by reversal; tests | Database storage in the same transaction, quotes, credit notes, customers and items, the API, the UI |
| Product enablement | Done | Enabling a product checks its required products | Billing and trials |

Foundation (phase P0) products are always on, so enabling a product does not require them explicitly.

## Signed-in dashboard

`GET /v1/workspace/overview` returns totals, a six-month trend, balances, recent entries and the figures the bots read. `POST /v1/workspace/quick-entries` posts a sale (paid or on credit), an expense (paid or as a bill), a customer payment, or owner money, as a balanced entry numbered `QE-YYYY-NNNNN` from the gap-free counter. `POST /v1/workspace/starter-books` sets up books for workspaces created before sign-up did it. All three need a session and a permission.

Local dev must connect as a role without superuser rights: superusers bypass row-level security. `npm run dev:all` creates `erp_dev_app` for this and runs the API as it on port 3002 (3000 is often taken), with the site on 8080.

## Public lead intake

The marketing site posts early-access requests to `POST /v1/public/leads`. Leads are stored in the `leads` table, which is intentionally not tenant data: it has no `tenant_id` and no row-level security. Requests are rate-limited per IP (5 per 10 minutes by default), and a hidden honeypot field silently drops bot submissions. Operators export leads with `npm run leads:export`. The site itself is documented in [site/README.md](../site/README.md).

## Counts

- Implemented: 0
- Partial: 11
- Not started: 12

## Known gaps in the Phase 0 build

- Only the ledger routes enforce entitlements. The other modules do not exist yet, so there is nothing else to enforce.
- No outbox worker runs in production. The dispatcher exists and is tested; a process that calls it on a timer has not been added.
- Built-in roles are placeholders. Phase 1 product permissions replace them.
- The currency table covers 24 currencies. Replace it with a complete ISO 4217 source before onboarding customers outside those markets.
- The API has no rate limiting, request size limits beyond Fastify defaults, or CORS policy.

## Decisions made in Phase 0

- **Modular monolith** in one repository, with packages as module boundaries.
- **PostgreSQL with row-level security** for tenant isolation. The application connects as a non-superuser role so policies apply.
- **Money as integers** in minor units, arithmetic in `bigint`, and decimal strings on the wire.
- **Tenant-prefixed session tokens** so the server selects the tenant before any query runs.
- **Transactional outbox** for events, so no event is published for a rolled-back change.
