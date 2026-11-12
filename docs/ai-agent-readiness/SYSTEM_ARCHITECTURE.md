# QAVRIL LABS — System Architecture & Application Boundaries

**Document ID:** QAVRIL-AUDIT-002  
**Author:** Principal Enterprise ERP & AI Systems Architect  
**Date:** November 5, 2026  
**Status:** Architectural Discovery & Topology Assessment  

---

## 1. High-Level Ecosystem Topology

The QAVRIL LABS technology landscape currently consists of three enterprise pillars supported by specialized AI and mobile edge applications:

```
                            +-------------------------------------------------------+
                            |                 QAVRIL LABS PLATFORM                  |
                            |           Public Marketing & Client Ingress           |
                            |   (HTML5, Responsive UI, Leads Endpoint, Bots Hub)    |
                            +-------------------------------------------------------+
                                                        |
                         +------------------------------+-------------------------------+
                         |                                                              |
                         v                                                              v
+--------------------------------------------------+          +--------------------------------------------------+
|           PILLAR 1: CORE SAAS PLATFORM           |          |         PILLAR 2: ENTERPRISE PMS PLATFORM        |
|                  (`E:\SaaS`)                     |          |        (`E:\Port\Property Management System`)    |
+--------------------------------------------------+          +--------------------------------------------------+
| - Fastify HTTP API (`apps/api`)                  |          | - TanStack Start / React 19 Frontend Shell       |
| - Shared Kernel (`packages/kernel`, `money`)     |          | - Supabase PostgreSQL Database (80+ migrations)  |
| - General Ledger (`packages/ledger`)             |          | - Role-Based Routing (Admin, Cashier, Prop-Mgr)  |
| - Tenancy & Identity (`packages/tenancy`)        |          | - Atomic Accounting & PDC Postings               |
| - PostgreSQL with Row-Level Security (RLS)       |          | - Tenant Self-Service Portal                     |
| - Transactional Outbox & Audit Trigger           |          | - Procurement & Maintenance Automation           |
+--------------------------------------------------+          +--------------------------------------------------+
                         |                                                              |
                         +------------------------------+-------------------------------+
                                                        |
                                                        v
                            +-------------------------------------------------------+
                            |        PILLAR 3: ZYNO CONSTRUCTION ERP MONOLITH       |
                            |              (`E:\Port\Construction`)                 |
                            +-------------------------------------------------------+
                            | - Angular 21 Enterprise Frontend (`zyno_frontend`)    |
                            | - Node.js / Express Backend Engine (`zyno_backend`)   |
                            | - 10 Enterprise Domains (Admin, Purchase, Store...)   |
                            | - Strict SQLite Policy (`_sqlite_work` Root)          |
                            | - Zyno Intelligence Copilot (Ollama `gemma4:31b-cloud`)|
                            | - WBS/CBS Invariant & Budget Reconciliation Engine     |
                            +-------------------------------------------------------+
                                                        |
                         +------------------------------+-------------------------------+
                         |                                                              |
                         v                                                              v
+--------------------------------------------------+          +--------------------------------------------------+
|             SPECIALIZED AI & AUTOMATION          |          |             FLEET & EDGE MOBILE                  |
+--------------------------------------------------+          +--------------------------------------------------+
| - Scrapper RAG Engine (`E:\Port\Scrapper RAG`)    |          | - Quick Commerce Delivery App (Capacitor/Android)|
|   FastAPI, LangChain, Chroma, ChatOllama         |          | - Garage Management System (Prisma ORM, React)   |
| - Real-Time Voice Agent (`E:\Port\Voice Agent`)  |          |   Vehicle master, job cards, service log         |
|   LiveKit, OpenAI GPT-4o, Deepgram, ElevenLabs   |          | - Standalone Driver Dispatch Mobile Interface    |
| - ERP Copilot Frontend (`E:\Port\Enterprise Cop`) |          +--------------------------------------------------+
|   Vite, Google GenAI SDK, ChromaDB Client        |
+--------------------------------------------------+
```

---

## 2. Deep-Dive Architecture by Pillar

### Pillar 1: Core SaaS Platform (`E:\SaaS`)
- **Pattern:** Modular Monolith with strict package boundaries (`npm` workspaces).
- **Runtime:** Node.js 22.x (ES Modules, TypeScript 5.9).
- **HTTP Gateway:** Fastify v5 with strict input validation via `Zod`.
- **Database Engine:** PostgreSQL (target 15+) using the `pg` client.
  - Non-superuser application connection pool (`withTenantTransaction`).
  - Row-Level Security enforced by PostgreSQL trigger & session parameter:
    `SET LOCAL app.tenant_id = '<uuid>';`
  - Append-only audit logging: Database trigger `reject_audit_mutation()` throws an exception on any SQL `UPDATE` or `DELETE` against `audit_log`.
- **Transactional Outbox:**
  - Events are written inside the same ACID transaction as the business change (`outbox_events`).
  - Idempotent consumer tracking in `processed_events`.
  - Lease-based concurrency dispatcher with retry counts and dead-letter status.
- **Architectural Rules (Enforced):**
  1. No module writes another module's tables.
  2. Accounting is the sink: every money or inventory change posts to the General Ledger.
  3. Money amounts are always integer minor units (`bigint`) via `@erp/money`; floats are prohibited.
  4. Time-ordered UUID v7 (`newId`) for distributed key generation.

---

### Pillar 2: Zyno Construction ERP (`E:\Port\Construction`)
- **Pattern:** Domain-Driven Monolith (Angular 21 Client + Express 4 Server).
- **Frontend:** Angular 21 with standalone components, lazy routing, and Tailwind styling.
- **Backend Services:** Express 4.x with modular domain controllers and Sequelize ORM.
- **Database Sandbox:**
  - **Strict SQLite-Only Policy** enforced by code guards (`src/config/sqlite_policy.js` and `src/config/database_target_guard.js`).
  - Storage is strictly confined to `E:\Port\Construction\_sqlite_work\`.
  - Production hosts (e.g. AWS RDS / MySQL) are blocked and rejected at startup.
- **Key Domain Boundaries:**
  - `Admin`: User RBAC, menu management, canonical module resets.
  - `Tender & Project Management`: WBS, CBS, BOQ line-items, project milestones.
  - `Cost Ledger`: Non-material actuals ledger, commitment ledger, budget reconciliation.
  - `Measurement & Billing`: Measurement Book (MB), contractor RA bills, change orders.
  - `Store & Procurement`: Purchase requisitions, quotations, 3-way matching PO-GRN, stock ledger.
  - `Production`: Daily Progress Reports (DPR), image uploads, snag/defect logging.
  - `Copilot Engine`: Single-tenant project-grounded Copilot querying Ollama.

---

### Pillar 3: Enterprise Property Management System (`E:\Port\PMS`)
- **Pattern:** Modern Cloud ERP (TanStack Start full-stack React + Supabase Postgres).
- **Frontend Stack:** React 19, TanStack Router (`@tanstack/react-router`), Radix UI primitives.
- **Backend Stack:** Supabase Managed PostgreSQL with custom PL/pgSQL stored procedures.
  - `atomic_post_accounting_event`: Handles multi-leg double-entry posting for lease receipts.
  - `20260824150000_finance_pdc_lifecycle_hardening.sql`: Strict state machine governing post-dated cheques (`RECEIVED`, `DEPOSITED`, `CLEARED`, `BOUNCED`, `REPLACED`).
  - Zero-Trust RLS: Every table has explicit tenant and user isolation policies.
- **Subsystems:**
  - Property & Unit Management (unit codes, AC meters, furnishings, pricing).
  - Leasing & Tenant Ingress (lease generation, rent-free periods, renewals).
  - Tenant Portal (`/portal`): Self-service maintenance ticket submission, payment receipt inspection.
  - HRMS & Employee Policies: Staff roles, departmental allocations, designation catalogs.
  - Procurement Hub: Trade categories, purchase orders, approval chains.

---

### Pillar 4: Autonomous AI & Processing Subsystems
1. **Scrapper RAG Chatbot (`E:\Port\Scrapper RAG Chatbot`):**
   - **Framework:** Python FastAPI.
   - **LLM Driver:** `langchain_ollama.ChatOllama` targeting model `gemma4:31b-cloud`.
   - **Vector Store:** ChromaDB with HuggingFace `all-MiniLM-L6-v2` embeddings.
   - **State Machine:** 8 distinct states (`START` -> `INTENT_IDENTIFIED` -> `INPUT_COLLECTION` -> `PROCESSING` -> `SOLUTION_GENERATION` -> `CONFIRMATION` -> `COMPLETION` -> `ERROR_HANDLING`).
   - **Output Formatters:** Smart rendering with XML tags (`<ui_table>`, `<ui_card>`, `<ui_code>`).

2. **Real-Time Voice Pipeline Agent (`E:\Port\Voice Agent`):**
   - **Framework:** LiveKit Voice Agent Framework (Python).
   - **Speech Stack:** Deepgram STT (Speech-to-Text) + OpenAI `gpt-4o` + ElevenLabs TTS.
   - **Knowledge Base:** Simulated keyword-matching RAG with tool-call lookup (`lookup_knowledge_base`).

3. **Enterprise Copilot (`E:\Port\Enterprise Copilot for ERPCRM`):**
   - **Client:** React 19 + Vite + `@google/generative-ai` + `chromadb` client.
   - **Purpose:** Contextual assistant sidebar designed for invoice and ledger lookups.

---

## 3. Application Boundaries & Inter-Service Isolation Analysis

Currently, these applications operate as **independent functional silos**:
1. `E:\SaaS` uses Node 22 + PostgreSQL with strict RLS for Core ERP Ledger & Sales.
2. `E:\Port\Construction` uses Angular + Express + SQLite in `_sqlite_work`.
3. `E:\Port\Property Management System` uses React + Supabase (PostgreSQL) with its own database schema.
4. `E:\Port\Scrapper RAG Chatbot` uses Python FastAPI + ChromaDB + Ollama.
5. `E:\Port\Garage Management` uses Prisma + React.

### Current Isolation Deficiencies:
- **No Shared Event Bus:** Domain events in Construction do not propagate to the Core SaaS General Ledger.
- **No Unified Auth Provider:** Users authenticate separately in each application.
- **No Shared Tooling Layer:** AI prototypes cannot execute verified writes or tool calls across other modules.
- **Data Duplication:** Vendor and customer master records exist independently in Construction, PMS, and SaaS Core.

---

## 4. Integration Blueprint for the AI Agent Ecosystem

To introduce an autonomous AI Agent and Automation ecosystem without disrupting existing applications:
1. **API-First Agent Integration:** Agents will **never** directly query or mutate underlying databases (neither SQLite nor PostgreSQL). All agent actions will execute via authenticated REST endpoints and validated tool contracts.
2. **Central AI Gateway:** A dedicated FastAPI / Python microservice will orchestrate LLM routing, token tracking, and provider fallback across Ollama Cloud and commercial models.
3. **Event Aggregation via Outbox:** Connect background workers to read from `outbox_events` and dispatch webhooks to trigger asynchronous AI evaluation.
