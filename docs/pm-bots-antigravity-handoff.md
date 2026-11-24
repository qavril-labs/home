# Project management bots: handoff to Antigravity

Catalog: PSA-01 (the bots depend on it), PLT-10, PLT-16. Full spec: [pm-bots-mvp-spec.md](pm-bots-mvp-spec.md).
Branch: `feat/pm-bots`. Backend lane is Claude Code. You build the screens against the contract.

## What you can rely on

- `contracts/openapi.yaml`, tag **PM Bots**: six endpoints and the schemas `PmBot`, `PmBotType`, `PmBotLogEntry`, `TriageSuggestion`, `StandupResponse`, `WeeklyReport`. Generate the client from it.
- Paths use the repo prefix `/v1/...`, not `/api/v1/...` as the pasted spec says.
- `contracts/events.md` section 5 lists the task and standup events. The UI does not consume them; they are listed for the "Blocked" status change (see below).
- Permissions: `pm.bots.configure`, `pm.bots.override`, `pm.bots.view_logs`. Built-in roles `project_manager` (all three) and `project_lead` (override). Hide or disable controls the signed-in user lacks permission for; the API also returns 403.

## Status of the backend

| Part | State |
|---|---|
| Decision logic for all five bots, 36 tests | Done (`backend/packages/pm-bots`) |
| Database tables with row-level security | Written (`0017_pm_bots.sql`), not yet run against Postgres |
| The six HTTP routes in the contract | **Not built.** The contract is the agreed shape; calls will fail until the routes land |
| Project and task tables (PSA-01) | **Not built.** There is no task or project screen to attach the bot UI to yet |

Build against the contract with mocks. Do not assume the routes respond.

## Screens

1. **Project Settings, Bots tab.** Five cards from `GET /v1/projects/{projectId}/bots`. Each has an enable switch and a config form, saved with `PUT .../bots/{botType}` (needs `pm.bots.configure`). Show a non-blocking warning when `deadLetterWarning` is true. A "Logs" drawer per bot from `.../logs` (needs `pm.bots.view_logs`), cursor paged.
   Config keys per bot:
   - deadline_reminder: thresholds (default 48h, 24h, overdue), quiet hours, channels, urgentOverdue.
   - blocker_escalation: slaHours (default 24), escalation owner, repeat escalation (every 24 working hours, max 3).
   - intake_triage: auto-apply confidence (default 0.80), cross-project duplicates on or off.
   - daily_standup: time and timezone, Monday to Friday, cutoff minutes (default 45), channel.
   - weekly_report: day and time, recipients (channel and emails), auto-send or draft for PM review.
2. **Blocker Reason modal.** Shown when a task moves to Blocked. Reason is required, 5 or more characters after trimming, with an optional "blocked by" user. Validate on the client too; the server answers 400 `VALIDATION`.
3. **Triage badge on a task.** Shows a pending suggestion (category, priority, team, confidence) and a possible-duplicate link. One click to Accept or Override via `POST /v1/tasks/{taskId}/triage/resolve` (needs `pm.bots.override`). 404 means nothing pending. 409 means someone already resolved it. A possible duplicate never closes the task.
4. **Standup check-in drawer.** Yesterday, Today, Blockers, and a "No blockers, on track" button, sent with `POST /v1/projects/{projectId}/standup/respond`. Editing resubmits the same endpoint; there is one row per person per day. Show `late` when true.
5. **Weekly report preview and approval.** Show `summary` counts, `overduePct` and health (green, amber, red). A draft has an Approve button that calls `POST .../reports/{reportId}/approve` (needs `pm.bots.override`). 409 means it is no longer a draft.

## Rules for every screen

Follow `docs/ui-contract.md`. Every figure comes from the API, never computed in the browser. Check 375px and 1280px in light and dark, and add end-to-end tests under `frontend/e2e/`.

## Open questions for you

- The task and project screens do not exist, so decide where the Blocker modal, triage badge and standup drawer attach. Say so if that needs a backend change.
- Tell Claude Code if any field in the contract is missing or wrongly shaped. Contract changes go through the backend lane and you review them.
