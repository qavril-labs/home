# UAAP Security & Tenancy Specification

**Milestone:** A1 · **Status:** Proposed · Spec only.

## 1. Tenant identity propagation
1. Client presents the product session token (`<tenantId>.<random>`; only SHA-256 stored server-side, per `packages/identity`).
2. UAAP extracts `tenantId` from the prefix **only to route validation**; it then calls the issuing product's `/v1/me` (core: `GET /v1/me`) and trusts the returned principal, not the prefix.
3. UAAP opens each DB transaction with `SET LOCAL app.tenant_id = <uuid>`; every UAAP table has `tenant_id` + `FORCE ROW LEVEL SECURITY` using the same policy text as `0001_foundation.sql`.
4. Background runs store `tenant_id` and `initiated_by` on the run; workers re-set tenant context before every step. A run without tenant context cannot start.
5. Suspended tenants (`status != ACTIVE`) fail closed.

## 2. Agent identity & authorization
- Each registered agent version has a service principal `agent:<agent_id>` with explicit **grants** (permission strings in the existing `fin.journal.post` style, plus new `ai.*` namespace).
- **Effective permission = agent grants ∩ invoking user permissions** (users with `*` do not give agents `*`).
- Products must treat agent calls as authenticated API calls carrying the user's token plus `X-Acting-Agent: <agentId>`; products that support it record `actor_type=AI_AGENT` (core change request CR-1 below).

## 3. Five-tier engine (code-enforced)

| Tier | Meaning | Executor behaviour | Default examples |
|---|---|---|---|
| 1 Read-only | No side effects | Run immediately | `GET` reports, balances |
| 2 Draft | Creates non-binding drafts | Run; output flagged `is_ai_draft` | draft invoice/PO text |
| 3 Approval | Binding or sensitive | Create `approval_request`, run pauses (`WAITING_APPROVAL`); executes only after an approver **different from the initiator** approves; approval is single-use, bound to a hash of the exact payload | payments, POs, lease actions, refunds, payroll, tenant-sensitive |
| 4 Operational write | Low-risk, reversible, schema-validated | Run with audit | log DPR note, create ticket |
| 5 Restricted | Never agent-executable | No executor registered; call returns `TOOL_BLOCKED` and is audited | raw SQL, ledger update/delete, role elevation, migrations, DB file access |

Rules: unknown tool = Tier 5. A tool's tier is declared in its registered definition and can only be **raised** per-tenant, never lowered. Financial transaction, payment, payroll, PO, destructive and tenant-sensitive tools are Tier ≥3 by catalogue rule.

## 4. Tool call pipeline
`validate JSON-Schema → resolve principal & grants → tier check → quota/rate check → idempotency key check → (approval gate) → adapter call with timeout → response schema validation → audit append → trace span`. Failure at any stage returns a typed error and an audit row.

## 5. Audit & observability
- Every tool call, approval decision, model call and run state change appends to an append-only `uaap.audit_events` (UPDATE/DELETE rejected by trigger, same pattern as `reject_audit_mutation`).
- Fields: tenant, run, step, agent+version, model, `prompt_hash` (not raw prompts by default), tool, tier, request id, outcome, latency, tokens.
- Raw prompt/response storage is **off by default**, opt-in per tenant with retention limit (PII).

## 6. Secrets
Environment/secret-store only; startup fails if a secret appears in a config file in the repo. Logs pass through a redaction filter (keys, bearer tokens, `password`, card/ID patterns). Frontends never receive provider credentials. **No Ollama credential is added, changed or rotated without asking the user.**

## 7. Prompt-injection & data handling
Tool outputs and retrieved documents are untrusted data: wrapped in delimiters, never allowed to alter the tier engine, grants, or system policy. Retrieval filters on `tenant_id` in SQL (RLS), not in the prompt. Keyword filters (as in Construction `copilot.controller.js`) are a supplement only. PII redaction pre-model for payment-card and national-ID patterns.

## 8. Limits
Per-tenant: requests/min, concurrent runs, daily token budget, max steps per run, max tool calls per run, max run wall-clock, retry cap (default 3, exponential backoff). Exceeding returns `RATE_LIMITED`/`QUOTA_EXCEEDED`.

## 9. Findings in the existing estate that affect this spec
| # | Finding | Severity | Action (not taken in A1) |
|---|---|---|---|
| S1 | Core `audit_log` has `actor_id uuid` but no actor type; agents indistinguishable | High | CR-1: add `actor_type`/`acting_agent` columns — separate approval |
| S2 | `BUILT_IN_ROLES` are placeholders; no `ai.*` permissions; no agent principals | High | CR-2 |
| S3 | Outbox dispatcher exists but no worker runs; `outbox_events` has no RLS (system table) | High | CR-3 (A6); restrict worker role |
| S4 | Core API: no general rate limiting, CORS only for leads route | Medium | CR-4 before exposing UAAP-adjacent routes |
| S5 | Construction `ai.service.js` returns fabricated success on model failure | High | Do not reuse; adapter must surface failures |
| S6 | Construction copilot guardrails are substring lists | Medium | Don't rely on; gateway-level controls |
| S7 | Credential-bearing files exist on disk: `.env` files in many Port projects (contents **not** read), `E:\Port\Property Management System\TENANT_CREDENTIALS.csv` (66 KB), `E:\apiKey.txt` | High | Owner review/rotation; keep out of any UAAP path; not touched |
| S8 | Construction backend `.env` reportedly holds a production DB host (per its own docs); guard blocks it | Medium | Owner to correct; UAAP never reads it |
| S9 | `E:\SaaS` has no git repo → no change history/rollback for A-series work | Medium | Recommend `git init` (needs authorization) |
| S10 | Core DB integration tests not runnable here (no `TEST_DATABASE_URL`), so RLS behaviour is **unverified on this machine** | Medium | Needed before A2 DB work |

## 10. Core change requests (require separate approval; none made)
CR-1 audit actor type · CR-2 `ai.*` permissions + service principals · CR-3 outbox worker + restricted DB role · CR-4 API rate limiting/CORS · CR-5 approval record support for payload-hash binding.

