# QAVRIL LABS: end-to-end project handoff (single source of truth)

Date: 2026-11-23. Consolidation branch: `chore/split-backend-frontend` (HEAD `5de750d`).
Audience: Claude Code (backend lane), Antigravity (frontend lane), the owner.
Purpose: one document both lanes work from. It replaces the priority lists in [ANTIGRAVITY_END_TO_END_HANDOFF.md](ANTIGRAVITY_END_TO_END_HANDOFF.md) where they differ (section 11 lists each difference). Statements marked **verified** were checked against the repository on this date; **reported** means taken from a lane's own report and not re-run.

Governing documents: [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md), [build-plan.md](build-plan.md), [ui-contract.md](ui-contract.md), [product-platform-decisions.md](product-platform-decisions.md), [product-split-plan.md](product-split-plan.md), [infrastructure.md](infrastructure.md), [deploy-staging.md](deploy-staging.md), [phase-0-status.md](phase-0-status.md), [production-readiness.md](production-readiness.md), [ai-agent-readiness/](ai-agent-readiness/). Product IDs are from [ERP-Product-Catalog.md](../ERP-Product-Catalog.md). The reference client's name stays out of products and docs.

## 1. What this project is

An ERP platform (320 catalog products) built as a modular monolith: shared kernel (tenancy, identity, money, events, audit, numbering, ledger), product modules, a Python agent service (UAAP) running eight bots, a React web app and a static marketing site. Never-change rules:

- Money is integer minor units (`bigint`), decimal strings on the wire, never floats; never computed in the browser.
- Every tenant table has `tenant_id` and row-level security; tenant data is queried only through `withTenantTransaction`.
- Modules talk through events written to the outbox in the same transaction as the business write.
- Accounting is the sink: money and stock movements post to the ledger. Ledger and audit rows are never updated or deleted; correct by reversal.
- Country and industry differences are data (configuration), not forks.
- Document numbers come from `NumberingService` in the same transaction.

## 2. Lanes and ownership

| | Claude Code (backend) | Antigravity (frontend) |
|---|---|---|
| Owns | `backend/`, `contracts/` | `frontend/` (`web/`, `site/`, `design/`, `locales/`, `e2e/`, `scripts/`) |
| Never | Edits `frontend/` | Edits `backend/` or `contracts/`; calculates money; touches the database |
| Contract | Writes `contracts/openapi.yaml` and `events.md` in the same PR as any route change | Reviews every contract change |
| Rules | Idempotency on money writes, RLS, balanced entries, outbox | Tokens only from `frontend/design/`; every figure from the API; no session token in any URL; follow [ui-contract.md](ui-contract.md) |

Root files (`package.json`, `scripts/dev-all.mjs`, CI, `.gitignore`) are the owner's; change them only in a small PR with a reason.

## 3. Branch and worktree reality (verified)

This differs from what [build-plan.md](build-plan.md) describes, and both lanes must know it.

| Folder | Branch | State |
|---|---|---|
| `E:\SaaS` | `chore/split-backend-frontend` | The real integration line and the ERP's home. `origin/main` is the website-only repository (it deleted the ERP in PR #6), so there is no merge or PR to it. Uncommitted: `frontend/web/src/lib/api-client.ts` (+16 lines: server error message first, plain 401 and 409 wording) and the two handoff docs |
| `E:\SaaS\.worktrees\frontend` | `lane/frontend` | Stale at `9c5f8cc`. It is an ancestor of the chore branch, so it contains nothing the chore branch lacks. Recent frontend work was done in `E:\SaaS` directly |
| `E:\SaaS\.worktrees\backend` | `lane/backend` | **Diverged, not stale.** Old pre-split layout (`packages/` at the root, not `backend/`). 10 commits not in the chore branch (inventory by batch and expiry, point-of-sale sync, counts and transfers, quotes, credit notes, master data, tamper-evident audit chain, status page), merge-base `164cfaf`. Its migrations `0006` to `0014` clash in number with the chore branch's `0006` to `0013` |

Consequences:

1. **Git refuses the same branch in two worktrees**, so neither lane can run `git checkout chore/split-backend-frontend` in its own worktree (the resume commands in the earlier reconciled draft would fail). Until the owner says otherwise, both lanes commit to `chore/split-backend-frontend` in `E:\SaaS`, one lane at a time, each touching only its own folders, committing small and often.
2. **The unmerged `lane/backend` work is a decision for the owner** (section 9, D1). Do not delete the branch. Bringing it over needs a port into the `backend/` layout and renumbering the migrations; it is not a plain merge.
3. Stores is "not built" on the chore branch only. Inventory and point-of-sale code exists on `lane/backend` in the old layout.

## 4. Architecture and runtime

- Backend (`backend/`): packages `audit, catalog, db, events, i18n, identity, kernel, ledger, money, notifications, numbering, queue, sales, tax, tenancy`; apps `api` (Fastify) and `worker` (BullMQ plus outbox relay); `services/uaap` (Python agents). Migrations `0001_foundation` to `0013_notifications`.
- API route modules: approvals, banking, cms, invoicing, ledger, master-data, notifications, purchasing, signup, workspace; plus idempotency, stream tickets, rate limit, Redis realtime bus.
- Contract: `contracts/openapi.yaml`, 91 operations, guarded by a contract-drift test (routes and contract must match exactly).
- Frontend: React 18, Vite 5, TypeScript, Tailwind, three.js; static site; Playwright e2e (14 spec files); generated API client in `frontend/web/src/lib/api/` (`index.ts`, `schema.ts`) built by `npm --prefix frontend run api:generate` (script exists, **verified**; screen-by-screen adoption not verified).
- Auth: password login, session token `<tenantId>.<random>` (hash stored). The web client keeps the token in memory. Live events: `POST /v1/events/tickets` gives a single-use ticket, then `/v1/events/stream?ticket=`. A token in a URL is refused.
- Worker (**verified**): runs the outbox relay on a timer and the `email.send` job on the `notifications` queue, with graceful shutdown. Dead-lettering and retries live in the dispatcher (tested).
- Data: Neon Postgres per product (Singapore), the API runs as a non-superuser app role so RLS applies, migrations use the owner role. Redis plus BullMQ. Target hosting: AWS ECS Fargate in `ap-south-1` behind Cloudflare.
- Local: `npm run dev:all` from `E:\SaaS` (Redis, API 3002, worker, site 8080); web app `npm --prefix frontend run dev:web` (5173).

## 5. Backend status (per catalog product)

Status key as in [phase-0-status.md](phase-0-status.md): no product is yet marked Implemented.

| Area | Status | Notes |
|---|---|---|
| PLT-01 identity | Partial | Password login, sessions, roles, password reset. No SSO, MFA, custom roles |
| PLT-02 tenancy, PLT-03 localisation, PLT-04 tax, PLT-05 FX, PLT-08 numbering | Partial | Core mechanisms tested; see phase-0 for gaps |
| PLT-06 events and jobs | Partial | Outbox, dispatcher with leases and dead-letter, relay timer in the worker. No scheduler, per-aggregate ordering |
| PLT-07 / AGT-01 approvals | Partial | `/v1/approval-requests` (API) and `/v1/approvals` (UAAP). No chains, thresholds, delegation |
| PLT-10 notifications | Partial | Email only through SES or a console provider; Chase Chloe reminders queue real mail; delivery state at `/v1/notifications`. No bounce handling, SMS, WhatsApp |
| PLT-16 audit | Partial | Append-only by database trigger. Hash chaining exists only on `lane/backend` |
| PLT-18 licensing | Partial | Entitlements enforced on ledger routes only |
| FIN-01 ledger | Partial | Accounts, periods, balanced multi-currency posting, close, reversal, trial balance |
| SAL-04, FIN-02 | Partial | Invoices, payments, void by reversal, statements, reminders. Quotes and credit notes only on `lane/backend` |
| MDM-01/02/03 | Partial | Parties, items, accounts APIs |
| PRC-01 to PRC-03 | Partial | `/v1/procurement/orders`, `/receipts`, `/matches` with override; in the contract; match total in integer minor units |
| FIN-04 bank | Partial | Lines, statement import, reconcile and unreconcile, tenant-defined matching rules (suggest only, never post). No ledger posting on reconcile yet |
| FIN-03 payables, FIN-09 statements | Not started on the backend | The web screens use what the API offers |
| INV, POS | Not on the chore branch | Exist on `lane/backend` (old layout) |
| UAAP | Eight bots | Python suite 274 passed, 5 skipped (need `UAAP_TEST_DATABASE_URL`) |
| PLT-09, 11 to 15, 17, 19, 20 | Not started | Custom fields, files, print, reporting, import, integration hub, search, mobile shell, SaaS billing |

## 6. Frontend status (reported unless noted)

- Design system: tokens, neo-brutal primitives (`AppHeader`, `Sidebar`, `Card`, `KpiTile`, `DataTable`, `StatusChip`, `Modal`, `Drawer`, `ConfirmDialog`, `CommandBar`), light and dark.
- App: lazy-loaded routes; main chunk about 296 kB (gzip about 90 kB), three.js chunk about 511 kB; validated at 375 px.
- Modules: dashboard with Money City 3D; parties; items; accounts and ledger; invoices with customer statement; purchasing with the live three-way match studio; payables; bank reconciliation (rules modal is **sample data**, labelled); financial statements; inventory and industry hub.
- Bots: Chase Chloe, Ledger Lou, Guard Gus, Forecast Finn, Pip, Restock Rex, Ticket Tess, Onboard Ola, plus the approvals inbox with live events.
- Site: static marketing site, 5,772 checks passing in `site:check`.
- Verified now: web pages and the module folders listed above exist in `frontend/web/src`; 14 Playwright specs exist.
- Not verified now: the build, the 41 web unit tests, the Playwright suite (never confirmed green against a live API), and whether the dashboard's bot cards still compute findings in the browser instead of the server.

## 7. Verification commands and last known results

```powershell
npm --prefix backend run typecheck
npm --prefix backend test                  # set TEST_DATABASE_URL to a Postgres role that can create databases
npm --prefix frontend run build:web
npm --prefix frontend/web test
npm --prefix frontend run site:check
npm --prefix frontend run test:e2e         # needs npm run dev:all
```

Last recorded: backend with Postgres 235 passed, 4 skipped (2026-11-21); Python 274 passed, 5 skipped; web unit 41 passed; site check 5,772 passed; typecheck clean. None re-run for this document. `git grep "token=" -- frontend` reported 0 occurrences.

## 8. Infrastructure and delivery state

- AWS (`ap-south-1`): 12 ECR repositories, clusters `qavril-staging` and `qavril-prod` (no services), two S3 buckets, GitHub OIDC provider present. **Not created:** ECS task definitions (`qavril-staging-api`, `-worker`, `-uaap`), services, load balancer, ElastiCache, Secrets Manager entries, the GitHub deploy role, the GitHub variables and the `staging` environment. The workflow `.github/workflows/deploy-staging.yml` has never run. Details: [deploy-staging.md](deploy-staging.md).
- CI (`ci.yml`): typecheck, tests, contract drift, agent tests, frontend build, site check.
- Email: code complete; needs a verified SES sender (`SES_FROM_ADDRESS`) and production access, which only the owner can arrange.
- Repository split (decided, not started): organisation `qavril-labs`; `platform, procurement, stores, sales, production, finance` plus `web-app`, all public; shared packages `@qavril/kernel, money, events-types, api-client`; a Neon project per product plus `qavril-agents`. [CLAUDE.md](../CLAUDE.md) keeps the current single-repository rules until each product repository is live.
- Known security gaps ([production-readiness.md](production-readiness.md)): no rate limit on most authenticated routes, no email verification, no MFA, staging `.pem` in the project root (git-ignored), live-event tenant filtering only in application code, audit coverage on money routes unchecked, no CORS policy, no backups beyond Neon's 6-hour window.

## 9. Decisions the owner must make

| # | Decision | Recommendation |
|---|---|---|
| D1 | What to do with `lane/backend` (inventory, POS, quotes, credit notes, audit chain) | Keep the branch; port the work into `backend/` as separate PRs after B2, renumbering migrations. Do not merge it directly |
| D2 | Which branch both lanes commit to while `lane/*` worktrees are stale | Commit to `chore/split-backend-frontend` in `E:\SaaS`, one lane at a time; or reset the lane worktrees onto it |
| D3 | Go-ahead for the repository split (decided direction 2026-11-23: keep this branch, ERP moves to new repositories; `origin/main` stays website-only) | Create `platform` first and move the shared packages; needs the owner to create the repositories, then B11 |
| D4 | AWS pieces for staging, SES sender, deploy role | Owner creates them from [deploy-staging.md](deploy-staging.md) |
| D5 | Hosting for the web app and site | S3 plus CloudFront behind Cloudflare, as already assumed |

## 10. Ordered work plan

### Backend (Claude Code)

| # | Task | Done when |
|---|---|---|
| B1 | ~~Bank rules engine (FIN-04)~~ **Done 2026-11-23** | `@erp/banking` engine, migration `0014_bank_rules`, `/v1/banking/rules` (list, create, `PUT`/`DELETE` by id, `apply`), audit entries, 29 new tests. Frontend can now do F4. See the change log |
| B2 | ~~Merge `origin/main`~~ **Cancelled 2026-11-23.** `origin/main` is now the website-only repository (PR #6 deleted the ERP: 438 files). The owner chose to keep `chore/split-backend-frontend` as the ERP's home and move it to new repositories. Never merge `origin/main` into this branch | Instead: keep this branch green; the ERP moves to the new `platform` repository after D3 (B11). Site-only changes from PRs 5, 7, 8 are cherry-picked into `frontend/site` only if still needed |
| B3 | Port `lane/backend` features per D1 | Each feature lands with renumbered migrations, tests and contract entries |
| B4 | Staging deploy | After D4: run the workflow once, confirm health 200 on port 3002 |
| B5 | Security hardening: **partly done 2026-11-23** | Done: audit entries on every money-moving write (`a0127c3`), rate limit keyed by tenant and address, and permissions on every invoicing, master-data and procurement write. Left: read permissions (the `user` role can still read business data), email verification, MFA, CORS policy, move the `.pem`, a shared rate-limit store before running several API instances |
| B6 | Backups: **scripts done 2026-11-23, not scheduled** | `backend/scripts/backup/` (backup, restore-test), tested with real `pg_dump` and `pg_restore`; runbook in [backups.md](backups.md). Left, all needing the owner: S3 bucket, a scheduled run, a monthly restore drill |
| B7 | Post other modules to the ledger via the outbox | Purchasing, payables, bank events balanced and tested; FIN-03, FIN-09 |
| B8 | Bot brains on the server (Part 2) | Move dashboard bot findings out of the browser, per [BOT_BUILD_SPLIT.md](ai-agent-readiness/BOT_BUILD_SPLIT.md); never implement an industry agent before its data sources and entitlement are verified |
| B9 | Next catalog slices | INV, PLT-12 PDF, PLT-14 import and migrators, PLT-08 patterns, first industry pack, AI-09 |
| B10 | Contract hygiene | Every route change updates `openapi.yaml` and `events.md` in the same PR |
| B11 | Repository split | Only after D3 |

### Frontend (Antigravity)

| # | Task | Done when |
|---|---|---|
| F1 | Run the Playwright suite against a live `dev:all` | Passes, or each failure has a written reason (stale test or real bug) and an issue |
| F2 | Report generated-client adoption | List which screens still use hand-written calls in `api-client.ts` |
| F3 | Commit or discard the pending `api-client.ts` change | Plain 401 and 409 wording per ui-contract section 8, and the server's own message shown first; committed on the chore branch |
| F4 | Bind the bank rules studio after B1 | Until then the modal keeps its sample-data label |
| F5 | Bind inventory and stores screens when INV lands (B3 or B9) | No fake numbers |
| F6 | Hosting plan for web and site (D5) | `apiBase` points at staging once it exists |
| F7 | `web-app` repository | Only after D3, built from the contracts only |
| F8 | Reset or retire the stale `lane/frontend` worktree (D2) | Agreed with the owner |

### Owner

D1 to D5, AWS and SES setup, a consenting pilot customer with an accountant's sign-off on a to-the-cent reconciliation before the platform is called proven, and an independent security review.

## 11. Corrections to the earlier frontend dossier

1. "Wire live endpoints for procurement and stores" is mostly done: purchasing routes and migration `0012` exist and the studio reads them live. There is no `procurement-routes.ts` and no `/v1/stores/grn`.
2. The reminder route is `POST /v1/invoicing/reminders`, not under `/v1/sales`.
3. Email is built; the missing piece is a verified sender, an owner task.
4. The repository split needs the owner's go-ahead first.
5. Staging cannot deploy until the AWS pieces exist.
6. Its resume commands (`git checkout chore/split-backend-frontend` inside a lane worktree) fail; see section 3.
7. It omitted the diverged `lane/backend` work, backups, ledger posting from other modules and the owner's items.

## 12. Working agreement

1. Pull before each task; edit only your lane's folders. Backend and contract in one PR; frontend never works around a missing endpoint with invented numbers, it files the request in [antigravity-handoff.md](antigravity-handoff.md) section 5 and keeps the sample-data label.
2. Commits name catalog IDs; a new dependency needs a stated reason.
3. Before saying done, run the section 7 commands and list which were not run.
4. If this document and the code disagree, the code wins; fix the document in the same PR.

## 13. Change log

- 2026-11-23: B2 (merge `origin/main`) cancelled. `origin/main` removed the ERP in PR #6; the ERP stays on `chore/split-backend-frontend` and moves to new repositories. Sections 3, 9 and 10 updated. Antigravity is not blocked: it may commit again.
- 2026-11-23: B1 done. New: `backend/packages/banking` (pure bigint engine), migration `0014_bank_rules.sql`, `backend/packages/db/src/banking-store.ts`, rule routes in `banking-routes.ts`, contract entries (`listBankRules`, `createBankRule`, `updateBankRule`, `deleteBankRule`, `applyBankRules`; `BankFeedLine` gains `ruleId`, `ruleName`; import response gains `ambiguous`). Behaviour changes for the frontend: (1) all `/v1/banking/*` routes now require a permission (`fin.report.read` to read, `fin.journal.post` to change); the built-in `user` role has none; (2) the old import matched floats against the wrong status names, so it never suggested anything; now exact minor-unit matching against open invoices (`issued`, `sent`, `partially_paid`, `overdue`) and bills (`approved`, `overdue`) by balance due, default confidence 80; (3) two documents with the same amount are reported as ambiguous and left unmatched. Frontend next: F4 binds `BankRecRulesModal` to the new routes; regenerate the client with `npm --prefix frontend run api:generate`.
- 2026-11-23: B5 partly and B6 scripts done. Behaviour changes for the frontend: none in response shapes. Backend now writes audit entries for money writes; the rate limit allows 300 requests a minute per tenant and address.
- 2026-11-23: write permissions added. **Frontend impact:** a signed-in user whose role lacks the permission now gets 403 `FORBIDDEN` (message names the permission) on invoice, bill, party, item, account, purchase order, receipt and match override writes, where before it succeeded. The workspace owner (`tenant_admin`) and the `accountant` role are unaffected. The `accountant` role also gained `mdm.*`. Screens should hide or disable these actions and show a plain no-access message on a 403.
