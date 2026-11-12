# QAVRIL LABS — Security, Governance & Agent Permissions Audit

**Document ID:** QAVRIL-AUDIT-006  
**Author:** Principal DevSecOps & AI Safety Architect  
**Date:** November 5, 2026  
**Status:** Security Posture & Governance Specification  

---

## 1. Existing Security Posture

### A. Authentication & Session Security
- **Core SaaS (`E:\SaaS`):**
  - Passwords hashed using `scrypt` with cryptographic salts (memory/CPU hardened).
  - Session tokens use a composite structure: `<tenantId>.<randomString>`.
  - Only the cryptographic SHA-256 hash of the session token is persisted in the `sessions` table.
  - Token lookup is prefixed by the tenant ID, ensuring that session verification automatically enforces PostgreSQL Row-Level Security.
  - Session expiration and explicit logout endpoints are fully verified.
- **Property Management (`E:\Port\PMS`):**
  - Supabase JWT authentication with tenant-level token claims.
  - Tenant credential isolation enforced via custom database functions.
- **Construction ERP (`E:\Port\Construction`):**
  - Session tokens validated via Express middleware; user permissions mapped against module access registries.

### B. Multi-Tenant Data Isolation
- **PostgreSQL Row-Level Security (RLS):**
  - RLS policies enabled and **forced** on all tenant-owned tables (`FORCE ROW LEVEL SECURITY`).
  - Every tenant transaction sets `current_setting('app.tenant_id')`. Queries without a valid tenant context return 0 rows.
- **Database Safety Guardrails:**
  - Construction ERP strictly prohibits external database connections via `src/config/database_target_guard.js`. Any execution referencing remote database hosts or production IPs (e.g. AWS RDS) fails immediately.

### C. Secrets & Environment Configuration Hygiene
- **Finding:** In `E:\Port\Construction\zyno_construction_backend\zyno_construction_backend\.env`, an unredacted production host (`DB_HOST`) is present.
  - *Mitigation Active:* The built-in guard (`database_target_guard.js`) actively blocks execution whenever this variable is loaded, preventing accidental connection.
  - *Recommendation:* Cleanse local `.env` files to remove legacy production host definitions.
- **Rule for AI Agents:** No API key, token, or connection secret may ever be embedded in frontend code, checked into git repositories, or logged in agent execution traces.

---

## 2. AI Safety, Guardrails & Prompt Injection Defense

Our audit of `copilot.controller.js` revealed robust server-side prompt defense patterns already implemented:
1. **Identity Guardrail:** Rejects impersonation attempts; enforces canonical name "I'm Zyno Intelligence Copilot."
2. **Prompt Injection & System Prompt Leakage Protection:** Evaluates input queries against known attack signatures ("ignore previous instructions", "system prompt", "reveal your prompt", "jailbreak", "dan mode").
3. **Domain Enclosure:** Rejects non-enterprise domains (creative fiction, games, personal advice, cryptocurrency speculation).
4. **Disabled Web Ingress:** Refuses requests to browse live internet or fetch unverified external URLs, restricting grounding exclusively to verified internal records.

---

## 3. Five-Tier Agent Permission & Tool Architecture

To ensure that autonomous agents can never corrupt enterprise data or bypass organizational governance, all AI Agent operations must be classified into **Five Security Tiers**:

```
+---------------------------------------------------------------------------------+
| TIER 1: READ-ONLY                                                               |
| Scope: Queries, report summaries, KPI calculations, document searches.         |
| Execution: Direct automated execution via read-only API endpoints.              |
+---------------------------------------------------------------------------------+
                                      |
                                      v
+---------------------------------------------------------------------------------+
| TIER 2: DRAFT OR RECOMMEND                                                      |
| Scope: Pre-filling purchase orders, drafting email responses, generating BOQs.  |
| Execution: Stored in draft state; flagged with `is_ai_draft: true`.             |
+---------------------------------------------------------------------------------+
                                      |
                                      v
+---------------------------------------------------------------------------------+
| TIER 3: HUMAN APPROVAL REQUIRED (GATED WRITE)                                   |
| Scope: PO submission (> $1,000 / INR 50,000), lease termination, payments.     |
| Execution: Agent creates a pending approval ticket in Approval Inbox.           |
|            Halts until authorized human supervisor signs off with MFA/token.     |
+---------------------------------------------------------------------------------+
                                      |
                                      v
+---------------------------------------------------------------------------------+
| TIER 4: AUTHORIZED WRITE OPERATION                                              |
| Scope: Logging site DPR notes, tagging maintenance snags, creating lead records.|
| Execution: Direct automated write with strict schema validation & audit log.    |
+---------------------------------------------------------------------------------+
                                      |
                                      v
+---------------------------------------------------------------------------------+
| TIER 5: STRICTLY RESTRICTED (BLOCKED FOR ALL AGENTS)                            |
| Scope: Direct SQL updates, ledger mutation, user role elevation, DB migrations. |
| Execution: Permanently blocked at API gateway & database trigger level.         |
+---------------------------------------------------------------------------------+
```

---

## 4. Agent Governance & Auditing Controls

1. **No Direct Database Access:** Agents must **never** receive raw database credentials (PostgreSQL or SQLite). All reads and writes must pass through validated REST API endpoints with RBAC enforcement.
2. **Dedicated Actor Classification:**
   - Database audit tables must record `actor_type = 'AI_AGENT'`, including the specific `agent_id`, `model_name`, `prompt_hash`, and `request_id`.
3. **Deterministic Rate & Cost Quotas:**
   - Per-tenant daily token consumption caps.
   - Per-minute request throttling to prevent LLM recursion loops.
4. **Data Redaction & PII Masking:**
   - Ingress filter must sanitize payment card details, national IDs, and bank account credentials before passing context to LLM prompts.
