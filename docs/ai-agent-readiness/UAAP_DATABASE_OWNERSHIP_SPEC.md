# UAAP Database Ownership & Migration Specification

**Milestone:** A1 · **Status:** Proposed · No migration written or run.

## 1. Ownership map

| Data store | Owner | UAAP access |
|---|---|---|
| Core SaaS PostgreSQL (`tenants`, `users`, `ledger_*`, `audit_log`, `outbox_events`…) | Core SaaS (`packages/db`) | **None direct.** Via Core HTTP API; outbox via signed webhook |
| PMS Supabase PostgreSQL | PMS | **None direct.** API/RPC only |
| Construction SQLite in `E:\Port\Construction\_sqlite_work\` | Construction ERP | **None.** Express API only. Policy untouched |
| Other product DBs (POS, Restaurant, HelpDesk, VMS…) | Each product | None direct |
| **UAAP PostgreSQL schema `uaap`** | UAAP | Full (role `uaap_app`) |
| Redis (A3) | UAAP | Working memory, locks, rate counters (TTL only; no source of truth) |

## 2. Hosting decision (needs user choice)
- **Option A (recommended):** separate database `uaap` on the same PostgreSQL server → strongest ownership separation, independent backup/restore.
- Option B: schema `uaap` inside the core database → simpler, but shares blast radius with the ledger.
- Either way: `uaap_app` is non-superuser, no `BYPASSRLS`, no grants on core schemas; `uaap_owner` runs migrations. Prerequisite: a working local Postgres with create-DB rights (currently unverified on this machine).
- pgvector availability on the target server is **unverified**; fallback is a documented no-vector mode (keyword retrieval) until confirmed.

## 3. Planned tables (all `tenant_id uuid NOT NULL` + RLS unless noted)

| Table | Purpose | Notes |
|---|---|---|
| `agents`, `agent_versions` | Registry; immutable versions (prompt ref, model policy, tool grants) | version rows append-only |
| `tool_definitions` | Name, product, JSON-Schemas, tier, endpoint ref, idempotency policy | global (no tenant) + `tenant_tool_overrides` (tier may only increase) |
| `tool_grants` | agent_version ↔ tool permissions | |
| `runs`, `run_steps` | Execution state/history | status enum incl. `WAITING_APPROVAL` |
| `checkpoints*` | LangGraph Postgres checkpointer tables | library-managed; tenant key stored in `thread_id` prefix + wrapper table for RLS — design validated in A3 |
| `approvals` | Requests/decisions, payload hash, approver ≠ initiator constraint, expiry | decisions append-only |
| `model_usage` | Per call tokens, model, provider, latency, cost estimate | append-only |
| `tenant_quotas` | Limits per tenant/product | |
| `memory_items`, `kb_documents`, `kb_chunks` | Long-term memory/RAG (`vector` column if pgvector) | embedding model id stored per row |
| `integration_registrations` | Product ↔ tenant connection (base URL ref, auth mode ref — **no secrets**) | secret refs only |
| `event_inbox` | Received events with `(consumer,event_id)` unique for idempotency | |
| `notification_log` | Outbound email/WhatsApp attempts and outcomes | |
| `audit_events` | Append-only audit (trigger-enforced) | |

## 4. Migration policy
1. Alembic in `services/uaap/migrations`, version table `uaap.alembic_version`; never touches core `packages/db/migrations`.
2. Forward-only in staging/production; destructive operations (DROP/TRUNCATE/column removal) require explicit approval and a verified backup.
3. Every migration runs first against a disposable database in CI, including a fresh-install check and an RLS cross-tenant test.
4. No application startup migration (matches Construction rule 4 and `DATABASE_MANIFEST.md` practice).
5. Backups: nightly logical dump + tested restore (procedure documented in A2); retention for `audit_events` ≥ product retention policy.
6. Construction SQLite files: out of scope; no UAAP tooling may open them.

## 5. Retention
Run steps 90 days default (configurable), model_usage 13 months, audit_events per tenant policy (default 7 years financial / 1 year other), raw prompts off by default.

