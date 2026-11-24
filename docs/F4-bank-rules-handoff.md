# F4 handoff: bind the bank rules studio (FIN-04)

From: Claude Code (backend). To: Antigravity (frontend). Backend commit: `873a64c` on `chore/split-backend-frontend`.

## Prompt to give Antigravity

> Task F4: replace the sample data in `frontend/web/src/modules/finance/BankRecRulesModal.tsx` with the live bank rules API. Work only in `frontend/`. Read `contracts/openapi.yaml` (tag Banking) and `docs/ui-contract.md` first. Regenerate the client with `npm --prefix frontend run api:generate`. Show no money maths in the browser: every amount is a decimal string from the API. Remove the "Sample data" notice and `INITIAL_BANK_FEED_TRANSACTIONS` when the screen is live. Commit on `chore/split-backend-frontend` in `E:\SaaS` (backend is not committing right now).

## API (all need a signed-in session)

| Operation | Route | Permission |
|---|---|---|
| `listBankRules` | `GET /v1/banking/rules` | `fin.report.read` |
| `createBankRule` | `POST /v1/banking/rules` | `fin.journal.post` |
| `updateBankRule` | `PUT /v1/banking/rules/{id}` (replaces the whole rule) | `fin.journal.post` |
| `deleteBankRule` | `DELETE /v1/banking/rules/{id}` | `fin.journal.post` |
| `applyBankRules` | `POST /v1/banking/rules/apply` | `fin.journal.post` |
| `getBankLines` | `GET /v1/banking/lines?status=` | `fin.report.read` |
| `reconcileBankLine` / `unreconcileBankLine` | `POST /v1/banking/reconcile`, `/unreconcile` | `fin.journal.post` |

Rule fields: `name`, `priority` (1 to 10000, lower runs first), `active`, `direction` (`IN`, `OUT`, `ANY`), `descriptionContains`, `amountMin`, `amountMax`, `matchOn` (`amount`, `reference`, `amount_and_reference`), `amountTolerance`, `confidence` (1 to 100). Amounts are decimal strings.

## How it behaves (what the screen must say truthfully)

- Rules only suggest. Nothing posts to the ledger. A line becomes Reconciled only when a person confirms it (`reconcile`).
- Money in matches open invoices, money out matches open bills, by balance due. With no rule, a built-in default suggests when exactly one document has the same amount (confidence 80). Lines with `ruleId` absent came from that default.
- If several documents fit, the line stays `Unmatched`. `applyBankRules` and the import return an `ambiguous` count; show it as "needs a person to choose", not as an error.
- `confidence` is the number the tenant set on the rule. It is not a probability; label it "Rule confidence".
- `applyBankRules` re-evaluates `Unmatched` and `Suggested` lines only. Repeating it with nothing changed returns `changed: 0`.
- Errors: 409 (rule name already used), 400 (invalid rule: min above max, tolerance with `reference`, confidence outside 1 to 100, more than two decimals), 403 (the `user` role has no banking access). Use the plain wording from ui-contract section 8.
- The built-in `user` role now gets 403 on every `/v1/banking/*` route. The Bank Reconciliation page should show a plain "You do not have access" state, not a broken table.

## Done when

1. The modal lists, creates, edits, deletes and reorders rules (priority) against the live API, with loading, empty and error states.
2. "Run rules now" calls `applyBankRules` and shows evaluated, suggested, ambiguous, unmatched and changed counts.
3. Suggested lines show the rule name that produced them (`ruleName`) and the document (`matchedRef`, `matchedLabel`); Confirm calls `reconcile`.
4. `INITIAL_BANK_FEED_TRANSACTIONS` and the sample-data notice are gone; `frontend/web/src/lib/bank-reconciliation-rules.ts` no longer feeds the modal.
5. `npm --prefix frontend run build:web`, `npm --prefix frontend/web test`, and the bank reconciliation e2e spec pass, or each failure is explained.
6. Reply with what you changed and which checks you ran.

## Open points to flag back to backend

- No dry-run ("preview what this rule would match") endpoint exists. If the design needs it, file the request in `docs/antigravity-handoff.md` section 5; do not compute matches in the browser.
- Reconcile and unreconcile are not audited yet (backend task B5).
