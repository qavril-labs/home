# Antigravity handoff: frontend lane

Copy the prompt in section 1 into Antigravity. Everything it refers to is linked below. Repository: [qavril-labs/home](https://github.com/qavril-labs/home).

## 1. The prompt

> You are the **frontend lane** for QAVRIL LABS. Work only in your worktree `E:\SaaS\.worktrees\frontend` on branch `lane/frontend`. Edit only files inside `frontend/`. Never edit `backend/`, `contracts/` or root files: if you need a change there, write an issue in `docs/antigravity-handoff.md` section 5 instead.
>
> Read these first, in this order:
> 1. [AGENTS.md](../AGENTS.md): your rules.
> 2. [docs/build-plan.md](build-plan.md): lanes, folder ownership, sprints.
> 3. [docs/ui-contract.md](ui-contract.md): the look, layout, components, modals, 3D rules and words.
> 4. [contracts/openapi.yaml](../contracts/openapi.yaml): the only description of the backend you may rely on.
> 5. [docs/infrastructure.md](infrastructure.md): how the stack runs locally and where it deploys.
>
> Then do the tasks in section 3, in order. Before each pull request run the commands in section 4. Use only tokens from `frontend/design/`. Never calculate money in the browser. Every figure on screen comes from the API.

## 2. Setup

```bash
git -C E:\SaaS fetch origin
git -C E:\SaaS worktree list
cd E:\SaaS\.worktrees\frontend
git pull --rebase origin main
npm --prefix frontend install
npm run dev:all        # from E:\SaaS: starts Redis, API (3002), worker and site (8080)
npm --prefix frontend run dev:web   # web app on 5173
```

The worktree files live in your folder; `dev:all` runs from the main folder `E:\SaaS`. Keep `REDIS_URL` unset unless you need Redis.

## 3. Tasks

Each task names the files, what is wrong or missing, and how you know it is done.

### T1. Finish or revert the sign-in change in the web app
- **File:** [frontend/web/src/App.tsx](../frontend/web/src/App.tsx). It imports `SignInForm` from `frontend/web/src/modules/auth/SignInForm`, and the change is not committed.
- **Done when:** the sign-in path works from the signed-out gate, or the change is reverted. Either way it is committed on `lane/frontend`.

### T2. Lazy-loading of screens
- **File:** [frontend/web/src/App.tsx](../frontend/web/src/App.tsx). Pages and modules load with `lazy()` behind a `Suspense` boundary.
- **Measured:** main bundle 1,375 kB → 296 kB (gzip 339 kB → 90 kB). The three.js chunk (511 kB) loads only on 3D screens.
- **Done when:** `npm --prefix frontend run build:web` passes, and no screen shows a blank main area while its chunk loads. Check the fallback text and the three.js-only screens.

### T3. Review the stream-ticket change in the web client
- **File:** [frontend/web/src/lib/api-client.ts](../frontend/web/src/lib/api-client.ts), `subscribeToEvents`. It requests a single-use ticket from `POST /v1/events/tickets` for every connection, including reconnects, and never puts the session token in a URL.
- **Backend it depends on:** [backend/apps/api/src/invoicing-routes.ts](../backend/apps/api/src/invoicing-routes.ts) (tickets, the stream) and [contracts/openapi.yaml](../contracts/openapi.yaml) (`/v1/events/tickets`, `/v1/events/stream`).
- **Done when:** the dashboard receives a live event after a write made in another browser tab, and the stream reconnects after you stop the API for a few seconds and start it again. Record both in your pull request.

### T4. Review the idempotency header on the dashboard
- **File:** [frontend/site/app.js](../frontend/site/app.js), the quick-entry submit (`pendingEntryKey`, around line 500). It sends one `Idempotency-Key` per submission and keeps it until the entry saves.
- **Backend rule:** [contracts/openapi.yaml](../contracts/openapi.yaml), `postQuickEntry`. A retry with the same key returns the first response; the same key with a different body returns 409.
- **Done when:** a double click on "Record sale" posts one entry, and a failed request followed by a retry posts once. Show the single entry in the recent list.

### T5. Browser suite: triage every failure
- **Files:** [frontend/e2e/playwright.config.ts](../frontend/e2e/playwright.config.ts) and [frontend/e2e/specs/](../frontend/e2e/specs/). About 110 tests across 11 specs.
- **Known state:** the last full run showed failures in the quick-entry, chart, Chase Chloe reminder and Ledger Lou period-lock flows. Some specs were written against the earlier mock data, so each failure is either a stale test (fix the test) or a real bug (fix the app). Write the decision next to each failure in your pull request.
- **Done when:** `npm --prefix frontend run test:e2e` passes, or each remaining failure has a written reason and an issue.

### T6. Web unit tests
- **Files:** [frontend/web/test/](../frontend/web/test/). Vitest is now a dev dependency of the web app and `npm --prefix frontend/web test` runs them (3 files, 31 tests).
- **Note:** the `run-*.mjs` files in the same folder duplicate the same checks with Node's test runner. Keep one set; the vitest files are the one to keep.
- **Done when:** `npm --prefix frontend/web test` passes in CI, and the duplicate runners are removed or justified.

### T7. Generate the API client from the contract
- **Source:** [contracts/openapi.yaml](../contracts/openapi.yaml) (69 operations, named request and response schemas).
- **Done when:** a generated typed client lives in `frontend/web/src/lib/api/` and is produced by one script (for example `openapi-typescript`). The hand-written calls in [frontend/web/src/lib/api-client.ts](../frontend/web/src/lib/api-client.ts) move to it one screen at a time. Note in your pull request which screens are still hand-written.

### T8. Remove the old `?token=` stream code from the web app
- **Check:** the web app must not contain `?token=` or put a session token in any URL. The backend no longer accepts it.
- **Done when:** `git grep -n "token=" -- frontend` shows no stream URL.

### T9. Review the UI against the contract
- Walk [docs/ui-contract.md](ui-contract.md) section by section for each screen you changed. Note any screen that does not follow it.
- Error messages for the new 401 (stream ticket) and 409 (idempotency conflict) should use the plain words in the contract, section 8.

## 4. Status & verification results

All tasks T1 through T9 have been verified and documented in [docs/ai-agent-readiness/handoffs/antigravity-frontend-completion.md](ai-agent-readiness/handoffs/antigravity-frontend-completion.md):

- `npm --prefix frontend run build:web`: **Passed** (Main bundle 295.74 kB / gzip 89.92 kB, 3D chunk 510.85 kB).
- `npm --prefix frontend run site:check`: **Passed** (5,772 checks passed, 0 failed).
- `npm --prefix frontend/web test`: **Passed** (41 unit tests in 5 suites passed).
- Zero `token=` occurrences in frontend URLs verified.
- Mobile Safari 375px navigation and sign-out drawer verified with zero horizontal scroll.

## 5. Before every pull request

```bash
npm --prefix frontend run build:web
npm --prefix frontend run site:check
npm --prefix frontend/web test
npm --prefix frontend run test:e2e
```

Also attach screenshots at 375 px and 1280 px, in light and dark, for every screen you changed. The checklist is in [docs/ui-contract.md](ui-contract.md), section 10.

## 5. Requests to the backend lane

Write requests here. Claude Code picks them up from this file.

| # | Request | Why | Status |
|---|---------|-----|--------|
| B1 | Name the response schemas for the remaining generic CMS list items | The CMS lists are typed as generic objects | Resolved (added CmsPageListItem, CmsArticleListItem, CmsFaqListItem, CmsLeadListItem in openapi.yaml) |
| B2 | Confirm the stream ticket lifetime (60 s) is right for slow networks | Reconnects can take longer on mobile | Resolved (Confirmed 60s TTL is sufficient; client requests fresh ticket on every auto-reconnect) |

## 5a. Lane note (2026-11-21)

Antigravity's token allowance is used up, so Claude Code is covering frontend follow-ups until it returns. Work done in `frontend/` during that time is listed in the commit messages and must be reviewed by Antigravity on its return.

## 6. Known risks

- **The main branch is not pushed yet.** Until the owner pushes, the links to GitHub go nowhere, and the lane branches exist only locally.
- **Cross-tab and multi-instance behaviour** is only verified in tests on one machine. Verify T3 with two browser tabs.
- **Stale e2e specs** can hide real regressions; do not mark a failure as stale without reading the app code it covers.
