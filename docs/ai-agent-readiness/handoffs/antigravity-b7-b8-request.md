# Request to Antigravity: two new bots (B7 Document Intelligence, B8 Lead Nurturing)

**From:** Claude Code (backend lane) · **Date:** 2026-11-24 · **For:** Antigravity (frontend lane)

Nothing here is committed or pushed yet. Treat this as the brief; the branches below are what to review once they are.

## 1. Review (contract)

`contracts/openapi.yaml` changed (additions only, plus one description sentence):

- New paths `GET /v1/platform/leads` and `POST /v1/platform/leads/{id}/followup-drafts`, and schema `PlatformLead`.
- `GET /v1/agents` description: a bot that needs permissions is listed only to callers holding at least one of them.

Please confirm the generated client still builds. No existing field changed.

## 2. Build (screens, from the generated client)

| Bot | Screen work | Notes |
|---|---|---|
| `document-intelligence` | Paste box (limit 4000 characters, show a counter), result table, readiness banner (READY, PARTIAL, BLOCKED), lists of `missing` and `problems` | Read-only; no approval, no save button. Amounts are decimal strings: do not convert them. Details: `document-intelligence.md` |
| `lead-nurturing` | Findings list (urgent, due, quiet) and a "Do not contact" list; "Draft follow-up" button that sends the request and shows the approval | Approval uses the existing inbox. Details: `lead-nurturing.md` |

Both appear on the bot cards automatically (`AgentCards.tsx` loads `GET /v1/agents`). Add colours for the two ids in `BOT_COLORS`; they fall back to lime today.

## 3. Test (6b, Playwright)

- B7: clean invoice shows READY; missing currency shows `missing`; a wrong line amount shows the failed check; unrelated text shows BLOCKED.
- B8: platform user sees the card and the findings; a draft proposal reaches the inbox and a second user approves it; an ordinary tenant user gets the FORBIDDEN reply and no draft.

## 4. Things to know

- **Who sees Lead Nurturing:** any tenant admin also sees the card (they hold `*`), but the service refuses them. Show its message as is. Hiding the card by tenant is a later change.
- **Drafts are text only.** Nothing is sent until the notification provider (PLT-10) exists. Do not add a "Send" button.
- **Test data:** B8 needs `PLATFORM_TENANT_ID` set on the API to a tenant, a user in it with the `platform_operator` role, a second user for approval, and a few rows in `leads`. This is for local runs only; do not commit credentials.
- **Not running yet:** the bots live in `qavril-labs/uaap` on an uncommitted branch, so the UAAP service your `VITE_UAAP_URL` points to will not list them until that branch is merged and deployed. The core API routes and migration `0016` also need to be applied, and the API tests for them (`platform-leads.test.ts`) have not been run on the machine used (no Postgres test database).
- **No catalog product id** exists for either bot yet.
