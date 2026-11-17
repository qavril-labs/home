# Inventory and till screens: specification

Status: specification for the Antigravity frontend lane. The backend endpoints behind these screens are built and tested
(`contracts/openapi.yaml`, `apps/api/test/workflows.test.ts`). The screens are not built. CLAUDE.md gives `frontend/` to
the Antigravity lane, so the backend lane does not edit it.

Each screen follows `docs/ui-contract.md`: tokens from `frontend/design/`, responsive at phone width with a 16px gutter,
and every label translatable. Money is always shown with its currency. Quantities are whole units.

## Inventory

### 1. Stock by batch (list)
- Purpose: see what is on hand, where, when it expires, and what it cost.
- Data: `GET /v1/inventory/batches?companyId&warehouse&item`. Balance is derived from movements, so show `balance`, not `receivedQty`.
- Show: item, warehouse, batch number, expiry date, days left, balance, unit cost.
- Flag rows whose expiry is past (expired) or within 30 days (expiring). Use the same windows as the expiry report.
- Permission: `inv.report.read`.

### 2. Pharmacy expiry report
- Data: `GET /v1/inventory/expiry?companyId&asOf&withinDays`.
- Show the two lists, expired and expiring, then the value at risk for each (`expiredValue`, `expiringValue`).
- Each expired row links to a write-off request. Do not show a write-off button for a row that has no expired stock.
- Permission: `inv.report.read`.

### 3. Receive goods
- Data: `POST /v1/inventory/receipts`. Fields: warehouse, item, batch number, expiry (required where the item requires it),
  quantity, unit cost, date, reference.
- Show the server's validation message next to the field it names. A repeated reference returns the existing batch.
- Permission: `inv.stock.receive`.

### 4. Transfer between warehouses
- Data: `POST /v1/inventory/transfers`. Show the batches the stock will leave, first to expire first, before the user confirms.
- Say plainly that a transfer posts no ledger entry.
- Permission: `inv.stock.transfer`.

### 5. Write-off requests and the approval inbox
- A write-off is a request: `POST /v1/inventory/write-offs` returns 202 with a pending approval. Show "Waiting for approval",
  never "Written off".
- The requester cannot approve their own request. Hide the approve button for the requester.
- Inbox: `GET /v1/approvals?companyId&status=PENDING`. Approve or reject with `POST /v1/approvals/{id}/approve|reject`.
  Rejection needs a note of at least five characters. An approved write-off response carries `effect` with the outcome.
- Permissions: `inv.stock.writeoff` to request, `approvals.decide` to decide.

### 6. Stock count (blind)
- Counter flow: start a count of a warehouse (`POST /v1/inventory/counts`), then record each batch's counted quantity
  (`POST /v1/inventory/counts/{id}/lines`), then submit (`POST /v1/inventory/counts/{id}/submit`, which needs a reason).
- **Blind count rule:** while a count is OPEN, do not show the expected quantity or the variance. The API omits them for
  people without `inv.count.review`. The screen must not reconstruct them from other data.
- After submission the count shows "Waiting for approval". A rejected count returns to OPEN with the note, so the counter can recount.
- Reviewer view (`inv.count.review`): expected and variance are shown once the count is no longer OPEN.
- Permissions: `inv.count.manage` to count, `inv.count.review` to see expected quantities.

### 7. CSV import of receipts
- Upload a CSV (columns: warehouse, item, batch_no, expires_on, qty, unit_cost, date, reference). The default is a dry run.
- Show every bad row with its file row number. A file with any bad row is not imported, so say so.
- After a real import, show the reconciliation: stock account before, after, the change, the expected change, and "Reconciled" only
  when `reconciliation.reconciled` is true.
- Permission: `inv.stock.import`.

## Till

### 8. Sale entry (works offline)
- Lines: item, quantity, unit price, item discount, tax rate and mode, revenue account, and whether the item is stocked.
- Bill discount: amount and a required reason. If the amount is above the company threshold, the till asks for a manager's
  approval first, by raising a `POS_BILL_DISCOUNT` request (`POST /v1/approvals`) with `{saleId, amount}`.
- Payments: split between cash, card and mobile money. Change is shown only when cash covers it.
- Each sale gets a UUID on the device before it is saved, so syncing twice never posts twice.
- Sync: `POST /v1/pos/sales/sync` in batches. Show each sale's result: POSTED with its receipt number, NEEDS_REVIEW with
  its reasons, or REJECTED. Keep REJECTED sales on the device so they can be resent.

### 9. Review queue (sales that need a decision)
- List: `GET /v1/pos/sales?companyId&status=NEEDS_REVIEW&pending=true`.
- Show the reasons in plain words:
  - `PAYMENT_SHORT`: the payments add up to less than the total. Offer to add the missing payment.
  - `CHANGE_NOT_FROM_CASH`: change is owed but no cash was taken.
  - `STOCK_SHORT`: not enough unexpired stock. Show what is available.
  - `PERIOD_CLOSED`: the sale's date is in a closed period. Offer a date in an open period.
  - `DISCOUNT_NEEDS_APPROVAL` / `DISCOUNT_REASON_MISSING`: the bill discount needs approval or a reason.
- Actions: "Post now" (`decision: POST`, with reconciled payments and a date) or "Void" (`decision: VOID`, with a reason).
  A refused post returns 409 with the reasons. Show them and change nothing.
- A decided sale leaves the pending list. Its `resolution` shows who decided, when, and the outcome.
- Permissions: `pos.sale.read` to list, `pos.sale.review` to decide.

## Rules every screen follows
- Never show an action the server will refuse. Hide it, or show it disabled with the reason.
- Show the reference of a posted movement (the ledger entry or receipt number), so an accountant can trace it.
- Offline: the till works without a connection. Only the sync and the review queue need one. Show the time of the last successful sync.
- Accessibility: every reason and every status has text, not colour alone.
