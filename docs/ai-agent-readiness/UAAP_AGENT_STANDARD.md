# UAAP Agent Standard (applies to every agent and bot)

**Date:** 2026-11-10 · **Code:** `services/uaap/src/uaap/agents/base.py`, `guardrails.py`, `obs/metrics.py`

The standard exists so that no agent hallucinates or shows random data. It is enforced in code, so following it is not optional:

- **Registration.** `AgentCatalog.add` refuses any agent whose card is incomplete or disagrees with the tool registry. The service only starts agents through the catalog.
- **Fixed pipeline.** `BaseAgent.respond()` runs every guardrail around the agent's own `_handle()`. A conformance test fails if an agent overrides `respond`, `ask_model`, `run_tool`, `approve`, `error_reply` or the grounding step.
- **Conformance tests.** `tests/agents/test_conformance.py` checks every agent in service automatically. A new bot is covered as soon as it is added to the catalog.

## 1. Agent card (required content)

| Field | Rule |
|---|---|
| Use cases | At least one. Each names its tool and tier, and the tier must match the registry. Every granted tool must be documented by a use case. |
| Case stories | At least one: actor, situation, at least two steps, outcome. |
| Edge cases | At least five. Each names the test that proves it, and the conformance test checks that the test exists. |
| Out of scope | At least one item. |
| Guardrails | All twelve mandatory guardrails (section 2). |
| Error handling | A user-facing message for every mandatory error code (section 4). Messages may not contain figures. |
| KPIs | At least one, with a target. |
| Data sources | Where every figure the agent may state comes from. |

## 2. Mandatory guardrails

| Guardrail | Where enforced |
|---|---|
| `INPUT_LIMITS` | `respond()`: empty input asks for detail; input over `UAAP_AGENT_MAX_INPUT_CHARS` (default 4000) is refused. Neither reaches the model. |
| `PII_REDACTION` | `respond()`: Luhn-valid card numbers, US SSNs, Aadhaar and PAN numbers are masked before the model sees them. |
| `INJECTION_DETECTION` | `respond()`: instruction-override phrases are flagged and counted. They are not blocked, because the controls below hold whatever the wording. |
| `DATA_DELIMITING` | `ask_model()`: user text is always wrapped in `<user_request>` tags. |
| `SCHEMA_OUTPUT` | `ask_model()` and the gateway: output must match a JSON schema, with one repair attempt, or the request fails. |
| `GROUNDED_FIGURES` | In each agent: every figure, account, date and id it acts on must appear in the user's message or in tool output. |
| `GROUNDED_REPLY` | `respond()` and `approve()`: before any reply is shown, every number, date and UUID in it is checked against the sources. If one has no source, the reply is withheld; a proposal that contains one is cancelled. |
| `NO_MODEL_ARITHMETIC` | Figures are copied, never computed, by the model; products calculate. |
| `SCOPE_LIMIT` | Requests outside the use cases are refused without starting a run. |
| `TIERED_TOOLS` | `run_tool()`: every product action is a run through the tier engine (A4). |
| `HUMAN_APPROVAL` | Tier 3 actions wait for a different person, who approves with their own credentials. |
| `NO_FABRICATED_FALLBACK` | Every failure maps to the card's message for that error code. No placeholder answers are ever shown. |

## 3. Metrics (per agent, per tenant)

Recorded for every request, plus approvals:
- requests, outcome status counts, answer rate and failure rate;
- error codes;
- guardrail events (`UNGROUNDED_REPLY`, `PII_REDACTED`, `INJECTION_SUSPECTED`, …);
- approvals requested, approved and rejected;
- tool calls and model calls;
- latency p50, p95 and max.

Each reply also writes an `agent.reply` audit event. Metrics are held in memory until A5.

## 4. Mandatory error codes

`INTERNAL`, `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOOL_BLOCKED`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `UPSTREAM_FAILED`, `UPSTREAM_TIMEOUT`, `UPSTREAM_INVALID_RESPONSE`, `UNGROUNDED_REPLY`, `AGENT_DISABLED`. Replies carry `error_code` so clients don't have to parse text.

## 5. Admin console

The console is at `/admin` (the page) and `/v1/admin/*` (JSON). Every JSON endpoint needs the `X-Admin-Key` header. The console is off unless `UAAP_ADMIN_KEY` (32+ characters) is set, and wrong keys are audited.

| Endpoint | Shows |
|---|---|
| `GET /v1/admin/config` | Environment, model gateway, limits, Core SaaS endpoint and database settings: host, port, database, user, schema, pool, SSL mode and statement timeout. Passwords and keys are shown only as "set" or "not set". |
| `GET /v1/admin/checks` | Ok, warn and fail checks: settings, database TCP reachability and TLS, Core SaaS `/health`, model provider, each agent's card, tool registry, and storage durability. |
| `GET /v1/admin/agents` | Each agent's card (use cases, case stories, edge cases, error handling, KPIs), grants, tools and live metrics. |
| `GET /v1/admin/metrics?tenant_id=` | Metrics, optionally for one tenant. |
| `GET /v1/admin/tools` | Registered tools, tiers, permissions and blocked status. |
| `POST /v1/admin/agents/{id}/disable` | Kill switch. The agent stops answering and cannot call tools. |

Database settings (`UAAP_DATABASE_URL`, `_SCHEMA`, `_POOL_MIN`, `_POOL_MAX`, `_STATEMENT_TIMEOUT_MS`, `_SSL_MODE`) are validated at startup. Staging requires `require` or `verify-full` TLS. The database check proves TCP reachability only; credentials, schema and row-level security are tested when A5 provisions the database.

## 6. Adding a new bot

1. Subclass `BaseAgent`. Set `card`, `principal` and `system_prompt`, and implement `_handle()` using `ask_model()` and `run_tool()`.
2. Write the card, and write the test for every edge case.
3. Add the agent to `_CATALOG` in `api/deps.py`. The conformance test then checks it automatically.
