# QAVRIL LABS — AI Agent Readiness Capability Matrix (Expanded)

**Document ID:** QAVRIL-AUDIT-008-V2  
**Author:** Principal Enterprise AI Systems Architect  
**Date:** November 5, 2026  
**Status:** Capability Gap & Readiness Scoring Across 39 Products  

---

## 1. Enterprise AI Agent Capability Assessment

| Capability | Current Status | Codebase Evidence | Technical Gaps | Dependencies | Recommended Implementation |
|---|---|---|---|---|---|
| **1. LLM Gateway** | **Partial** | Direct Axios client in `ai.service.js`; LangChain `ChatOllama` in Scrapper RAG | No central router, provider fallback, or rate limiting across apps | Python/FastAPI environment | Build unified FastAPI Model Gateway supporting Ollama Cloud + Commercial APIs |
| **2. Agent Runtime** | **Prototype Ready** | LangGraph state graph in `E:\Port\Zyno Genie` (`graph/`, `CodebaseState`, `agents/`) | Needs generalization from code generation to enterprise ERP tool calling | Python 3.11+, LangGraph | Deploy a stateful Agent Runtime utilizing LangGraph with persistent state checkpointers |
| **3. Agent Registry** | **Missing** | Agent descriptions listed in static HTML (`site/bots.html`) | No programmatic catalog registering agent schemas, tools, or versions | Core SaaS Database | Create an `agent_registry` table in Core SaaS storing metadata, models, and tool mappings |
| **4. Tool Registry** | **Missing** | 1 LiveKit function call (`lookup_knowledge_base`) | No typed contracts or permission checking for ERP writes | Fastify & Express APIs | Implement a JSON-schema-based Tool Registry with strict 5-tier permission validation |
| **5. Memory Management** | **Partial** | Supabase checkpoint tables in `E:\Port\Zyno Genie`; Chroma vector collections | Context erased across application boundaries; no cross-product memory | Redis / PostgreSQL | Multi-tiered memory: Redis for working scratchpad + PostgreSQL/pgvector for long-term semantic memory |
| **6. RAG Infrastructure** | **Partial** | Chroma vectorstore in `rag_engine.py`; simple fact array in Voice Agent | Fragmented; each prototype maintains its own disjointed document store | Embedding model, storage | Centralized RAG pipeline with hybrid search (dense embeddings + sparse keyword BM25) |
| **7. Vector Search** | **Partial** | ChromaDB locally stored in `data/chroma` (`E:\Port\Scrapper`) | Not tenant-isolated; does not scale to multi-tenant cloud | pgvector / Qdrant | Enable `pgvector` extension directly in PostgreSQL Core DB for tenant-isolated vector indexing |
| **8. Workflow Engine** | **Partial** | Outbox pattern in `packages/db`; pg_cron in PMS; LangGraph checkpoints | No long-running workflow engine capable of multi-day pausing or approvals across ERPs | PostgreSQL, Redis | LangGraph or Temporal workflow engine for human-in-the-loop task orchestration |
| **9. Background Workers** | **Partial** | Outbox dispatcher class tested; no persistent daemon running | Background jobs must be triggered manually or via unit tests | Node.js / Python daemon | Deploy a continuous Outbox Polling Worker daemon (`systemd` / Docker container) |
| **10. Event Bus** | **Implemented** | `@erp/events` and `outbox_events` table in Core SaaS monorepo | Events are currently local to Core SaaS; not bridged to Construction or PMS | PostgreSQL | Extend Outbox Dispatcher to publish events to internal webhook listeners |
| **11. Human Approvals** | **Partial** | PO and Lease approval UI routes in Construction & PMS | No standardized `APPROVAL_PENDING` pause mechanism for AI agents | Workflow Engine | Build an Approval Inbox service with email/webhook notifications and sign-off APIs |
| **12. Agent Permissions** | **Partial** | RBAC middleware in Express & Fastify | No granular tool-level permission matrix specifically for AI agents | Identity Service | Implement 5-tier permission model; require human token for Tier 3 financial writes |
| **13. Agent Monitoring** | **Missing** | Console warnings in Express; Fastify HTTP request logs | No metrics on token usage, latency, agent error rates, or tool failures | OpenTelemetry / Prometheus | Integrate OpenTelemetry instrumentation tracing model calls and tool executions |
| **14. Execution Logs** | **Partial** | Immutable `audit_log` table in Core SaaS; SSE streams in Zyno Genie | AI prompt/response traces and intermediate tool thoughts not stored centrally | PostgreSQL | Add an `agent_execution_logs` table recording run ID, steps, tokens, and tool calls |
| **15. Evaluation Framework** | **Missing** | Unit tests for deterministic math; no LLM evaluation tests | No automated prompt regression tests or drift detection benchmarks | Pytest / DeepEval | Build an automated synthetic evaluation suite running golden test queries against LLMs |
| **16. Cost Monitoring** | **Missing** | None | Zero tracking of token spend, compute costs, or tenant quota enforcement | Redis / PostgreSQL | Real-time token consumption ledger charging against tenant monthly quotas |
| **17. Multi-Tenancy** | **Implemented** | PostgreSQL Row-Level Security (`FORCE RLS`) in Core SaaS & PMS | Construction ERP SQLite sandbox is single-tenant local | PostgreSQL | Enforce `tenant_id` context injection across all agent tool calls and RAG retrievals |
| **18. Security Controls** | **Implemented** | SQLite policy guards; prompt injection filters in `copilot.controller.js` | Defenses are siloed in individual controllers | API Gateway | Consolidate prompt firewall and input sanitization into the Central Model Gateway |

---

## 2. Updated Ecosystem Readiness Score

```
+-----------------------------------------------------------------------------------+
| GLOBAL AI AGENT READINESS SCORE: 62 / 100                                         |
| Assessment: FOUNDATIONALLY CAPABLE, PROTOTYPE-AUGMENTED, WORKER-GATED             |
+-----------------------------------------------------------------------------------+
```

### Breakdown by Category:
- **Core ERP Business Logic & Data Invariants:** **92 / 100** (Robust, tested, hardened across 23 discovered applications).
- **Multi-Tenant Security & Immutability:** **88 / 100** (Postgres RLS, append-only triggers, SQLite target guards).
- **Autonomous Agent Runtime & Tooling:** **42 / 100** (LangGraph state graph verified in `Zyno Genie`; central tool registry pending).
- **Background Execution & Automation:** **45 / 100** (Outbox and dispatcher exist; continuous workers missing).
- **Model Gateway & Observability:** **35 / 100** (Client scripts exist; central gateway and token metering missing).
