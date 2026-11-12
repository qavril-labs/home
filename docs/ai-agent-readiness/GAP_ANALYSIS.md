# QAVRIL LABS — Gap Analysis, Technical Debt & Architectural Risks

**Document ID:** QAVRIL-AUDIT-009  
**Author:** Principal Software Architect & DevSecOps Engineer  
**Date:** November 5, 2026  
**Status:** Comprehensive Gap & Risk Assessment  

---

## 1. Identified Codebase & Architecture Gaps

### A. Core SaaS Platform Gaps (`E:\SaaS`)
1. **Outbox Worker Process Missing:**
   - *Issue:* While `outbox_events` and `PgOutboxStore` are fully coded and tested, no continuous background daemon executes `dispatch()` on a timer in production. Events remain queued unless explicitly processed.
2. **Missing Phase 0 Platform Capabilities:**
   - As documented in `phase-0-status.md`, 12 foundational platform modules are marked "Not started":
     - `PLT-07` Workflow & Approvals
     - `PLT-09` Custom Fields & Layouts
     - `PLT-10` Notifications (Email, SMS, WhatsApp)
     - `PLT-11` Documents & Files (Storage, versions)
     - `PLT-12` Print & PDF (Templates, labels)
     - `PLT-13` Reporting & BI
     - `PLT-14` Import, Export & Migration
     - `PLT-15` Integration Hub (API keys, webhooks)
     - `PLT-17` Global Search
     - `PLT-19` Mobile Shell
     - `PLT-20` SaaS Billing (self-service stripe plans)
     - `PLT-23` Onboarding Wizard
3. **Role-Based Access Control Maturity:**
   - Built-in roles currently use placeholder strings (`tenant_admin`). Granular action-level permissions per module have not yet been formalized in database schema.
4. **Currency Table Scope:**
   - Static currency table currently holds 24 major currencies. Expansion to full ISO 4217 is necessary prior to global multi-currency scaling.

---

### B. Construction ERP Architecture Gaps (`E:\Port\Construction`)
1. **Single-Tenant Local SQLite Constraint:**
   - *Issue:* The Construction ERP operates strictly in SQLite within `_sqlite_work`. While rock-solid for verification and single-project operations, it does not support multi-tenant cloud concurrency.
2. **Legacy Production Variable in Repository `.env`:**
   - *Issue:* The `.env` file in the backend repository holds a `DB_HOST` pointing to an external AWS IP (`13.233.140.9`). The code guard actively fails closed to protect the project, but the setting creates friction during automated migration tooling preflights.
3. **Angular 21 Build Times:**
   - Development server compilation (`ng serve`) takes ~310 seconds on Windows due to heavy initial bundle compilation.
4. **Direct Write Concurrency:**
   - SQLite serializes file locks; multiple concurrent users or rapid agent writes could encounter database lock timeouts (`SQLITE_BUSY`).

---

### C. Property Management System Gaps (`E:\Port\PMS`)
1. **Third-Party Supabase Coupling:**
   - Frontend is tightly coupled to `@supabase/supabase-js` client conventions. Needs abstraction to allow on-premise PostgreSQL deployment for strict enterprise sovereignty clients.
2. **Post-Dated Cheque Manual Clearing:**
   - Post-dated cheque clearing state transitions are executed via manual UI buttons or batch scripts; no automated open-banking API hookup exists.
3. **External E-Signature SaaS Dependency:**
   - Digital lease signing requires third-party API keys that are currently unconfigured in the local environment.

---

### D. AI & Autonomous Agent Gaps
1. **Disjointed AI Prototypes:**
   - Four separate AI experiments operate in different languages and frameworks without a shared protocol:
     - Node.js Axios calling Ollama directly (`E:\Port\Construction`).
     - Python FastAPI using LangChain + Chroma (`E:\Port\Scrapper RAG`).
     - Python LiveKit calling OpenAI + Deepgram (`E:\Port\Voice Agent`).
     - React Vite calling Google GenAI directly from browser (`E:\Port\Enterprise Copilot`).
2. **Absence of Central Model Gateway:**
   - No unified proxy managing retries, fallback between providers, token metering, or cost control.
3. **Missing Tool Execution & Verification Layer:**
   - None of the AI prototypes possess a secure, typed Tool Registry capable of safely issuing authenticated writes or queries to ERP backends.
4. **Zero Human-in-the-Loop Orchestration:**
   - No workflow mechanism to pause an agent, alert a supervisor, and resume execution after approval.

---

## 2. Risk Matrix & Mitigation Blueprint

| Risk ID | Description | Severity | Likelihood | Impact on Agents | Mitigation Strategy |
|---|---|---|---|---|---|
| **RSK-01** | **Direct Database Corruption by Agents** | Critical | High | Destructive writes to SQLite or Postgres tables | Strictly prohibit direct database access. Enforce API-only tool calling with 5-tier permissions. |
| **RSK-02** | **Unbounded Token Consumption & Cost Spikes** | High | High | Excessive API billing from runaway agent loops | Implement rate limiting, daily token budgets per tenant, and timeout caps in the Model Gateway. |
| **RSK-03** | **Prompt Injection & Data Exfiltration** | Critical | Medium | Adversarial prompt hijacking enterprise data | Deploy input sanitization firewalls and enforce tenant context isolation on all RAG queries. |
| **RSK-04** | **Stale or Rolled-back Background Execution** | Medium | Medium | Inconsistent states between AI tasks and ERP | Leverage the proven Transactional Outbox pattern for all agent event triggering. |
| **RSK-05** | **SQLite Lock Contention in Construction ERP** | High | High | Agent worker encounters `SQLITE_BUSY` errors | Route agent actions through existing Express controllers; implement exponential backoff retries. |
| **RSK-06** | **Credential Leakage in Git Traces** | High | Low | Exposure of Ollama Cloud or commercial API keys | Enforce user approval before credential rotation; use OS environment variables only; zero git commits of keys. |
