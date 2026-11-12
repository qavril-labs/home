# Build plan: Claude Code and Antigravity, one platform

**Status: draft for agreement.** Claude Code and Antigravity each review this plan and record their answers in [plan-review.md](plan-review.md). Work starts once both agree and the owner signs off.

How QAVRIL LABS is built by two tools in one workspace, with one look and one architecture. Product IDs refer to [ERP-Product-Catalog.md](../ERP-Product-Catalog.md). Every screen follows [ui-contract.md](ui-contract.md). Colours, type and spacing come from [design/](../design).

## 1. The split: backend and frontend

| | **Claude Code** | **Antigravity** |
|---|---|---|
| **Lane** | Backend, data and bots' logic | Frontend, visuals and quality |
| **Builds** | Domain packages, database migrations (core and each product database on Neon), the HTTP API, the background worker with BullMQ and Redis, the API contract and generated client, ledger posting, permissions and approvals, the bot service (`services/uaap/`), CSV import and export logic, document templates (PDF), notification sending | The web app (`apps/web/`): every screen, modal, drawer and toast; 3D scenes; charts; the marketing site; translations; end-to-end browser tests; visual checks at every width and theme |
| **Why** | Careful, rule-heavy work where a mistake costs money or leaks data | Fast UI building with its own browser to see, click and test what it builds |
| **Reviews** | Every change that touches the API contract, money, permissions or data | Every screen and visual change, against the UI contract |
| **Never does** | Visual design outside the contract | Business logic, money arithmetic, migrations, authentication, direct database access |

The **contract** between the two lanes is the API: `apps/api/openapi.yaml` plus the generated client in `packages/api-client/`. The frontend calls nothing else, and the backend changes the contract only through a pull request the frontend sees.

## 2. Folder ownership

| Folder | Owner | The other tool may |
|---|---|---|
| `packages/*` (domain), `packages/db/` | Claude Code | Read |
| `apps/api/`, `apps/api/openapi.yaml` | Claude Code | Request changes by issue |
| `packages/api-client/` (generated) | Claude Code | Read and import |
| `services/uaap/` (bot service) | Claude Code | Read |
| `packages/importers/`, `packages/templates/` | Claude Code | Read |
| `design/` (tokens) | Antigravity | Request a token by issue; Claude Code reviews contrast |
| `apps/web/` (web app) | Antigravity | Claude Code reviews API calls |
| `apps/web/src/scenes/` (3D) | Antigravity | — |
| `site/`, `scripts/site-*.mjs` (marketing site) | Antigravity | — |
| `locales/` (translations) | Antigravity | Claude Code adds server-side message keys |
| `tests/e2e/` | Antigravity | — |
| `docs/` | Both, each in its own lane's docs | — |

Files neither tool edits alone: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, CI workflows. Change them in a small pull request of their own, with a reason.

## 3. Working in the same workspace

The main folder stays `E:\SaaS`, connected to GitHub at `https://github.com/msaxena1212/qavril_labs`. Each tool works in its own subfolder, a **git worktree**: the same repository, its own folder and branch, so the two never overwrite each other.

| Folder | Who | Branch |
|---|---|---|
| `E:\SaaS` | The owner: merges, reviews, runs the whole platform | `main` |
| `E:\SaaS\.worktrees\backend` | Claude Code | `lane/backend` |
| `E:\SaaS\.worktrees\frontend` | Antigravity | `lane/frontend` |

The `.worktrees/` folder is ignored by git, so the subfolders never get committed inside each other. Each lane pulls `main` before every task and merges back through pull requests at least once a day. Set up once:

```bash
git worktree add .worktrees/backend -b lane/backend
git worktree add .worktrees/frontend -b lane/frontend
```

The backend, frontend and databases are separate parts; [infrastructure.md](infrastructure.md) describes them, the Neon projects, Redis and BullMQ. Run everything locally with `npm run dev:all` (site on 8080, API on 3002, Redis on 6379, plus the worker). While an endpoint is still being built, the frontend uses mock responses generated from `openapi.yaml`.

## 4. The bots, split into parts

Every bot is built from the same six parts. A bot is done when all six exist.

| Part | What it is | Owner |
|---|---|---|
| **1. Signals** | An API endpoint returning exactly the figures the bot reads | Claude Code |
| **2. Brain** | Rules, and model prompts where useful, turning signals into findings and a proposed action (`services/uaap/`) | Claude Code |
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
| Write `apps/api/openapi.yaml` for every existing route and generate `packages/api-client/` | Create `apps/web/` (React, Vite, TypeScript, Tailwind) using `design/tailwind.preset.cjs` and `design/tokens.css` |
| Move the bot findings into `GET /v1/workspace/insights`, with tests | Build the shared components: `AppHeader`, `Card`, `KpiTile`, `DataTable`, `StatusChip`, `BotCard`, `TrendChart`, `EmptyState`, `Gate`, `Modal`, `Drawer`, `Toast`, `ConfirmDialog`, `CommandBar` |
| Add the error-code list to the contract so screens can show the right message | A component gallery page showing every component in light and dark at 375, 768 and 1280px |
| — | Set up Playwright in `tests/e2e/`: sign-up, sign-in, quick entry, sign-out against `npm run dev:all` |

## 7. Sprints 1 to 6 (two weeks each)

The order follows the catalog's critical path: master data and the ledger, then buying and stock, then cash and statements, then the first industry pack.

| Sprint | Claude Code (backend) | Antigravity (frontend) |
|---|---|---|
| **1** | MDM-01 customers and suppliers, MDM-02 items, MDM-03 chart of accounts API; Ledger Lou brain | Rebuild the dashboard in `apps/web/` with the money city; customers and items screens with create and edit drawers; CSV import screen |
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
