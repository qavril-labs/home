# UAAP A1 — Architecture Freeze & Decision Records

**Milestone:** Wave A / A1 · **Date:** 2026-11-05 · **Status:** PROPOSED FOR APPROVAL (frozen only once approved)
**Scope rule:** documentation only. No code, DB, infra or credential changes were made.

---

## 1. Repository baseline (verified by inspection)

| Item | Finding | Evidence |
|---|---|---|
| "Existing UAAP" repo | **None exists.** `E:\Port\Zyno Genie` is **VibeForge**, an AI *website/code generator* (18 agents: planner, generator, compiler, debugger…), not an ERP agent platform. | `Zyno Genie\system_architecture.md` line 25; `graph\workflow.py` imports |
| Reusable from Zyno Genie | LangGraph `StateGraph` wiring pattern; `AsyncPostgresSaver` checkpointer approach (documented in `FIXES_APPLIED.md`); `tenacity` retry usage; `safety_guard.py`; per-agent `models.yaml`/`limits.yaml` config idea | `graph/`, `configs/`, `requirements.txt` |
| Not reusable | Gemini/Groq-bound model config (no Ollama); code-gen agents; Django side app (`db.sqlite3`); no tenant model; no tool/permission layer | `configs/models.yaml` |
| Core SaaS building blocks | Identity (scrypt, hashed tenant-prefixed sessions, wildcard permissions), tenancy + RLS (`app.tenant_id`), append-only `audit_log`, outbox + `OutboxDispatcher` (lease/retry/dead-letter), entitlements | `packages/identity/src/permissions.ts`, `apps/api/src/auth.ts`, `packages/events/src/dispatcher.ts`, `0001_foundation.sql` |
| Git | `E:\SaaS` is **not** a git repository. Zyno Genie, Restaurant POS, PMS have `.git`. | `git status` fatal; folder listing |

**Correction to earlier phases:** Phase 1/1B documents described Zyno Genie as the "UAAP foundation" and rated many Port products "Functional". Those ratings came from directory listings and READMEs, not from builds or test runs. Until verified, treat every Port product other than Core SaaS (typecheck + 72 unit tests run) and Construction (its own docs report 354/354 tests on 2026-11-02, **not re-run by me**) as **Requires Verification**. See the completion report.

## 2. Architecture Decision Records

| ADR | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 001 | New service at `E:\SaaS\services\uaap\` (Python 3.11+, FastAPI), **outside** npm workspaces (`packages/*`, `apps/*`). **Needs user confirmation.** | Co-located with identity/tenancy docs and CLAUDE.md rules; no effect on `npm test`/`typecheck`. | Fork Zyno Genie (wrong domain, no tenancy); separate repo (loses shared conventions) |
| 002 | TypeScript stays for ERP; Python only for UAAP (LangGraph ecosystem). | Matches approved direction; no rewrite of ERP code. | Agents in TS |
| 003 | UAAP owns its own PostgreSQL schema `uaap`; never writes ERP tables. | CLAUDE.md rule 3: no module writes another's tables. | Shared tables |
| 004 | Agents reach products **only** through the Tool Gateway → product HTTP APIs. No DB URLs given to agent code. | Approved guardrail #2. | Direct SQL tools |
| 005 | Tenant identity propagates as the existing token (`<tenantId>.<random>`) plus `X-UAAP-Tenant`; UAAP re-validates via the product's `/v1/me`. All UAAP tables carry `tenant_id` + RLS on `app.tenant_id`. | Reuses proven mechanism. | Trusting a header alone |
| 006 | Agents run as **service principals** (`agent:<agentId>`). Effective permissions = agent grants ∩ invoking user's permissions. | Least privilege; agent can never exceed the human. | Agent inherits full user rights |
| 007 | Five tiers are enforced in the Tool Registry code path, never by prompt. Tier 5 has no executor. | Prompt rules are bypassable. | Prompt-only policy |
| 008 | Reuse existing `OutboxDispatcher`; add a long-running worker process (core change, A6) whose bus handler delivers signed webhooks to UAAP `/v1/events`. | No rebuild; at-least-once + idempotency (`processed_events`) already exist. | New queue first |
| 009 | Model Gateway is the only code that holds model credentials; secrets come from environment/secret store, never files in repo. **Any Ollama credential action requires explicit user approval.** | Guardrail + user instruction. | Per-agent keys |
| 010 | Redis introduced at A3, behind an interface with an in-process fallback for dev. | Avoid early infra; Windows host needs a decision. | Redis in A1/A2 |
| 011 | Agents never do money arithmetic; tools return/accept minor-unit decimal strings and compute server-side. | `@erp/money` invariant. | LLM math |
| 012 | **No fabricated fallbacks.** When a model/tool fails the run reports `FAILED` with the error class. | Construction `ai.service.js` `_fallbackResponse` returns a fake "success" payload — unacceptable for agents. | Silent mock responses |
| 013 | UAAP migrations use Alembic with its own version table, run by a dedicated owner role; the existing SQL runner in `packages/db` is untouched. | Separation of ownership. | Adding UAAP SQL to `packages/db/migrations` |

## 3. Frozen non-goals for Wave A
No product rewrites; no agent DB access; no ledger mutation by agents; no Construction DB changes (SQLite policy and `_sqlite_work` untouched); no production integrations without verification.

## 4. Freeze conditions
Freeze takes effect when the user approves: ADR-001 location, ADR-009 credential path (see Open Questions in the completion report), and the DB hosting choice in `UAAP_DATABASE_OWNERSHIP_SPEC.md`.

