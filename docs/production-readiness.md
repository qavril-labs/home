# Production readiness: what is verified, what is not

This is an honest account of the three items behind "world class". Nothing here is an independent assessment. Each item says what was done, what it proves, and what is still missing.

## 1. Load testing

**Tool:** [backend/scripts/load-test.mjs](../backend/scripts/load-test.mjs). It signs up a fresh workspace, so it never touches an existing business's books. It measures requests per second, errors and latency (p50, p95, p99) for health, overview, insights and quick entries.

**Result: not yet valid.** The first run on this machine reported p95 latencies of 2 to 12 seconds, including on the trivial health check. The cause is CPU load, not the API: at the time of the run the machine was at 100% CPU, mostly from another application (Antigravity and its language server) and from browser test runs. Those numbers are not reported as results.

**What a valid run needs**
- An otherwise idle machine, or a separate server (the staging environment is the right place).
- The API built and run in production mode, not with `tsx watch`.
- PostgreSQL and Redis on their own resources, not shared with the test client.
- Run it with at least three levels of concurrency (for example 5, 20, 50) and record the table each time.

```bash
node backend/scripts/load-test.mjs https://api-staging.example 60 20
```

**Targets to judge the result against** (proposed, to be agreed): health p95 under 100 ms; overview and insights p95 under 500 ms at 20 concurrent users; quick entries p95 under 800 ms; zero 5xx errors at the target load.

## 2. Security self-check (not an independent review)

**Verified by automated tests** (run in the backend suite):

| Control | Evidence |
|---|---|
| Tenant data is separated by row-level security; the API connects as a role without superuser or BYPASSRLS | `erp_dev_app` setup in `dev:all`; tenant tests in `backend/apps/api/test/` |
| Sessions and tenant access are checked on every request | `authenticate` in `backend/apps/api/src/auth.ts` |
| Money writes cannot be posted twice by a retry | `idempotency-money.test.ts`, `idempotency.test.ts` |
| Live-stream tickets are single-use, expire after 60 seconds, and the session token is refused in a URL | `stream-ticket.test.ts` |
| The CMS admin key is compared in constant time | `cms-admin.test.ts` |
| Security headers on every response; signed-in responses are not cached | `ops.test.ts` |
| Request bodies are limited to 256 KB | `ops.test.ts` |
| Request logs do not record query strings | code in `backend/apps/api/src/app.ts` |
| The API contract matches the routes exactly | `contract.test.ts` |
| Production dependencies have no known vulnerabilities (backend and frontend) | `npm audit --omit=dev`, run on this date |

**Known gaps, not fixed**
- **Rate limit is per process.** Every `/v1` route allows 300 requests a minute per tenant and address (a forged token for another tenant only uses the sender's own allowance). The counters live in memory, so several API instances each keep their own; a shared store such as Redis is needed before scaling out.
- **Write routes check a permission; read routes mostly do not.** Writes need `sal.invoice.write`, `prc.bill.write`, `mdm.party.write`, `mdm.item.write`, `fin.accounts.write`, `prc.order.write`, `prc.receipt.write` or `prc.match.override`, and the built-in `accountant` role holds them through its `sal.*`, `prc.*`, `mdm.*` and `fin.*` grants (`write-permissions.test.ts`). Reads of invoices, bills, parties, items, orders and statements still only need a signed-in user, so the `user` role can read business data. Add read permissions before users with limited roles are onboarded.
- **No email verification or password reset.** The platform cannot recover an account that loses its password.
- **No two-factor authentication.**
- **The staging private key** (`qavril-staging-key.pem`) sits in the project root. It is git-ignored, but it should be moved out of the project and rotated if it has ever been shared.
- **CMS tables have no tenant column.** That is correct for platform content, and it is a deliberate exception to the tenant rule.
- **Live events are only tenant-filtered in the application.** The bus and stream both check the tenant, but this is not enforced by the database.
- **Audit log coverage:** ledger postings and reversals, quick entries, invoices (create, update, pay, delete), bills, purchase orders, receipts, match overrides, bank import, reconcile and unreconcile, and bank rules write an audit entry in the same transaction (`audit-coverage.test.ts`). Not yet covered: parties, items and accounts (master data), payment reminders, approval requests (they have their own agent log), CMS.

## 3. Real customers' books

**Not done, and cannot be done from this repository.** A run against real books needs:
- A consenting pilot customer, with a signed agreement that covers data handling.
- A copy of their data imported through a reviewed path, not typed in.
- A reconciliation: the platform's trial balance and reports must match the customer's own accounts for the same period, to the cent.
- Their accountant's sign-off on the reconciliation.

Until that exists, the platform should be described as **in pilot**, not as proven on real businesses.

## 4. Independent security review

**Not done.** It needs an outside firm or reviewer who did not build the system. Suggested scope: authentication and sessions, tenant isolation and row-level security, the money-posting paths, the stream and realtime bus, the CMS admin area, and the deployment configuration. Ask for a written report with severities and retest results.

## Summary

| Item | Status |
|---|---|
| Load testing | Script written; first run invalid because the test machine was saturated; a valid run needs an idle or staging server |
| Security self-check | Done for the controls listed above; gaps listed; not an independent review |
| Independent security review | Not done; needs an outside reviewer |
| Real customers' books | Not done; needs a consenting pilot and an accountant's reconciliation |

No part of this is called "world class" until the items above are complete.
