# Universal Finance Agent

**Date:** 2026-11-09 · **Code:** `services/uaap/src/uaap/agents/finance.py` · **Agent id:** `universal-finance-agent` · **Builds on:** [UAAP_A4_COMPLETION_REPORT.md](UAAP_A4_COMPLETION_REPORT.md)

The first named agent on UAAP. It is a Layer 2 shared agent (inventory item 2) and groundwork for catalog product AGT-03 (Finance close assistant).

## What it does

| Request | Tool | Tier | Result |
|---|---|---|---|
| "What does the trial balance look like?" | `ledger_get_trial_balance` | 1 | Answers straight away, quoting the ledger's own figures |
| "Accrue rent: debit 6100, credit 2100, USD 1,250.00" | `ledger_post_journal_entry` | 3 | Proposes the entry; it posts only after a different person approves |
| "Reverse entry `<id>`" | `ledger_reverse_journal_entry` | 3 | Proposes the reversal; it posts only after approval |
| Anything else (delete rows, SQL, roles, other topics) | none | none | Refuses without starting a run |

**Least privilege.** The agent holds two grants, `fin.report.read` and `fin.journal.post`, and three tools. It cannot create accounts. Whatever the agent does is also limited to what the signed-in user is allowed to do.

## How it decides

The model (through `GatewayModelClient`, which uses JSON-schema output, model fallback, metering and audit) only picks the intent and copies details from the user's message. Code, not the model, controls the following:

- **Company.** The company always comes from the request; the model's output schema has no company field.
- **Reference and idempotency key.** The agent generates the document reference (`UFA-…`), which is also the idempotency key.
- **Figures must come from the user.** Every amount, account code, currency and entry id in a proposal must appear in the user's own message. Amounts are compared as decimal values, so `1,250.00`, `1250` and `1250.0` all match. If a figure doesn't appear, the agent asks for it instead of guessing. The model never calculates amounts (ADR-011), and the ledger checks that the entry balances.
- **Answers quote the ledger.** Replies about figures are built from the ledger's own decimal strings, not written by the model.
- **The user's message is data.** It reaches the model wrapped in `<user_request>` tags.
- **Failures are reported.** A model or product failure returns status `failed` with the error code, never a made-up answer.

## Approval flow (in-process)

1. `handle(caller, FinanceRequest)` returns `awaiting_approval` with the approval record, its summary and a single-use `approval_token`.
2. The token must reach the approver through a channel the initiator cannot see. No notification channel exists yet (PLT-10).
3. `approve(approver, run_id=…, approval_id=…, approval_token=…, confirmed_payload=…)` posts the entry under the approver's credentials. The approver must be a different person and must hold `fin.journal.post`.
4. `reject(approver, …)` closes the proposal; nothing posts.

## Verification

Eighteen agent tests cover:
- trial-balance answers;
- the full propose-then-approve flow;
- self-approval refused;
- rejection;
- invented amounts, account codes and currencies refused;
- equivalent decimal forms accepted;
- reversals needing the user's entry id;
- out-of-scope requests;
- model and product failures;
- a user without permission;
- the path through the real gateway client and the fake model server;
- the agent's registration in the service.

Full run on 2026-11-09: 160 tests passed, ruff and strict mypy were clean, and `lint-imports` kept 4 of 5 contracts. The broken contract is the A2 one from before this work. The new contract stops agents from importing product adapters, the tool executor, model providers or the API. Agents still reach the executor indirectly, through the runner, by design.

## Limits

- The figure check confirms that each figure appears in the message, not which line it belongs to. A model that swaps debit and credit accounts the user named would still produce a valid-looking proposal. The approver reviewing the exact lines is the control for that.
- The user must give account codes. There is no chart-of-accounts read endpoint in Core SaaS yet, so the agent cannot map "rent expense" to `6100`.
- There is no HTTP endpoint yet. Starting runs and approving them over HTTP needs a decision on how approval tokens reach approvers.
- Live models are still disabled (A2 settings guard). Tests use scripted plans and the fake Ollama server.
