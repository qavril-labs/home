# Bot build split: Claude Code and Antigravity (by part)

**Date:** 2026-11-11 · **Status:** Agreed by both tools (see [../plan-review.md](../plan-review.md)); owner sign-off pending · **Applies to:** every agent and bot

Every bot is split **by part**, not the bot list by half. This follows [../build-plan.md](../build-plan.md) section 4 and [../../AGENTS.md](../../AGENTS.md): Claude Code is the backend lane, Antigravity the frontend lane, and no folder is written by both.

## 1. The six parts of every bot

| Part | What it is | Owner | Where |
|---|---|---|---|
| 1. Signals | Core SaaS read API returning exactly the figures the bot reads | Claude Code | `apps/api/`, `packages/*` |
| 2. Brain | Agent or deterministic bot logic, guardrails, prompts, tool calls, agent card | Claude Code | `services/uaap/` |
| 3. Action and approval | Tools with tiers and limits, drafts, approvals inbox, audit, kill switch | Claude Code | `services/uaap/`, `apps/api/` |
| 4. Delivery | In-app alerts, and email and WhatsApp once PLT-10 exists | Claude Code | `services/uaap/`, `packages/*` |
| 5. Screens | `BotCard`, bot page, approvals inbox and review modals, on/off switch, charts and 3D | Antigravity | `apps/web/` |
| 6. Tests | 6a unit evaluations and conformance (Claude Code); 6b Playwright end-to-end tests (Antigravity) | Both | `services/uaap/tests/`, `tests/e2e/` |

**The contract between the lanes** is the API: `apps/api/openapi.yaml` and the generated `packages/api-client/`, which will cover UAAP's `/v1/agents` and `/v1/approvals` too. Antigravity calls nothing else. A bot is done when all six parts exist.

## 2. Ground rules

1. **The agent standard is mandatory** for parts 2–4 ([UAAP_AGENT_STANDARD.md](UAAP_AGENT_STANDARD.md)).
2. **Data first.** A bot's part 2 is built only after its part 1 signals exist. Until then it is **Blocked** below.
3. **Separate worktrees.** Claude Code works in `E:\SaaS` on `lane/backend`, Antigravity in `E:\SaaS-web` on `lane/frontend`; both merge into `main` by pull request.
4. **Screens follow the API, never the reverse.** Antigravity mocks from the generated client until the endpoint ships.

## 3. Platform steps (Claude Code) and what they unblock

| Step | Delivers | Unblocks |
|---|---|---|
| F1 | A5 durability sign-off (restart-survival test) | Everything |
| F0 | First commit, `lane/backend` and `lane/frontend`, worktree `E:\SaaS-web` (needs owner go-ahead) | Parallel work |
| C0 | `openapi.yaml` and `packages/api-client/`, including the bot and approvals endpoints | All screens |
| F2 | Industry Pack SDK: manifest, registries, policy, `READY` / `PARTIAL` / `BLOCKED`, provenance, release gates | Pack bots |
| F3 | Catalog rows for the 32 suites and the GAR and FMCG agents | Licensing |
| F4 | Outbox worker (A6) | Event-driven bots |
| D0 | Deterministic-bot base class (no model) and its card rules | Deterministic bots |

## 4. Bots and status

Status: **Ready** = signals exist · **After X** = waits for that step · **Blocked** = needs an ERP module.

| # | Bot | Type | Signals (part 1) | Status | Screens (part 5) |
|---|---|---|---|---|---|
| B1 | Universal Finance Agent | Agent | Ledger API | Brain done | Ready for Antigravity |
| B2 | Approval Agent (AGT-06) | Agent | Approvals inbox API | Ready | Approvals inbox |
| B3 | Ledger Invariant Checker | Deterministic | Trial balance | After D0 | Bot card, findings list |
| B4 | Approval Reminder | Deterministic | Approvals inbox | After D0 | Alerts in inbox |
| B5 | Outbox Worker | Deterministic | Core outbox | Is F4 | Admin status only |
| B6 | Dead-Letter Monitor | Deterministic | Outbox dead letters | After F4 | Admin alerts |
| B7 | Document Intelligence | Agent | Document text in the request; storage needs PLT-11 | After a `doc_extract_fields` tool | Upload and review modal |
| B8 | Lead Nurturing | Deterministic | Leads read API (to be added in Core SaaS) | After that API | Leads list |
| B9 | GAR08 Garment Costing | Agent | Configured rates and consumption | After F2, F3 | Cost sheet |
| B10 | GAR02 Tech Pack | Agent | Supplied specifications | After F2, F3 | Tech pack editor |
| B11 | FMCG06 Shelf Life & Expiry | Agent | Batch dates, approved shelf-life rules | After F2, F3 | Expiry board |
| B12 | FMCG12 Labelling Check | Agent | Approved, versioned rule sets | After F2, F3 | Label check report |
| B13 | Reporting Agent | Agent | More Core SaaS read APIs | Deferred: the Finance Agent covers the only read API today | |
| B14 | Finance Close Assistant (AGT-03) | Agent | Periods, reconciliations | Blocked: FIN-13 | |
| B15 | Procurement Agent | Agent | POs, suppliers | Blocked: PRC | |
| B16 | Replenishment Agent (AGT-04) | Agent | Stock, sales velocity | Blocked: INV-05 | |
| B17 | Customer Support Agent (AGT-05) | Agent | Knowledge base | Blocked: SAL-11 | |
| B18 | Sales Assistant (AGT-02) | Agent | Quotes, pipeline | Blocked: SAL-01 quotes | |
| B19 | Notification Bot | Deterministic | PLT-10 provider | Blocked: PLT-10 | |
| B20 | GAR10 / FMCG07 Inventory and Distribution | Agent | Inventory, batches | Blocked: INV | |

The remaining GAR and FMCG agents are added when their ERP modules ship.

## 5. Handoff between lanes

When parts 1–4 of a bot are done, Claude Code writes `docs/ai-agent-readiness/handoffs/<bot-id>.md` with:
- the API operations;
- example responses;
- the statuses and error codes the screen must show;
- the approval flow.

Antigravity builds parts 5 and 6b from that note and the generated client.

## 6. Bot prompt template (backend parts 1–4; same layout for every bot)

Copy this block, fill in every field, and give it to whichever tool owns the bot. A blank field means the bot is not ready to build.

```
# BOT BUILD PROMPT: <ID> <Name>   (parts 1–4: Claude Code · parts 5, 6b: Antigravity)

## 0. Read first
- CLAUDE.md, ERP-Product-Catalog.md, docs/ai-agent-readiness/UAAP_AGENT_STANDARD.md,
  docs/ai-agent-readiness/BOT_BUILD_SPLIT.md
- Existing reference: services/uaap/src/uaap/agents/finance.py and its tests

## 1. Identity
- Bot id / catalog product id: <e.g. GAR08 / GAR-08>
- Type: Agent (uses a model) | Deterministic bot (no model)
- Pack: <shared | garments | fmcg | ...>   Version: 1.0.0
- Owner team: <...>

## 2. Purpose (one sentence)
<What it does for whom.>

## 3. Data readiness
| Required input | Source (ERP API, uploaded document, approved configuration, verified external source) | Available now? |
|---|---|---|
Readiness rule: return READY, PARTIAL (name each missing input) or BLOCKED. Never fill a gap.

## 4. Tools (A4 registry)
| Tool | Endpoint | Tier (1 read / 2 draft / 3 approval / 4 operational) | Permission |
|---|---|---|---|
Tier 5 actions this bot must never attempt: <...>

## 5. Use cases (at least one per tool)
| Title | Example request | Outcome | Tool | Tier |
|---|---|---|---|---|

## 6. Case stories (at least one)
- Title / actor / situation / steps (at least two) / outcome

## 7. Edge cases (at least five, each with a named test)
| Situation | Expected behaviour | Test function name |
|---|---|---|

## 8. Calculations and provenance
- Every figure in an output names its source: ERP transaction id, document id, configuration
  id and version, or calculation id.
- Calculations are deterministic code, never the model. List each formula: <...>
- Money uses decimal strings; no floats.

## 9. Policies and regulated content
- Rule sets used (id and version): <...>  Approved by: <...>
- The bot checks against rules; it never writes or interprets new rules.

## 10. Out of scope
- <...>

## 11. Error handling
User message for every mandatory error code (no figures in messages):
INTERNAL, VALIDATION, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, TOOL_BLOCKED,
RATE_LIMITED, QUOTA_EXCEEDED, UPSTREAM_FAILED, UPSTREAM_TIMEOUT,
UPSTREAM_INVALID_RESPONSE, UNGROUNDED_REPLY, AGENT_DISABLED, plus bot-specific codes.

## 12. KPIs
| KPI | Description | Target |
|---|---|---|

## 13. Grants and licensing
- Agent grants (least privilege, never "*"): <...>
- Catalog dependencies and entitlement product id: <...>

## 14. Files you may create or edit
- Backend: apps/api/ (signals), services/uaap/src/uaap/packs/<pack>/, services/uaap/tests/
- Frontend (separate prompt, Antigravity): apps/web/, tests/e2e/ only, from the handoff note

## 15. Definition of done
- AgentCard complete; conformance test passes; every edge case has a passing test
- ruff, mypy (strict) and lint-imports clean; full suite green
- Evaluation dataset added with expected outputs
- Readiness, provenance and tenant-isolation tests pass
- Signals endpoint in openapi.yaml; client regenerated
- Handoff note written to docs/ai-agent-readiness/handoffs/<bot-id>.md for the screens
```

## 7. Filled example: GAR08 (abridged)

- **Identity:** GAR08 Garment Costing & Pricing · Agent · Pack: garments · Parts 1–4 Claude Code, parts 5 and 6b Antigravity
- **Purpose:** produce a cost sheet and price scenarios for a garment style from approved rates and consumption.
- **Data readiness:** fabric consumption per size (tech pack, GAR02); fabric and trim rates (approved configuration); labour SAM and rate (approved configuration); overhead percentage (approved configuration). If any one is missing, the result is `PARTIAL` with that input named.
- **Calculations:** `cost = Σ(consumption × rate) + SAM × labour rate + overhead`. Deterministic, in decimal strings, with each line citing its configuration id and version.
- **Out of scope:** guessing any rate; currency conversion without a configured rate; customer quotes above Tier 2 without approval.
