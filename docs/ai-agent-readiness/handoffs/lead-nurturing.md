# Handoff: B8 Lead Nurturing (screens and browser tests)

**From:** Claude Code (backend lane) · **Date:** 2026-11-23 · **For:** Antigravity (frontend lane)
**Code:** `qavril-labs/uaap` branch `feat/portable-bots` (bot `src/uaap/agents/lead_nurturing.py`, not yet committed or pushed) and this repository (`backend/apps/api/src/platform-leads-routes.ts`, migration `0016_lead_followup_drafts.sql`, `contracts/openapi.yaml`; not yet committed).

## What the bot is

A deterministic bot (no model). Agent id `lead-nurturing`. It lists marketing leads that need a follow-up and, on request, proposes a follow-up draft that is saved only after a different person approves it. It never sends anything (sending needs PLT-10).

## Who can use it

Marketing leads are platform data, not tenant data. Only users of the platform workspace (the tenant named by `PLATFORM_TENANT_ID` on the API) who hold `platform.leads.read` (and `platform.leads.draft` to propose a draft) can use it. Every other tenant, including its admins, gets 403. With `PLATFORM_TENANT_ID` unset, everyone gets 403. The built-in role `platform_operator` grants `platform.*`.

`GET /v1/agents` lists `lead-nurturing` only to callers who hold `platform.leads.read` or `platform.leads.draft`. That includes any tenant admin (they hold `*`), so an admin of an ordinary tenant can still see the card; if they use it, the service returns the standard FORBIDDEN reply ("only available to people in the platform workspace"). Show that reply as is. A later change can hide the card by tenant once UAAP knows which tenant is the platform workspace.

## API operations

- `POST /v1/agents/lead-nurturing/messages` (the usual bot endpoint; `GET /v1/agents` lists it).
  - "Which leads need a follow-up?" returns `data.findings`: `[{lead_id, level: urgent | due | quiet, days}]`. The text also lists leads without consent under "Not to be contacted".
  - "Draft a follow-up for lead `<lead id>`" returns `status: "awaiting_approval"` with `approval`, as for the Finance Agent. Approve through `POST /v1/approvals/{id}/decision` with the payload hash.
- Core API (used by the bot; the screen may also show saved drafts later): `GET /v1/platform/leads`, `POST /v1/platform/leads/{id}/followup-drafts` (see `contracts/openapi.yaml`).

## Rules the screen must reflect

- Urgent: no follow-up yet and waiting seven days or more. Due: two days or more. Quiet: a draft or contact exists and seven days have passed since.
- A lead with no recorded consent is never flagged and never drafted for. Show those in a separate "Do not contact" list, with no draft button.
- Booked and closed leads are not listed.
- Contact details (email) are never in bot replies. If the screen shows an email, take it from `GET /v1/platform/leads`, not the bot text.

## Statuses and errors

| Case | `status` | Show |
|---|---|---|
| Nothing to do | `answered` | "No lead needs a follow-up right now." |
| Leads listed | `answered` | Findings by level, and the do-not-contact list |
| Draft proposed | `awaiting_approval` | The approval summary; the draft text is in `approval.proposed_payload.arguments` |
| Draft for a lead without consent | `refused` | The reply text |
| Unknown lead id | `needs_clarification` | Ask for an id from the list |
| Outside the platform workspace | `failed` (FORBIDDEN) | The reply text |
| Approved | `answered` | "Saved for review. Nothing was sent." |

The approver must be a different person from the requester; the service enforces this.

## Draft wording

Fixed text filled only with the lead's own details (first name, company, interest). The approval screen must show the subject and body exactly as proposed.

## Open items

- No catalog product id exists for this bot (`ERP-Product-Catalog.md` has no row); entitlement is unassigned until F3.
- Sending a draft needs the notification provider (PLT-10). Until then drafts are text to copy.
- The contract changed (two new paths, one schema), so Antigravity must review it. The migration, route and its API tests were written but could not be run on the machine used (no Postgres test database); run them before merging.
