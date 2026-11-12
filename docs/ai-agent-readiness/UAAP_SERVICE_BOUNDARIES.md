# UAAP Service Boundaries

**Milestone:** A1 · **Status:** Proposed

## 1. Deployable units (modular monolith first)

| Unit | Language | Owns | Calls | Called by |
|---|---|---|---|---|
| `uaap-api` (FastAPI) | Python | Public `/v1` API, auth validation, run submission, approvals API | gateway, runtime, registry modules (in-process) | Portals, mobile, product backends, third parties |
| `uaap-worker` | Python | Run execution, resume, retries, schedules | model gateway, tool gateway, Postgres, Redis | queue/DB leases |
| `core-outbox-worker` (A6) | TypeScript | Drives existing `OutboxDispatcher` | Postgres outbox, UAAP `/v1/events` | timer |
| Product adapters | per product | Nothing new in product DBs | Product HTTP APIs | Tool Gateway |

Internal Python packages (all in one service for Wave A):

```
services/uaap/src/uaap/
  api/        routes, schemas, auth dependency
  gateway/    providers/ (ollama, …), router, metering, quotas
  runtime/    graph builder, checkpointer, orchestrator, lifecycle
  registry/   agents, versions, tool definitions, grants
  tools/      executor, tier engine, idempotency, adapters/<product>/
  memory/     working (Redis iface), long-term + rag (pgvector)
  approvals/  requests, decisions, escalation
  events/     inbox, consumers
  notify/     email, whatsapp adapters
  obs/        audit, traces, usage, health
  agents/     shared/ (7 domain agents), product/ (later waves)
```

## 2. Dependency rules (enforced by import-linter in A2 CI)
1. `agents/*` may import only `tools.client` and `runtime.sdk` — never `gateway.providers`, DB, or HTTP libs directly.
2. Only `gateway/providers` may read model credentials.
3. Only `tools/adapters/<product>` may know a product's URL/auth; adapters never import each other.
4. Only `tools/executor` performs product calls, after the tier engine allows.
5. No module imports ERP database drivers.

## 3. API versioning & contracts
- `/v1` prefix; additive changes only inside a major version; breaking changes → `/v2`.
- OpenAPI generated from Pydantic; contract tests snapshot it (A2).
- Error envelope mirrors core: `{ "error": { "code", "message", "details" } }` with codes `UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, RATE_LIMITED, QUOTA_EXCEEDED, APPROVAL_REQUIRED, TOOL_BLOCKED, UPSTREAM_FAILED`.
- Every request carries `X-Request-Id` (generated if absent) → copied into audit `request_id`.

## 4. Planned public endpoints (contracts only; nothing implemented)
`POST /v1/runs` · `GET /v1/runs/{id}` · `POST /v1/runs/{id}/cancel|resume` · `GET /v1/agents` · `POST /v1/model/chat` (gateway, internal-scoped) · `GET /v1/approvals` · `POST /v1/approvals/{id}/decision` · `POST /v1/events` (HMAC-signed) · `GET /v1/usage` · `GET /healthz`, `/readyz`.

## 5. Environments
`local` (dev DB, in-memory working memory, mocked provider) · `test` (disposable DB per run, as in `packages/db/testing`) · `staging` · `production`. Config via environment variables validated at startup (pydantic-settings); a startup check refuses to run if `ENV=production` and any non-production DB/provider is configured, mirroring Construction's target guard.

## 6. Construction ERP isolation
UAAP reaches Construction only via its Express API (`/api/v1/*`) through an adapter. UAAP never receives `DB_STORAGE`, never touches `E:\Port\Construction\_sqlite_work`, and writes nothing there. SQLite write contention (`SQLITE_BUSY`) is handled by adapter backoff and a per-product concurrency limit of 1 writer.

