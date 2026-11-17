# Build plan: Claude Code and Antigravity, one platform

**Status: draft for agreement.** Claude Code and Antigravity each review this plan and record their answers in [plan-review.md](plan-review.md). Work starts once both agree and the owner signs off.

How QAVRIL LABS is built by two tools in one workspace, with one look and one architecture. Product IDs refer to [ERP-Product-Catalog.md](../ERP-Product-Catalog.md). Every screen follows [ui-contract.md](ui-contract.md). Colours, type and spacing come from [frontend/design/](../frontend/design).

## 1. The split: backend and frontend

| | **Claude Code** | **Antigravity** |
|---|---|---|
| **Lane** | Backend, data and bots' logic | Frontend, visuals and quality |
| **Builds** | Domain packages, database migrations (core and each product database on Neon), the HTTP API, the background worker with BullMQ and Redis, the API contract and generated client, ledger posting, permissions and approvals, the bot service (`backend/services/uaap/`), CSV import and export logic, document templates (PDF), notification sending | The web app (`frontend/web/`): every screen, modal, drawer and toast; 3D scenes; charts; the marketing site; translations; end-to-end browser tests; visual checks at every width and theme |
| **Why** | Careful, rule-heavy work where a mistake costs money or leaks data | Fast UI building with its own browser to see, click and test what it builds |
| **Reviews** | Every change that touches the API contract, money, permissions or data | Every screen and visual change, against the UI contract |
| **Never does** | Visual design outside the contract | Business logic, money arithmetic, migrations, authentication, direct database access |

The **contract** between the two lanes is the API, described in `contracts/openapi.yaml`. The frontend generates its own client from it and calls nothing else; the backend changes the contract only through a pull request the frontend reviews.

## 2. Two separate halves

The repository has two separate npm projects with nothing in common but the contract:

```
E:\SaaS                    main branch; the owner merges and runs everything here
├─ backend/                Claude Code. Own package.json, lockfile, tsconfig, tests
│  ├─ apps/api/            HTTP API (Fastify)
│  ├─ apps/worker/         BullMQ worker and outbox relay
│  ├─ packages/            domain packages, db and migrations, queue, catalog
│  ├─ services/uaap/       agent service (Python)
│  └─ scripts/             catalog generator
├─ frontend/               Antigravity. Own package.json, lockfile
│  ├─ web/                 the web app (React, Vite, Tailwind, three.js)
│  ├─ site/                the marketing site (static HTML)
│  ├─ design/              design tokens and the Tailwind preset
│  ├─ locales/             translations
│  ├─ e2e/                 Playwright end-to-end tests
│  └─ scripts/             site build, check and local server
├─ contracts/              the only shared files: openapi.yaml, events.md (backend owns, frontend reviews)
├─ docs/                   plans and specs
├─ scripts/dev-all.mjs     runs both halves together on this machine
└─ CLAUDE.md, AGENTS.md, ERP-Product-Catalog.md
```

| Folder | Owner | The other tool may |
|---|---|---|
| `backend/` (everything inside) | Claude Code | Read only |
| `frontend/` (everything inside) | Antigravity | Read only |
| `contracts/` | Claude Code writes | Antigravity reviews every change |
| `docs/` | Both, each in its own lane's docs | — |
| Root files: `package.json`, `scripts/dev-all.mjs`, `.gitignore`, `.claude/`, CI workflows | Owner | Change only in a small pull request of its own, with a reason |

The frontend never imports backend code. It reads `contracts/openapi.yaml`, generates its own typed client and mocks inside `frontend/`, and calls the API over HTTP. The backend never imports frontend code. Each half installs, builds, tests and deploys on its own:

| | Backend | Frontend |
|---|---|---|
| Install | `npm --prefix backend install` | `npm --prefix frontend install` |
| Check | `npm --prefix backend run typecheck` and `npm --prefix backend test` | `npm --prefix frontend run site:check` and `npm --prefix frontend run build:web` |
| Run alone | `npm --prefix backend run dev:api` | `npm --prefix frontend run dev:web` |
| Deploy | API and worker to AWS | Web app and site to AWS (S3 and CloudFront), behind Cloudflare |

## 3. Working in the same workspace

The main folder stays `E:\SaaS`, connected to GitHub at `https://github.com/qavril-labs/home` (branch `main`). The repository's `backend` and `frontend` branches belong to a separate, existing construction app; this platform does not use or change them.

Each tool works in its own subfolder, a **git worktree**: the same repository, its own folder and branch, so the two never overwrite each other.

| Folder | Who | Branch | Edits only |
|---|---|---|---|
| `E:\SaaS` | The owner: merges, reviews, runs the whole platform | `main` | Root files |
| `E:\SaaS\.worktrees\backend` | Claude Code | `lane/backend` | `backend/`, `contracts/` |
| `E:\SaaS\.worktrees\frontend` | Antigravity | `lane/frontend` | `frontend/` |

**Product repositories (decided, see [product-platform-decisions.md](product-platform-decisions.md)).** The platform is split into separate GitHub repositories under `qavril-labs`, each private, each with its own database: `platform` (identity, tenancy, approvals, numbering, audit, events, parties, items, ledger), `procurement`, `stores`, `sales`, `production`, `finance`, and a web app repository owned by Antigravity. Each repository follows the same rules: CI must pass, one approval, and contract changes need Antigravity's approval. Until a product's repository is set up, its work stays in this repository's `backend/` lane.

Because each lane edits only its own top-level folder, the two branches never change the same file, so merges into `main` do not conflict. The `.worktrees/` folder is ignored by git. Each lane pulls `main` before every task and merges back through pull requests at least once a day.

[infrastructure.md](infrastructure.md) covers the databases, Redis and BullMQ, and hosting. Run everything locally with `npm run dev:all` (site on 8080, API on 3002, Redis on 6379, plus the worker).

## 4. The bots, split into parts

Every bot is built from the same six parts. A bot is done when all six exist.

| Part | What it is | Owner |
|---|---|---|
| **1. Signals** | An API endpoint returning exactly the figures the bot reads | Claude Code |
| **2. Brain** | Rules, and model prompts where useful, turning signals into findings and a proposed action (`backend/services/uaap/`) | Claude Code |
| **3. Action and approval** | The API command the bot may call, its limit, the draft it creates, the approval step, the audit entry and the kill switch (AGT-01, AGT-06) | Claude Code |
| **4. Delivery** | Email, WhatsApp and in-app messages from approved templates (PLT-10) | Claude Code |
| **5. Screens** | `BotCard`, the bot's page with its 3D or chart view, the approvals inbox with review modals | Antigravity |
| **6. Tests** | Unit evaluations with known data (Claude Code); a browser test of signal, draft, approval and result (Antigravity) | Both |

### The eight bots

| Bot | Catalog | Signals it reads | What it drafts | Needs first |
|---|---|---|---|---|
| **Ledger Lou**, month-end checker | AGT-03, FIN-13 | Balances, entries without notes, entries after close, unreconciled bank lines | Month-end checklist; notes to add | FIN-01 (done), FIN-04, FIN-13 |
| **Chase Chloe**, payment reminders | FIN-14 | Open invoices by age, promises to pay | Reminder messages; call tasks at 30 days | SAL-04, FIN-02, PLT-10 |
| **Forecast Finn**, cash forecast | AIS-02 | Cash, receivables, payables, monthly trend | 30, 60 and 90-day forecast with editable assumptions | FIN-02, FIN-03 |
| **Guard Gus**, anomalies | AI-04, AIS-03 | Duplicate bills or payments, unusual amounts and discounts | Review flags with the evidence | FIN-03, SAL-04 |
| **Pip**, sales follow-up | AGT-02 | Quotes without reply, quiet deals, sales pace | Follow-up messages; next steps | SAL-01, SAL-02 |
| **Restock Rex**, restocking and bills | AGT-04 | Stock levels, reorder points, sales speed, bills due | Purchase orders; payment schedule | INV-05, PRC-03 |
| **Ticket Tess**, customer support | AGT-05 | Open tickets, knowledge base | Replies; hand-over to a person | SAL-11, SAL-13 |
| **Onboard Ola**, new staff setup | HRM-10 | New employee records, start dates | Access requests, first-week checklist | HRM-01, PLT-01 |

Today the dashboard's bot cards are worked out in the browser from the overview. Part 2 moves that logic to the server, so the same findings can reach email, WhatsApp and chat (AI-09), not only the dashboard.

## 5. Week 0: set up and agree

| Step | Who | Done when |
|---|---|---|
| Both tools review this plan, [ui-contract.md](ui-contract.md) and [AGENTS.md](../AGENTS.md); answers go in [plan-review.md](plan-review.md) | Both | Both sections filled in, open points resolved, owner signs off |
| First commit, push to GitHub, create the `.worktrees/backend` and `.worktrees/frontend` subfolders | Owner, with Claude Code | `git worktree list` shows all three folders |
| CI workflow running typecheck, tests and the site check on every pull request | Claude Code | A test pull request shows all checks |

## 6. Week 1: contracts and foundations

| Claude Code (backend) | Antigravity (frontend) |
|---|---|
| Write `contracts/openapi.yaml` for every existing route, and `contracts/events.md` | Create `frontend/web/` (React, Vite, TypeScript, Tailwind) using `frontend/design/tailwind.preset.cjs` and `frontend/design/tokens.css` |
| Move the bot findings into `GET /v1/workspace/insights`, with tests | Build the shared components: `AppHeader`, `Card`, `KpiTile`, `DataTable`, `StatusChip`, `BotCard`, `TrendChart`, `EmptyState`, `Gate`, `Modal`, `Drawer`, `Toast`, `ConfirmDialog`, `CommandBar` |
| Add the error-code list to the contract so screens can show the right message | A component gallery page showing every component in light and dark at 375, 768 and 1280px |
| — | Set up Playwright in `frontend/e2e/`: sign-up, sign-in, quick entry, sign-out against `npm run dev:all` |

## 7. Sprints 1 to 6 (two weeks each)

The order follows the catalog's critical path: master data and the ledger, then buying and stock, then cash and statements, then the first industry pack.

| Sprint | Claude Code (backend) | Antigravity (frontend) |
|---|---|---|
| **1** | MDM-01 customers and suppliers, MDM-02 items, MDM-03 chart of accounts API; Ledger Lou brain | Rebuild the dashboard in `frontend/web/` with the money city; customers and items screens with create and edit drawers; CSV import screen |
| **2** | SAL-04 invoicing, FIN-02 receivables, PLT-08 number patterns, invoice PDF (PLT-12); Chase Chloe brain | Invoice list and editor, customer statement, send-reminder modal; E2E invoice to payment |
| **3** | PLT-07 approvals, AGT-01 agent permissions, AGT-06 agent audit; email and WhatsApp delivery (PLT-10 slice) | Approvals inbox with review modals; bot pages with on and off switch; E2E approve and reject |
| **4** | PRC-01 to PRC-04 purchasing, INV-01, INV-02, INV-06 stock; Restock Rex and Guard Gus brains | Purchase orders, goods receipt, stock screens; stock warehouse 3D scene |
| **5** | FIN-03 payables, FIN-04 bank and cash with statement import, FIN-09 statements; Forecast Finn and Pip brains; QuickBooks and Xero CSV migrators (PLT-14) | Bills, bank reconciliation, profit and loss, balance sheet; cash river 3D scene; sales pipeline funnel |
| **6** | First industry pack core (for example DS-01, DS-02 if FMCG is chosen); AI-09 command API | Pack screens; chat panel in the `CommandBar`; marketing site pages for the pack |

After sprint 6: Ticket Tess and Onboard Ola, the second industry pack, and the mobile shell (PLT-19).

## 8. How a task moves

1. **Issue.** Title starts with the catalog ID and lane, for example `[SAL-04][frontend] Invoice editor`. The body links the contract section, the API operations used and the acceptance checks.
2. **Branch.** From the lane branch: `backend/SAL-04-invoicing` or `frontend/SAL-04-invoice-editor`.
3. **Build.** Only in the lane's folders, against the contract.
4. **Pull request.** All checks pass. Frontend pull requests include screenshots at 375 and 1280px in light and dark.
5. **Cross-review.** The other tool reviews: Antigravity checks screens against the UI contract; Claude Code checks API use and anything touching money or permissions. Then merge to `main`.

## 9. How each tool is set up

| Tool | Reads at the start of every task | Works in |
|---|---|---|
| Claude Code | `CLAUDE.md` (links to this plan and the UI contract) | `E:\SaaS\.worktrees\backend` |
| Antigravity | `AGENTS.md` | `E:\SaaS\.worktrees\frontend` |

## 10. Risks and guards

| Risk | Guard |
|---|---|
| The two tools overwrite each other | Separate worktrees and branches; folder ownership |
| Frontend waits on backend | Contract first; mock responses from `openapi.yaml` |
| Screens drift from the brand | Tokens only; shared component names; the UI contract checklist in every review |
| 3D slows the app or hides data | Loaded on demand, desktop only, with the 2D view always present |
| Bots act on the books without control | Bots call only API commands with limits, drafts and approvals, built and reviewed by Claude Code |
| Mistakes in money handling | Balance tests; no money arithmetic in the frontend; Claude Code review on every money-moving change |
