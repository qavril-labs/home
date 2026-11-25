# HRMS API reconciliation: decision needed

Status: open. Written 2026-11-25 after `main` picked up PR #10 (`feat/hrms`, Antigravity screens) and commit `83f4cd6` (backend HRMS routes wired to Neon).

## What exists on each branch

| Where | Prefix | Surface | Gate |
|---|---|---|---|
| `main` (merged) | `/hrms/...` (no `/v1`) | 23 paths in `contracts/openapi.yaml` (lines ~628 to ~780), 45 routes in `backend/apps/api/src/hrms-routes.ts`, migration `0007_hrms.sql`, Antigravity screens in `frontend/web/src/pages/hrms/`, mocks still labelled "until contracts/openapi.yaml publishes /hrms/* paths" | none: `contract-drift.mjs` exists only on `chore/split-backend-frontend`, and it checks `/v1` routes only |
| `chore/split-backend-frontend` (commit `6d1ce88`, not pushed) | `/v1/hrms/...` | 74 operations marked `x-planned: true`, about 80 schemas, full design coverage (transitions, bank-account verification, reveals, settlement, loans, `me/*`) | drift gate skips planned operations |

## Why this needs a decision

1. **Prefix.** CLAUDE.md and the drift gate treat `/v1` as the contract surface. The merged `/hrms` routes sit outside it, so the gate never checks them.
2. **Names differ.** For example, `main` uses `/hrms/recruitment/applications`, `/hrms/payroll/runs`, `/hrms/separations`, `/hrms/leave/requests`. The planned contract uses `/v1/hrms/applications`, `/v1/hrms/pay-runs`, `/v1/hrms/exit-cases`, `/v1/hrms/leave-requests`. Actions also differ: `main` has `/approve`, `/send`, `/accept`, `/decision`, `/clear`, `/waive`; the planned contract uses one `POST .../transitions` endpoint per resource.
3. **Coverage.** The planned contract covers settlements, bank-account verification, sensitive-field reveals, loan transitions, clearance item patches and employee `me/*` routes. `main` covers fewer of these.
4. **Frontend.** The merged screens still run on mocks. Switching them to real routes is needed once one surface is chosen.

## Options

- **A. Keep `main`'s `/hrms` surface and extend it.** Least churn: the backend and screens already match. Add the missing operations under `/hrms` and document them in the contract. The gate would still need its prefix extended to `/hrms` to cover them.
- **B. Move to `/v1/hrms` (recommended).** One rename pass: `main`'s 23 paths and 45 routes move under `/v1`, then the planned contract (`6d1ce88`) is reconciled into it by operation name. The drift gate then covers all HRMS routes. Cost: one backend rename and one frontend mock update.
- **C. Replace `main`'s surface with the planned contract.** Largest change; drops code already merged.

Recommendation: **B**. It matches CLAUDE.md and the existing gate, and it is cheapest now, before the frontend goes live.

## Steps after the decision

1. Choose A, B or C.
2. Merge the chosen contract to `main`, or open a branch from `main` for it. The chore branch should not be merged whole: it also carries unrelated backend work.
3. Restore the drift gate on the branch that holds the routes, and rerun `backend/apps/api/test/contract.test.ts`.
4. Antigravity switches the mocks in `frontend/web/src/modules/hrms/mock-api.ts` to the chosen paths and regenerates the client.
5. Remove `x-planned` from each operation as its route ships.

## Outcome (2026-11-25)

The contract now uses `/v1/hrms` throughout.

- **Served:** 45 operations, one for each route in `hrms-routes.ts`. Parity holds (45 and 45).
- **Planned:** 38 further operations, marked `x-planned: true`, for resources or actions the backend does not serve yet. Names follow the served families where one exists (for example `/v1/hrms/recruitment/...`, `/v1/hrms/org/...`, `/v1/hrms/payroll/runs`, `/v1/hrms/separations`), so there is one surface.
- **Skipped as overlapping a served operation** (served operation kept): the planned list, employee detail, offers and pay-run transitions, clearance items, and the settlement transitions, where the served approve, accept, clear, waive and pay operations already cover the step.

Gaps still in the design but not in the contract:

- Requisitions: submit, reject, hold and cancel. The served route covers approve only.
- Offers: submit, approve, decline and expire. The served routes cover send, accept and withdraw.
- Pay runs: calculate and verify. The served routes cover approve, post and pay.

Those gaps are design decisions. Add them as planned operations when their routes are designed.

Also fixed: four operations in the committed contract declared `parameters:` twice, so the second block silently dropped the `id` path parameter. Merged into one block each.
