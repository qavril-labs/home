# QAVRIL LABS — Database Architecture, Multi-Tenancy & Data Safety Audit

**Document ID:** QAVRIL-AUDIT-003  
**Author:** Principal Enterprise Database & AI Systems Architect  
**Date:** November 5, 2026  
**Status:** Comprehensive Data Tier Assessment  

---

## 1. Database Engines Across the Ecosystem

The QAVRIL LABS ecosystem employs distinct database engines tailored to specific operational tiers:

| Subsystem / Codebase | Engine & Dialect | Primary Schema / Location | Tenant Isolation Strategy | Mutation Guarantees |
|---|---|---|---|---|
| **Core SaaS Platform** (`E:\SaaS`) | PostgreSQL 15+ (`pg` driver) | `packages/db/migrations` (SQL Migrations 0001–0005) | Row-Level Security (RLS) via `app.tenant_id` session setting | Strict Append-Only Triggers on `audit_log` and `ledger_entries` |
| **Construction ERP** (`E:\Port\Construction`) | SQLite 3 (Sequelize ORM) | `E:\Port\Construction\_sqlite_work\dev\` | Tenant / Project ID scoping via query wrappers | Foreign-key constraints; migration rollback validations |
| **Property Management** (`E:\Port\PMS`) | PostgreSQL 15+ (Supabase Managed) | `supabase/migrations` (80+ DDL scripts) | Zero-Trust RLS Policies & Tenant Organization IDs | Atomic PL/pgSQL posting functions (`atomic_post_accounting_event`) |
| **Garage Management** (`E:\Port\Garage`) | SQLite / PostgreSQL (Prisma ORM) | `prisma/schema.prisma` | Application-level scoping | Foreign keys with cascading updates |
| **Scrapper RAG Engine** (`E:\Port\Scrapper`) | ChromaDB (Vector) + SQLite (Sessions) | `data/chroma/`, `data/app.db` | Collection name scoped per `session_id` | Ephemeral & persistent collection reset methods |

---

## 2. Core SaaS Database Audit (`E:\SaaS`)

### Schema Migrations:
1. `0001_foundation.sql`:
   - `tenants`: Primary tenant entity with slug validation (`^[a-z0-9][a-z0-9-]{1,62}$`), status (`ACTIVE`, `SUSPENDED`).
   - `companies`: Multi-company support under each tenant; currency & fiscal year boundaries.
   - `branches`: Multi-branch tracking per company with timezone support.
   - `tenant_products`: Entitlement registry tracking enabled product IDs per tenant.
   - `users`: User identity with scrypt password hash and role array (`text[]`).
   - `sessions`: Token hash lookup with automatic expiration.
   - `number_counters`: Gap-free transactional document sequence counters.
   - `outbox_events`: Transactional outbox table for event-driven messaging.
   - `processed_events`: Deduplication table for consumer idempotency.
   - `audit_log`: System-wide audit trail.
2. `0002_leads.sql`: Public lead intake table (intentionally unscoped by tenant).
3. `0003_ledger.sql`:
   - `fx_rates`: Effective-dated foreign exchange rates with minor unit integer ratios.
   - `ledger_accounts`: Chart of accounts per company.
   - `ledger_periods`: Monthly fiscal period control (`OPEN`, `CLOSED`).
   - `ledger_entries`: Double-entry balanced journal with multi-currency lines stored as JSONB.
4. `0004_leads_trial.sql`: Adds trial plan tier support to lead intake.
5. `0005_leads_consent_slot.sql`: Demo scheduling slots and consent capture.

### Immutability & Security Triggers:
```sql
-- Audit Log Immutability:
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- General Ledger Immutability:
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
```
*Architectural Guarantee:* Corrections to posted financial records can only be performed by posting explicit balancing reversals (`reversal_of REFERENCES ledger_entries(id)`). Edits and deletions are physically rejected at the database engine level.

### Row-Level Security (RLS) Implementation:
Every tenant-owned table enforces:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
`FORCE ROW LEVEL SECURITY` guarantees that even the table owner role cannot bypass isolation unless explicitly elevated.

---

## 3. Construction ERP Database Audit & Safety Policy (`E:\Port\Construction`)

### Strict SQLite-Only Policy:
The Construction ERP operates under an enforced **SQLite-Only Verification Policy** established in `DATABASE_MANIFEST.md` and code guardrails:
- **Approved Storage Root:** `E:\Port\Construction\_sqlite_work\`
- **Canonical Development File:** `dev\construction_erp_dev.sqlite` (20 migrations verified applied, 0 foreign-key violations, integrity `ok`).
- **Disposable Testing Root:** `tests\*.disposable.sqlite` (In-memory or auto-cleaned disposable files).
- **Backups:** Stored under `backups\` (e.g. `construction_erp_dev.pre-msp-uid-20261104.sqlite`).

### Enforcement Mechanisms in Code:
1. `src/config/sqlite_policy.js`: Contains `APPROVED_ROOT` constant. Disallows paths escaping drive `E:`, relative paths (`..`), URLs, network shares, and symbolic links.
2. `src/config/database_target_guard.js`: Scans environment declarations (`DB_TARGET_CLASS`, `DB_DIALECT`). Immediately halts execution if a remote host (`DB_HOST`), MySQL, MariaDB, or production host is detected.
3. `scripts/migrate.js`: Preflight validation refuses migration runs if production host variables are set or if target file resides outside the approved directory.

> [!IMPORTANT]
> **Strict Agent Guardrail:** AI agents must **never** execute direct SQLite mutations, raw file writes, or run migrations in `_sqlite_work`. All interactions with Construction ERP must use the Express API endpoints (`/api/v1/*`).

---

## 4. Property Management System Database Audit (`E:\Port\PMS`)

### Supabase PostgreSQL Infrastructure:
- **Migration Count:** 80+ migration files managing over 60 relational tables.
- **Key Schemas & Capabilities:**
  - Post-Dated Cheque Lifecycle: Governed by `20260824150000_finance_pdc_lifecycle_hardening.sql`.
  - Atomic Financial Posting: Stored procedure `atomic_post_accounting_event` handles debit/credit balancing in a single transaction.
  - HRMS & Payroll: Staff records, departmental allocations, designation catalogs.
  - Procurement & Trade Categories: Multi-level vendor evaluation, items catalog, PO tracking.
  - Security Audit Logging: `security_audit_log_table.sql` records security events.

---

## 5. Multi-Tenancy & AI Agent Readiness Assessment

We evaluate the database tier against the 10 foundational multi-tenancy requirements for autonomous AI agents:

| Requirement | Status | Evidence from Codebase | Agent Readiness Recommendation |
|---|---|---|---|
| 1. Multiple Organizations | **Supported** | `tenants` table (`E:\SaaS`), `tenant_organisations` (`PMS`) | Agent must include `tenant_id` in every context frame |
| 2. Multiple Users per Org | **Supported** | `users` table with compound unique index `(tenant_id, email)` | Agent must operate on behalf of a specific authenticated `actor_id` |
| 3. Multiple Projects per Org | **Supported** | `projects` table linked to tenant in Construction ERP | Agent tool calls must be scoped by `projectId` parameter |
| 4. Role-Based Access Control | **Supported** | Fastify RBAC + Supabase RLS + Construction permission middleware | Agent must inherit only the permissions of the calling user |
| 5. Tenant-Specific Data for AI | **Supported** | Isolation policies prevent cross-tenant record leakage | Gateway must inject `tenant_id` into all retrieval queries |
| 6. Secure Agent-to-DB Comms | **Supported** | Agents communicate via REST API; direct DB connections disabled | Disallow raw SQL execution tools; enforce typed schema contracts |
| 7. Auditability of AI Actions | **Supported** | `audit_log` records `actor_id`, `changes`, and `request_id` | Designate a dedicated `AI_AGENT` actor type in audit logs |
| 8. Retrieval-Augmented Gen (RAG) | **Partial** | ChromaDB used in Scrapper RAG; pgvector not yet enabled in SaaS DB | Add `pgvector` extension to Core PostgreSQL for unified RAG |
| 9. Vector Search | **Partial** | ChromaDB collections used per session | Deploy pgvector or centralized vector index for multi-tenant search |
| 10. Workflow State Persistence | **Missing** | No persistent agent state table in Core SaaS | Create `agent_runs` and `agent_checkpoints` tables in Core DB |
