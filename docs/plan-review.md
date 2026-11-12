# Plan review and agreement

Before any building starts, Claude Code and Antigravity each review the plan and record their answers here. The owner resolves differences and signs off at the bottom.

**Documents under review:** [build-plan.md](build-plan.md), [ui-contract.md](ui-contract.md), [AGENTS.md](../AGENTS.md), [design/tokens.json](../design/tokens.json).

## How to run the review

Give each tool this prompt, in its own workspace:

> Read docs/build-plan.md, docs/ui-contract.md, AGENTS.md, CLAUDE.md and design/tokens.json. Review the plan for your lane. In docs/plan-review.md, fill in your section only: say whether you agree, list anything you would change and why, list anything missing that your lane needs from the other lane, and list risks you see. Do not edit any other file.

## Claude Code (backend)

- **Agree with the plan as written:** _yes_, with the by-part bot split Antigravity proposes, and with the owner's update of 2026-11-11 below.
- **Changes proposed, with reasons:**
  - Working folders are subfolders of the main folder, as the owner asked: `E:\SaaS\.worktrees\backend` (Claude Code) and `E:\SaaS\.worktrees\frontend` (Antigravity), not `E:\SaaS-web`. `.worktrees/` is git-ignored, so nothing is committed inside itself.
  - Backend, frontend and databases are separate parts ([infrastructure.md](infrastructure.md)): one Neon project for the core and one per product family, each with its own outbox, and money always posting to the core ledger through events. This keeps architecture rules 3, 4 and 6 true across databases.
  - Background work runs on BullMQ and Redis through `apps/worker` and `packages/queue`, relaying the transactional outbox so a queue outage never loses an event.
- **What I need from the frontend lane:**
  - Build only against `apps/api/openapi.yaml` and the generated client; open an issue for any new field rather than reading other endpoints.
  - Screens show the API's decimal strings and never compute money.
  - `data-testid` attributes on interactive elements so end-to-end tests stay stable.
- **Risks I see:**
  - **Cross-database consistency.** A product write and its ledger posting are no longer one transaction. Guarded by per-database outboxes, idempotent consumers and a reconciliation report per pack.
  - **Public repository.** The GitHub repository is public; business documents and plans become visible once pushed. The owner decides what is pushed.
  - **Shared root files** (`package.json`, lockfile, `tsconfig.json`, CI): changed only in small pull requests of their own, to avoid lane conflicts.

## Antigravity (frontend lane)

- **Agree with the plan as written:** _yes_ — strongly agree with Claude Code's recommendation to **split every bot by part, not by bot half**.
- **Changes proposed, with reasons:**
  - Standardize on the 6-part bot model from `docs/build-plan.md`:
    - **Claude Code (Backend):** Parts 1–4 & 6-unit (Signals API, Brain in `services/uaap/`, Actions & Approvals, Delivery, and Unit Evaluations).
    - **Antigravity (Frontend):** Parts 5 & 6-browser (`BotCard`, Bot Configuration/Detail Page, Approvals Inbox with review modals, enable/disable switch, 3D scenes / charts, and Playwright E2E browser tests).
  - Aligns 100% with `AGENTS.md` ("Never touch packages/, apps/api/, services/uaap/, migrations or authentication. You are the frontend lane").
  - Eliminates all Wave 1 backend dependency blockers (missing tools, lack of PLT-11 storage, missing read APIs).
  - Rewrites `BOT_BUILD_SPLIT.md` to reflect the by-part split.
- **What I need from the backend lane:**
  - First commit & git worktree setup (`E:\SaaS` for `lane/backend`, `E:\SaaS-web` for `lane/frontend`).
  - Claude Code delivers F1 (A5 restart-survival sign-off) and OpenAPI contracts (`apps/api/openapi.yaml`) + generated client (`packages/api-client/`) for bot signals and approvals inbox.
  - Endpoints for `GET /v1/workspace/insights` and `/v1/admin/agents` to power `BotCard`s and the admin kill switch.
- **Risks I see:**
  - Frontend development waiting on backend endpoints: fully mitigated by generating mock responses from `openapi.yaml` so frontend components and Playwright tests can be built without blocking.

## Open points

| # | Point | Raised by | Decision |
|---|---|---|---|
| 1 | Durability A5 restart-survival failing | Claude Code | Claude Code resolves as F1 before bot rollout |
| 2 | File edits in services/uaap | Claude Code | Resolved: Antigravity did not edit platform files and will touch zero files in `services/uaap/` under the by-part split |
| 3 | Bot build split model (by-bot vs by-part) | Claude Code | Agreed: Split by part as defined in `docs/build-plan.md` |
| 4 | First commit & worktree creation | Claude Code | Owner chose GitHub `msaxena1212/qavril_labs` and subfolders under `E:\SaaS\.worktrees\`; first commit made locally, push awaits owner confirmation because the repository is public |
| 5 | Separate databases on Neon, Redis and BullMQ | Owner | Adopted; see [infrastructure.md](infrastructure.md) |

## Sign-off

- [x] Claude Code agrees
- [x] Antigravity agrees
- [ ] Owner signs off, and the plan's status changes from "draft for agreement" to "agreed"

Date agreed:
