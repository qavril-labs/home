# QAVRIL LABS — Automation, Background Processing & Workflow Audit

**Document ID:** QAVRIL-AUDIT-005  
**Author:** Principal DevSecOps & Enterprise Systems Architect  
**Date:** November 5, 2026  
**Status:** Queue, Worker & Workflow Engine Audit  

---

## 1. Existing Automation Infrastructure Discovered

### A. Core SaaS Transactional Outbox & Events (`E:\SaaS`)
- **Event Bus Contract:** `@erp/events` (`packages/events`).
  - Standardized domain events with schema versions, UTC timestamps, aggregate ID, and JSON payload.
- **Transactional Outbox:**
  - Persisted in PostgreSQL table `outbox_events` within the same ACID transaction as the business operation.
  - Table fields: `id`, `tenant_id`, `type`, `payload`, `occurred_at`, `attempts`, `locked_until`, `delivered_at`, `failed_at`, `last_error`.
  - Partial index on pending events:
    `CREATE INDEX outbox_events_pending_idx ON outbox_events (occurred_at) WHERE delivered_at IS NULL AND failed_at IS NULL;`
- **Dispatcher & Idempotency:**
  - `PgOutboxStore` manages atomic leases (`locked_until`) to prevent race conditions across parallel workers.
  - `processed_events` tracks consumer delivery history `(consumer, event_id)` ensuring at-least-once delivery without duplicate processing.
  - *Operational Status:* The dispatcher mechanism is implemented and covered by automated tests. A standalone continuously running worker daemon (e.g., systemd service, container task) has not yet been provisioned in production.
- **Outbound Webhooks:**
  - `apps/api/src/app.ts` includes `notifyOperator` for asynchronous lead notification forwarding via HTTP POST with a 5000ms timeout.

### B. Supabase pg_cron Automations (`E:\Port\Property Management System`)
- **Scheduled SQL Automations:**
  - Managed via Supabase migrations `20260904140000_storage_buckets_and_cron_automations.sql` and `20260915130000_cron_automations.sql`.
  - Scheduled jobs trigger lease expiration alerts, rent invoice generation, and post-dated check status reviews.
- **Notification Scheduling:**
  - `20260915220000_notification_scheduling_and_engagement.sql` manages queued reminder notifications for tenant rent payments.

### C. Queue Brokers & Workflow Engines (Status: Not Deployed)
- **Redis / BullMQ:** Not deployed in active workspace configurations.
- **Temporal / Celery:** Not installed.
- **Third-Party Automation (n8n / Zapier):** No proprietary webhook connector scripts discovered.

---

## 2. Assessment Against AI Agent Workflow Requirements

| Workflow Requirement | Current Ecosystem Capability | Codebase Evidence | Readiness Verdict | Recommended Target |
|---|---|---|---|---|
| **1. Long-Running AI Tasks** | No background task queue; HTTP calls time out at 120s | Express & Fastify request timeouts | **Partial / Fragile** | Background worker queue with async job polling |
| **2. Async Agent Execution** | Outbox pattern handles events, but no LLM consumer attached | `outbox_events` in `packages/db` | **Partial** | Wire an AI agent consumer daemon to `outbox_events` |
| **3. Concurrent Agents** | No resource throttling or queue concurrency control | Sequential tests in Jest & Vitest | **Missing** | Redis + Celery/BullMQ or async Python worker pool |
| **4. Scheduled AI Tasks** | Database pg_cron runs SQL queries only, cannot call LLMs | Supabase migrations | **Partial** | Dedicated Python scheduler (APScheduler / Celery Beat) |
| **5. Event-Triggered Tasks** | Domain events emitted on invoice/tenant creation | `@erp/events`, `outbox_events` | **Ready for Wiring** | Trigger agents directly from outbox consumer |
| **6. Agent-to-Agent Comms** | Siloed applications; no inter-agent messaging protocol | None | **Missing** | Shared message bus with typed agent protocol |
| **7. Retry & Recovery** | Outbox tracks `attempts`, `locked_until`, `failed_at` | `PgOutboxStore` lease logic | **Ready for Reuse** | Reuse outbox lease & retry pattern for agent tasks |
| **8. Workflow Persistence** | Hardcoded states in `bot_config.json`; no DB persistence | Scrapper RAG state machine | **Missing** | Persistent workflow engine (LangGraph Checkpointers) |
| **9. Human Approval Gates** | Manual UI approval workflows exist for POs and Leases | Construction & PMS controllers | **Partial** | Standardized `APPROVAL_PENDING` agent action gate |
| **10. Execution Monitoring** | Fastify request logger only; no agent step observability | `apps/api/src/app.ts` | **Missing** | Structured execution log table (`agent_audit_log`) |

---

## 3. Reusable Assets vs Required New Infrastructure

### Assets to Immediately Reuse:
1. **The Transactional Outbox Pattern (`packages/db/src/postgres.ts`):** Proven, crash-resilient mechanism for decoupling business transactions from background agent tasks.
2. **PostgreSQL Event Deduplication (`processed_events`):** Eliminates double-processing of AI-triggered actions.
3. **Database Audit Triggers:** Guarantees that any action performed by an agent produces an immutable audit row.

### Infrastructure that Must Be Introduced in Phase 2:
1. **Asynchronous Agent Worker Service:** A lightweight Python/FastAPI worker pool to consume outbox events and invoke LLM chains without blocking HTTP requests.
2. **Redis Coordination Layer:** In-memory caching for agent memory, rate limits, and real-time execution lock leases.
3. **Approval Inbox & Webhook Subsystem:** Human-in-the-loop review station for draft actions (e.g. PO creation, lease termination).
