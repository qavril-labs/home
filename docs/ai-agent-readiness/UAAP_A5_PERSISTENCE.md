# UAAP A5 (part 1): live models, bot API, approvals inbox, Neon persistence

**Date:** 2026-11-10 · **Decisions (user, 2026-11-10):** in-app approvals inbox; Neon for UAAP's database; live models allowed with a key the user sets.

## 1. Live models

The A2 "fake provider only" guard is lifted. `UAAP_PROVIDER_MODE=live` now starts only when all three of these are set:
- `UAAP_OLLAMA_API_KEY`
- an `https` value for `UAAP_OLLAMA_BASE_URL`
- `UAAP_LIVE_MODELS`: a comma-separated list of model ids, cheapest first

`env=production` is still refused. The key is read from the environment only (ADR-009); Claude never handles it. Model ids are not verified until the first live call.

## 2. Bot API and approvals inbox

| Endpoint | Purpose |
|---|---|
| `GET /v1/agents` | Agents, use cases and out-of-scope items |
| `POST /v1/agents/{id}/messages` | `{message, company_id, today}`; returns status, text, approval, error code and guardrail events |
| `GET /v1/approvals?status=PENDING` | The tenant's inbox; `can_decide` is false for the initiator |
| `GET /v1/approvals/{id}` | The exact payload and `payload_hash` to review |
| `POST /v1/approvals/{id}/decision` | `{decision: approve, payload_hash}` or `{decision: reject, reason}` |

Identity always comes from Core SaaS `/v1/me`. The single-use approval token stays on the server and is never returned by any endpoint. Approving requires all of the following:
- a signed-in user who is not the initiator;
- a matching `payload_hash` for the payload the approver reviewed;
- the approver's own permission for the tool.

A refused attempt (initiator, wrong hash) leaves the proposal open. A decided proposal cannot be decided again (HTTP 409). Proposals expire after `UAAP_APPROVAL_TTL_SECONDS` (default 24 hours).

## 3. Neon database

| Item | Value |
|---|---|
| Neon project | `uaap` (`orange-night-84837670`), AWS ap-southeast-1, Postgres 18 |
| Database / schema | `uaap` / `uaap` |
| Owner (migrations only) | `uaap_owner` |
| Service login | `uaap_service`, member of `uaap_app`; not superuser, no `BYPASSRLS` |
| Migrations | `python -m uaap.db.migrate` with `UAAP_DATABASE_OWNER_URL`; version and checksum in `uaap.schema_migrations` |

**Decision:** ADR-013 named Alembic. Plain SQL files with a version table were used instead, matching the core `packages/db` runner and avoiding a dependency. Edited migrations are refused by checksum.

What `0001_uaap_core` creates:
- **`uaap.audit_events`:** append-only. A trigger rejects UPDATE, DELETE and TRUNCATE. Prompts, arguments and tokens are stored only as hashes.
- **`uaap.approvals`:** inbox history. A database check enforces `decided_by <> initiator_id`.
- **Forced row-level security** on both tables, keyed by `app.tenant_id` as in core. System and admin events (no tenant) can be written but are never readable by a tenant.
- **Least-privilege grants:** the service role can insert audit rows but not update or delete them, and has no DDL rights.

Writes go through a background writer, so requests never wait on Neon. Failures and drops are counted and shown in the admin console under "Durable writes".

**Local secrets.** `services/uaap/.dev-env` and `.dev-admin-key` are git-ignored, and `scripts/run_dev.py` loads them. Real environment variables take precedence.

## 4. Verification (2026-11-10)

- 204 tests pass, including 3 against Neon run as `uaap_service`:
  - the schema version is current and row-level security is forced;
  - audit and approval rows are durable, and another tenant sees none of them;
  - DELETE is refused, and so is writing a row for another tenant.
- ruff and strict mypy are clean, and 5 of 5 import contracts are kept.
- The integration tests run only when `UAAP_TEST_DATABASE_URL` is set. Their audit rows stay in the database because audit is append-only.

## 5. Part 2: full durability (2026-11-11)

Migration `0002_uaap_state` adds:
- **`uaap.state`:** durable storage for run checkpoints, approval-engine records and idempotency results;
- **`uaap.agent_metric_events`:** one row per agent reply or approval decision;
- **`uaap.agent_metrics_summary()`:** a `SECURITY DEFINER` function that returns totals across tenants without exposing any tenant's rows.

All new tables force row-level security.

**Approval tokens** are now `HMAC-SHA256(UAAP_APPROVAL_TOKEN_SECRET, tenant|approval_id)`. No token is stored anywhere, and a pending approval can still be decided after a restart. The secret is required whenever a database is configured.

**Behaviour.** Stores read memory first and fall back to Postgres. Writes reach Postgres before the call returns. Audit and metric rows go through the background writer.

## 6. A5 sign-off (2026-11-11)

| Check | Result |
|---|---|
| Full suite, including 5 Neon tests | 206 passed |
| Restart survival | Proposed in one process, approved in a second, refused in a third. Posted once. No raw token stored. Metrics summary includes both the request and the approval. |
| Idempotent replay across a restart | Replayed without calling the product |
| Row-level security | Forced on all four UAAP tables; another tenant sees nothing |
| ruff, mypy strict, import contracts | Clean, clean, 5 of 5 kept |

**Remaining limits:**
- **Single instance only.** Per-run tool budgets, model rate limits and the double-decision guard are per process. Scaling out needs Redis or a database lock (A6).
- **No live model call yet.** That waits for your key.
- **Core SaaS is not connected in dev.**
