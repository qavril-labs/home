# UAAP A2 Implementation Backlog — Central AI Model Gateway

**Status:** Ready to start **only after A1 approval and the blockers below are cleared.**

## Blockers / decisions needed before coding
| ID | Needed from user | Why |
|---|---|---|
| D1 | Confirm location `E:\SaaS\services\uaap\` (ADR-001) | Scaffold path |
| D2 | **How is Ollama Cloud authenticated?** (a) signed-in local Ollama daemon proxying `:cloud` models, or (b) direct API key to the Ollama cloud endpoint. If (b), user supplies/approves key handling; I will not create or assume one | ADR-009 |
| D3 | Confirm exact model tags to register (listed: `deepseek-v4.1-flash:cloud`, `glm-5.3-flash:cloud`, `gemma4:31b-cloud`, `minimax-m2.7:cloud`). I cannot verify these tags exist; `ollama list` hung in the earlier check | Router config |
| D4 | Python 3.11+ available? Permission to create a venv and install FastAPI/httpx/pydantic/pytest (new dependencies) | Environment |
| D5 | UAAP DB hosting (Option A/B) and whether a local Postgres is available; otherwise A2 uses an in-memory usage store and defers DB | Metering persistence |
| D6 | Authorization to `git init` `E:\SaaS` (or alternative change tracking) | Rollback |

## Tasks
| # | Task | Output | Tests / acceptance |
|---|---|---|---|
| A2-1 | Scaffold `services/uaap` (pyproject, ruff, mypy strict, pytest, import-linter rules from Service Boundaries) | Skeleton, CI script | lint/type/test green; `npm test` + `npm run typecheck` still unchanged |
| A2-2 | Settings & secret loading (pydantic-settings), env validation, redaction filter | `config.py`, `obs/redact.py` | startup fails on missing/forbidden config; secrets never in logs (test) |
| A2-3 | Provider interface + `OllamaProvider` (chat, JSON mode, streaming optional, model listing) | `gateway/providers/` | contract tests against a fake Ollama HTTP server; no live call without D2 |
| A2-4 | Model registry + capability routing (json, vision, long-context, cost tier) from YAML | `gateway/router.py`, `models.yaml` | routing table tests |
| A2-5 | Timeouts, bounded retries with jitter, circuit breaker, fallback chain | `gateway/resilience.py` | fault-injection tests: timeout, 429, 5xx, malformed JSON → typed errors; **no fabricated output** |
| A2-6 | Structured output: JSON-Schema validation + single repair retry | `gateway/structured.py` | invalid JSON cases |
| A2-7 | Token metering + per-tenant quotas/rate limits (in-memory store behind interface; Postgres impl after D5) | `gateway/metering.py` | tenant attribution; quota exceeded → `QUOTA_EXCEEDED` |
| A2-8 | `POST /v1/model/chat` + `/healthz` + `/readyz`; auth dependency validating principal via core `/v1/me` (stubbed in tests) | `api/` | 401/403/validation tests; cross-tenant usage isolation test |
| A2-9 | Error envelope + request-id propagation + audit event emit (interface) | `api/errors.py` | contract snapshot of OpenAPI |
| A2-10 | Security review + A2 completion report; ADR updates | docs | all gates in plan §6; live-model smoke test **only if D2/D3 resolved** |

## Out of scope for A2
Agents, LangGraph runtime, tool registry, DB migrations on ERP databases, Redis, any product adapter, any change to existing ERP code.

## Estimate
~10–12 working days of focused effort; live-provider verification depends on D2/D3.

