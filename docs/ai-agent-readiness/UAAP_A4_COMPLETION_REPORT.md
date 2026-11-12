# UAAP Milestone A4 Completion Report: Tool Registry & Execution Boundary

**Date:** 2026-11-09 · **Plan:** [UAAP_A4_IMPLEMENTATION_PLAN.md](UAAP_A4_IMPLEMENTATION_PLAN.md) · **Version:** `uaap 0.1.0a4`

## 1. What now exists

Agents can call product tools through one code path, `ToolExecutor.execute`, in `services/uaap/src/uaap/tools/executor.py`. Each stage below either passes or raises a typed error and writes an audit event:

1. **Lookup and tier.** Unknown tools and Tier 5 tools return `TOOL_BLOCKED`. Tier 5 definitions cannot have an executor; the registry refuses one at registration.
2. **Agent principal.** The call needs a registered, enabled agent (`agent:<id>`), and the tool must be on that agent's allow-list. `AgentRegistry.disable` is the kill switch. No agent can be granted `*`.
3. **Input contract.** Arguments are checked against the tool's JSON Schema (Draft 2020-12). Schemas are checked when the tool is registered.
4. **Effective permission.** The agent's grants and the user's permissions must both allow the tool's permission (ADR-006). A user with `*` does not widen the agent.
5. **Per-run budget.** Each run gets `max_tool_calls_per_run` tool calls (default 20). Past that, calls return `QUOTA_EXCEEDED`.
6. **Idempotency.** A repeated key with the same arguments replays the stored result without calling the product. The same key with different arguments returns `IDEMPOTENCY_CONFLICT`.
7. **Approval gate.** A Tier 3 call without an approval returns `APPROVAL_REQUIRED`. With an approval, the executor checks the tenant, the run, the status, the tool name and the payload hash. The call must run as the approver, and each approval can execute only once.
8. **Handler.** The handler runs with a timeout. Timeouts, crashes and product errors become `UPSTREAM_TIMEOUT` or `UPSTREAM_FAILED`. No fabricated results are returned (ADR-012).
9. **Output contract.** A response that fails the tool's output schema returns `UPSTREAM_INVALID_RESPONSE`.

Audit events record the tool, tier, agent, run, approval, outcome, latency and a hash of the arguments. They never record raw arguments or tokens.

## 2. First product adapter: Core SaaS (PRD-ERP-17)

The adapter is `uaap/tools/adapters/core_saas.py`. It talks only to the real `apps/api` routes:

| Tool | Endpoint | Tier | Permission |
|---|---|---|---|
| `ledger_get_trial_balance` | `GET /v1/ledger/trial-balance` | 1 | `fin.report.read` |
| `ledger_create_account` | `POST /v1/ledger/accounts` | 3 | `fin.accounts.write` |
| `ledger_post_journal_entry` | `POST /v1/ledger/journal-entries` | 3 | `fin.journal.post` |
| `ledger_reverse_journal_entry` | `POST /v1/ledger/journal-entries/{id}/reverse` | 3 | `fin.journal.post` |

Blocked (Tier 5, no executor): `sql_execute_raw`, `ledger_update_entry`, `ledger_delete_entry`, `audit_log_modify`, `identity_elevate_role`, `db_run_migration`.

- **Caller identity.** The caller is resolved through `GET /v1/me` (ADR-005). UAAP does not trust headers or the token prefix for identity. A token from another tenant is refused.
- **Headers.** Every product call carries the user's bearer token, `X-Request-ID` and `X-Acting-Agent`.
- **Amounts.** Amounts must be positive decimal strings with at most four decimal places. Zero, negative, exponent and numeric (JSON number) amounts are rejected before the product is called.
- **Errors.** Product errors map to UAAP codes. Only the product's error code is kept, never its message body.

## 3. Runtime and API

- `AgentRunner.create_run(agent_id=…)` stores the agent on the run. A tool `pending_action` is reduced to `tool_name`, `arguments` and `idempotency_key`, so any `risk_tier` the client sends is dropped and the registry decides the tier.
- `start_run(caller=…)` runs the tool. Only the run's initiator, in the run's tenant, can start it. A Tier 3 call suspends the run, and its approval is bound to the exact call (name, arguments and idempotency key).
- `resume_after_approval(approver=…)` checks the approver's credentials before the approval token is consumed. It then runs the call once, as the approver. If the tool fails, the run ends `FAILED` with the error code.
- Tokens are held in memory only; tests confirm they never appear in checkpoints.
- `GET /v1/tools` lists each tool with its tenant-effective tier, its blocked state and whether the caller holds its permission.
- New error codes and their HTTP statuses: `TOOL_BLOCKED` 403, `APPROVAL_REQUIRED` 409, `IDEMPOTENCY_CONFLICT` 409, `CONFLICT` 409, `APPROVAL_ALREADY_CONSUMED` 409, `APPROVAL_EXPIRED` 410. The last two existed in A3 but mapped to 500.

## 4. Verification (run on 2026-11-09)

| Check | Result |
|---|---|
| `pytest` | 142 passed (77 from A1–A3 plus 65 new) |
| `ruff check .` | All checks passed |
| `mypy` (strict) | No issues in 68 files |
| `lint-imports` | 3 of 4 contracts kept. The broken one existed before A4 (see section 5). |

The Core SaaS adapter was tested against a fake that mirrors the `apps/api` routes, auth and error envelope. It was **not** run against a live Core SaaS server with Postgres.

## 5. Known gaps

- **Pre-existing contract break (A2).** `uaap.api.deps` and `uaap.api.routes` import `uaap.gateway.providers.ollama`, which breaks the A2 contract "API layer must not import concrete provider implementations". `import-linter` was not installed before, so this was never caught. A4 installed the declared dev dependency into `.venv` and left the A2 code unchanged.
- All state is in memory (registry overrides, idempotency keys, run budgets, executed approvals). Persistence arrives with the A5 database work.
- No HTTP endpoint creates or resumes runs yet; the runner is driven in-process.
- Core SaaS does not yet record `actor_type=AI_AGENT` from `X-Acting-Agent`. That is core change request CR-1.
- No named agent is registered in the service yet. The tests use a `finance-agent` principal.

## 6. Next

The next step is the first named agent, the Universal Finance Agent, built on these tools. It answers trial-balance questions at Tier 1 and proposes journal entries at Tier 3 for a person to approve.
