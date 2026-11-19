# Handoff: bot screens and browser tests (frontend lane)

**From:** Claude Code (backend lane) · **Date:** 2026-11-18 · **For:** Antigravity (frontend lane)

## What the backend provides (no action needed)

- Bot API and approvals (`contracts/openapi.yaml`, v1.1.0): `GET /v1/agents`, `POST /v1/agents/{id}/messages`, `GET /v1/approvals`, `GET /v1/approvals/{id}`, `POST /v1/approvals/{id}/decision`. Field names are snake_case.
- Four bots: `universal-finance-agent`, `approval-agent`, `ledger-invariant-checker`, `approval-reminder`.
- A real sign-in endpoint on the core API: `POST /v1/auth/login` returns a `<tenant>.<random>` token.
- The live approve path has been verified over the API: propose, approve with the payload hash, the ledger posts, the invariant check passes.

## What I changed in `frontend/` (please review)

Since the frontend lane owns these, I made the changes at the owner's request while the frontend lane was paused. Please review them and keep, adjust or replace as you see fit.

- `frontend/web/src/lib/uaap-client.ts`: client for the UAAP endpoints. Errors become `UaapError`, and nothing falls back to sample data.
- `frontend/web/src/lib/auth-client.ts` and `frontend/web/src/modules/auth/SignInForm.tsx`: real email and password sign-in, token kept in memory only. Linked from the signed-out screen as "Sign in with your workspace account".
- `frontend/web/src/modules/approvals/ApprovalsInbox.tsx`: now loads from UAAP. Approve and reject send the decision and show a change only after the API confirms it. The bot on/off switch shows a message instead of changing anything.
- `frontend/web/src/modules/approvals/AgentCards.tsx`: one `BotCard` per bot the API lists.
- `frontend/web/src/App.tsx`: the sign-in link and form, shown alongside the existing demo buttons.
- `frontend/web/.env.example`: `VITE_API_URL` and `VITE_UAAP_URL`.
- `frontend/e2e/specs/approvals-inbox.spec.ts` and `approvals-live.spec.ts`: rewritten for the live behaviour.

## Open browser test results (as of 2026-11-18)

- **Desktop Chrome:** the most recent run passed 3 of 6. Failing: the "API Connected" label timing out, the owner's Approve click timing out, and one message check in the inbox spec.
- **Mobile Safari (375px):** most tests still fail. On the phone layout the Sign out button and the navigation are hidden behind the menu. The tests now use `#signed-out` and open the menu, but the inbox and live specs still fail.
- Some failures look like timing on a slow machine; some may be real. Please check against the screenshots in `frontend/e2e/test-results/`.

## Requests

1. **Stabilise the browser tests.** Prefer waiting on real state (for example a response from the API) over fixed delays.
2. **Mobile layout.** Make the sign-in screen, the menu and the inbox work at 375px, with no horizontal scroll (`docs/ui-contract.md` section 3).
3. **Review the sign-in form** against the UI contract: labels, focus order, error wording and the status line.
4. **Remaining mock data** (sidebar bots, other modules) is outside this change. Please replace it module by module, from the API only.

## Rules for this handoff

- Do not change `services/uaap` or `backend/`. If you need a field, open an issue against `contracts/openapi.yaml` (contract changes go through their own pull request).
- The local test stack (test tenant, stand-in model, `backend/.live-env`) is for local runs only. Do not commit credentials.
