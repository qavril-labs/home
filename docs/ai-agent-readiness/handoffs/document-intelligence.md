# Handoff: B7 Document Intelligence (screens and browser tests)

**From:** Claude Code (backend lane) · **Date:** 2026-11-23 · **For:** Antigravity (frontend lane)
**Code:** standalone repository `qavril-labs/uaap`, branch `feat/portable-bots` (not yet committed or pushed), file `src/uaap/agents/document_intelligence.py`.

## What the bot is

A deterministic bot (no model). The user pastes invoice text; the bot reads the fields and checks the arithmetic. It saves, posts and pays nothing. Agent id: `document-intelligence`.

## API operation

`POST /v1/agents/document-intelligence/messages` (the same endpoint as every bot; listed by `GET /v1/agents`).

Request body: `{"message": "<invoice text>", "company_id": null, "today": "YYYY-MM-DD"}`. The message limit is the service's `agent_max_input_chars` (4000 by default); show a counter and refuse longer text before sending.

Supported layout, one item per line, ISO dates only:

```
Supplier: Acme Ltd
Invoice No: INV-2041
Date: 2026-11-03
Currency: USD
Paper 10 x 2.50 = 25.00
Subtotal: 40.00
Tax: 4.00
Total: 44.00
```

## Example response (READY)

`status: "answered"`, `data`:

```json
{
  "readiness": "READY",
  "fields": {"supplier": "Acme Ltd", "invoice_number": "INV-2041", "invoice_date": "2026-11-03",
             "currency": "USD", "subtotal": "40.00", "tax": "4.00", "total": "44.00"},
  "lines": [{"desc": "Paper", "qty": "10", "unit": "2.50", "amount": "25.00"}],
  "missing": [],
  "problems": []
}
```

Amounts are decimal strings exactly as written in the document. Never convert them to numbers in the screen.

## What the screen must show

| `data.readiness` | `status` | Show |
|---|---|---|
| `READY` | `answered` | The fields in a review table. Nothing is saved; no "save" or "post" button in this version. |
| `PARTIAL` | `answered` | The fields that were read, then `missing` (each name) and `problems` (each text, which names both sides of the calculation). |
| `BLOCKED` | `needs_clarification` | The reply text asking for invoice text. No table. |

Error codes follow the standard bot errors; the reply text is already user-safe. `guardrail_events` may contain `PII_REDACTED`: show a notice, because long digit strings (such as account numbers) are masked before reading.

## Approval flow

None. The bot proposes nothing, so there is no approvals-inbox step.

## Limits to state on the screen

- Text only. Images, PDFs and OCR need file storage (PLT-11) and are not supported.
- Invoices only; contracts are not supported.
- Dates must be `YYYY-MM-DD`. Other layouts return `PARTIAL` or `BLOCKED`; the bot never guesses.

## Tests the screen should cover (6b)

Paste a clean invoice and see READY; remove the currency line and see `missing` listed; change a line amount and see the failed check; paste unrelated text and see BLOCKED; paste over the length limit and see it refused before sending.

## Open items

- No catalog product id exists for Document Intelligence (`ERP-Product-Catalog.md` has no row), so entitlement is unassigned until F3 adds one.
- The contract (`contracts/openapi.yaml`) lists bots by `GET /v1/agents`, so no schema change is needed; confirm the screen reads `data` as a free-form object.
