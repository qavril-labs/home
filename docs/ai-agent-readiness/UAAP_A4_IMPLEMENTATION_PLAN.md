# UAAP Milestone A4 Implementation Plan: Tool Registry & Execution Boundary

**Date:** 2026-11-09 · **Status:** Authorized by the user on 2026-11-09 ("A4 tool registry") · **Wave:** A

## 1. Goal

Give agents a single, code-enforced path to product data. After A4 an agent can call a registered tool; the tool runs only if the tier engine, the agent's grants, the invoking user's permissions, the input schema and the approval gate all allow it. Nothing else in UAAP can reach a product.

## 2. Scope

In scope:

1. `uaap.tools.types`: tool definitions, calls, results, caller context.
2. `uaap.tools.permissions`: the core wildcard rule (`*`, `fin.*`, exact), ported from `packages/identity/src/permissions.ts`, and the effective-permission rule (agent grants ∩ user permissions, ADR-006).
3. `uaap.tools.registry`: typed registry with JSON-Schema (Draft 2020-12) contracts checked at registration, Tier 5 definitions that cannot have an executor, unknown tools treated as Tier 5, and per-tenant tier overrides that can only raise a tier.
4. `uaap.tools.agents`: agent principals (`agent:<id>`) with explicit grants and an allow-list of tools.
5. `uaap.tools.idempotency`: per-tenant idempotency keys bound to a hash of the arguments.
6. `uaap.tools.executor`: the pipeline from the security spec, section 4: lookup → tier → agent → input schema → permissions → per-run limit → idempotency → approval gate → adapter call with timeout → output schema → audit.
7. `uaap.tools.adapters.core_saas`: the first product adapter (PRD-ERP-17, Core SaaS). It resolves the caller through `GET /v1/me` (ADR-005) and exposes four real ledger endpoints as tools. Tier 5 placeholders cover raw SQL, ledger update/delete, role elevation and migrations.
8. Runtime wiring: a run carries an `agent_id`; a pending action that names a tool goes through the executor, and the tier comes from the registry, never from the request. Tier 3 calls create an approval bound to the exact tool call, and resume executes that call once.
9. API: `GET /v1/tools` lists the tools visible to the caller with their tiers.

Out of scope (A5 and later): live model calls, database persistence, Alembic migrations, the outbox worker, product adapters other than Core SaaS, and named agents (the Universal Finance Agent is the first one after A4).

## 3. Core SaaS tools

| Tool | Endpoint | Tier | Product permission |
|---|---|---|---|
| `ledger_get_trial_balance` | `GET /v1/ledger/trial-balance` | 1 | `fin.report.read` |
| `ledger_create_account` | `POST /v1/ledger/accounts` | 3 | `fin.accounts.write` |
| `ledger_post_journal_entry` | `POST /v1/ledger/journal-entries` | 3 | `fin.journal.post` |
| `ledger_reverse_journal_entry` | `POST /v1/ledger/journal-entries/{id}/reverse` | 3 | `fin.journal.post` |

Amounts are decimal strings, as the core API accepts them (`Money.fromDecimal`), never numbers (ADR-011). Ledger writes are Tier 3 because the security spec makes financial tools Tier 3 or higher.

## 4. Decisions

- **Who executes after approval.** UAAP never stores the initiator's bearer token. After approval the tool runs with the approver's token, so the approver must hold the product permission as well as approve. The audit records both actors.
- **No retries on product writes.** Reads are not retried either in A4; a failed call returns a typed error (ADR-012, no fabricated fallbacks).
- **Error mapping.** Product HTTP status codes map to UAAP codes: 400 → `VALIDATION`, 401 → `UNAUTHENTICATED`, 403 → `FORBIDDEN`, 404 → `NOT_FOUND`, 409 → `CONFLICT`, 429 → `RATE_LIMITED`, 5xx → `UPSTREAM_FAILED`, timeout → `UPSTREAM_TIMEOUT`. Product response bodies are not copied into errors; only the product's error code is kept.

## 5. Test plan

Registry contracts, permission intersection (a user with `*` does not give an agent `*`), unknown and Tier 5 tools blocked and audited, schema rejection, tenant tier raise-only, idempotent replay and key reuse with different arguments, Tier 3 approval binding (payload hash, single execution, wrong tool), adapter error mapping and headers against a fake Core SaaS server, runtime runs that call tools end to end, and the `/v1/tools` endpoint. The A1–A3 suite must stay green.
