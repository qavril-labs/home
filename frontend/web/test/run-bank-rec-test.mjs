import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_BANK_FEED_TRANSACTIONS } from "../src/lib/bank-reconciliation-rules.ts";

test("FIN-04: Credit transactions match against open customer invoices with >= 95% confidence", () => {
  const creditTxs = INITIAL_BANK_FEED_TRANSACTIONS.filter((tx) => tx.rawType === "credit");
  assert.ok(creditTxs.length > 0, "Expected at least one credit bank feed transaction");

  for (const tx of creditTxs) {
    assert.equal(tx.reconciliationStatus, "suggested");
    assert.ok(tx.suggestedMatch, `Expected suggestedMatch on ${tx.id}`);
    assert.equal(tx.suggestedMatch.entityType, "invoice");
    assert.ok(
      tx.suggestedMatch.confidence >= 95,
      `Expected confidence >= 95 for ${tx.id}, got ${tx.suggestedMatch.confidence}`
    );
    assert.equal(tx.amount, tx.suggestedMatch.entityAmount);
  }
});

test("FIN-04: Debit supplier wires match against open vendor bills by reference number", () => {
  const billTx = INITIAL_BANK_FEED_TRANSACTIONS.find(
    (tx) => tx.rawType === "debit" && tx.suggestedMatch?.entityType === "bill"
  );
  assert.ok(billTx, "Expected a debit transaction matching a vendor bill");
  assert.equal(billTx.id, "tx-bank-102");
  assert.equal(billTx.referenceNumber, "WIRE-99382");
  assert.equal(billTx.suggestedMatch?.entityNumber, "BILL-99382");
  assert.equal(billTx.suggestedMatch?.entityName, "Precision Supplies Ltd");
  assert.equal(billTx.suggestedMatch?.entityAmount, "3639.75");
  assert.ok((billTx.suggestedMatch?.confidence ?? 0) >= 95);
});

test("FIN-04: Recurring cloud vendor debit matches to SG&A Expense Account 6300", () => {
  const awsTx = INITIAL_BANK_FEED_TRANSACTIONS.find(
    (tx) => tx.rawType === "debit" && tx.suggestedMatch?.entityType === "expense"
  );
  assert.ok(awsTx, "Expected a debit transaction matching an expense rule");
  assert.equal(awsTx.id, "tx-bank-103");
  assert.equal(awsTx.counterparty, "Amazon Web Services");
  assert.equal(awsTx.suggestedMatch?.entityNumber, "EXP-6300");
  assert.match(awsTx.suggestedMatch?.entityName ?? "", /6300/);
  assert.equal(awsTx.suggestedMatch?.entityAmount, "245.50");
  assert.ok((awsTx.suggestedMatch?.confidence ?? 0) >= 95);
});
