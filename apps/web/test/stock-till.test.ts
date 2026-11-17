import { test, expect } from "vitest";
import { LiveApiError, reasonsOf } from "../src/lib/live-api.ts";

// The assertions below read as node:assert did; they are Vitest's expect underneath, so the repository runner collects them.
const assert = {
  equal: (actual: unknown, expected: unknown) => expect(actual).toBe(expected),
  deepEqual: (actual: unknown, expected: unknown) => expect(actual).toEqual(expected),
  match: (actual: string, pattern: RegExp) => expect(actual).toMatch(pattern),
};
import { formatAmount, formatQuantity, reasonInWords } from "../src/lib/live-format.ts";
import { isAccountCode, stockAccounts, tillAccounts, DEFAULT_POSTING_ACCOUNTS } from "../src/lib/posting-accounts.ts";
import { digitsOnly, amountText } from "../src/modules/stock/fields.tsx";
import {
  discountBody,
  emptyDiscount,
  emptyLine,
  isNetworkFailure,
  lineBody,
  newSaleId,
  priceBody,
  saleBody,
  tenderBody,
} from "../src/modules/till/saleBody.ts";

test("a line is sent as typed, and a blank discount is left out", () => {
  const body = lineBody({ ...emptyLine(), itemCode: " PARA-500 ", qty: "2", unitPrice: "10.00", description: " Paracetamol " });
  assert.deepEqual(body, {
    itemCode: "PARA-500",
    description: "Paracetamol",
    qty: "2",
    unitPrice: "10.00",
    taxRateBps: "1900",
    taxMode: "EXCLUSIVE",
    revenueAccount: "4000",
    tracked: true,
  });
  assert.equal("discount" in lineBody({ ...emptyLine(), discount: "  " }), false);
  assert.equal(lineBody({ ...emptyLine(), discount: "1.50" }).discount, "1.50");
});

test("a bill discount is sent only when an amount is typed, with its approval when there is one", () => {
  assert.equal(discountBody(emptyDiscount()), undefined);
  assert.deepEqual(discountBody({ amount: "10.00", reason: " Loyalty card ", approvalId: "" }), { amount: "10.00", reason: "Loyalty card" });
  assert.deepEqual(discountBody({ amount: "10.00", reason: "Loyalty card", approvalId: "3f0c" }), {
    amount: "10.00",
    reason: "Loyalty card",
    approvalId: "3f0c",
  });
});

test("a tender is sent with its method and its amount as typed", () => {
  assert.deepEqual(tenderBody({ method: "MOBILE", amount: " 5.00 " }), { method: "MOBILE", amount: "5.00" });
});

test("the price request drops payments not yet entered, and carries the threshold only when set", () => {
  const body = priceBody({
    companyId: "c1",
    warehouse: " COUNTER ",
    date: "2026-03-05",
    currency: "KES",
    lines: [{ ...emptyLine(), itemCode: "PARA-500", qty: "1", unitPrice: "10.00" }],
    tenders: [
      { method: "CASH", amount: "" },
      { method: "CARD", amount: "5.00" },
    ],
    discount: emptyDiscount(),
    discountApprovalAbove: "",
  });
  assert.equal(body.warehouse, "COUNTER");
  assert.deepEqual(body.tenders, [{ method: "CARD", amount: "5.00" }]);
  assert.equal("billDiscount" in body, false);
  assert.equal("discountApprovalAbove" in body, false);

  const withThreshold = priceBody({
    companyId: "c1",
    warehouse: "COUNTER",
    date: "2026-03-05",
    currency: "KES",
    lines: [emptyLine()],
    tenders: [],
    discount: { amount: "10.00", reason: "Loyalty", approvalId: "" },
    discountApprovalAbove: "5.00",
  });
  assert.equal(withThreshold.discountApprovalAbove, "5.00");
  assert.deepEqual(withThreshold.billDiscount, { amount: "10.00", reason: "Loyalty" });
});

test("a sale carries the id made on the device, so a retry is the same sale", () => {
  const sale = saleBody({
    id: "5f0d2c1e-7a5b-4c1d-9e2f-0a1b2c3d4e51",
    warehouse: "COUNTER",
    date: "2026-03-05",
    currency: "KES",
    lines: [{ ...emptyLine(), itemCode: "PARA-500", unitPrice: "10.00" }],
    tenders: [{ method: "CASH", amount: "11.90" }],
    discount: emptyDiscount(),
  });
  assert.equal(sale.id, "5f0d2c1e-7a5b-4c1d-9e2f-0a1b2c3d4e51");
  assert.equal("billDiscount" in sale, false);
  assert.deepEqual(sale.tenders, [{ method: "CASH", amount: "11.90" }]);
});

test("a sale id made on the device is a version 4 UUID, and is different each time", () => {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids = Array.from({ length: 50 }, () => newSaleId());
  for (const id of ids) assert.match(id, pattern);
  assert.equal(new Set(ids).size, ids.length);
});

test("only a connection that never reached the server counts as offline", () => {
  assert.equal(isNetworkFailure(new LiveApiError(0, "NETWORK", "The server cannot be reached right now.")), true);
  assert.equal(isNetworkFailure(new LiveApiError(409, "CONFLICT", "Refused.")), false);
  assert.equal(isNetworkFailure(new LiveApiError(401, "UNAUTHENTICATED", "Sign in again.")), false);
  assert.equal(isNetworkFailure(new Error("something else")), false);
});

test("the reasons a refused review sends back are read out of the error", () => {
  const refused = new LiveApiError(409, "CONFLICT", "The sale still cannot be posted", { reasons: ["PAYMENT_SHORT", "STOCK_SHORT: PARA-500"] });
  assert.deepEqual(reasonsOf(refused), ["PAYMENT_SHORT", "STOCK_SHORT: PARA-500"]);
  assert.deepEqual(reasonsOf(new LiveApiError(409, "CONFLICT", "Refused.")), []);
  assert.deepEqual(reasonsOf(new Error("plain")), []);
});

test("every reason the server gives has words a cashier can act on", () => {
  assert.match(reasonInWords("PAYMENT_SHORT"), /less than the total/);
  assert.match(reasonInWords("PERIOD_CLOSED: no open fiscal period covers 2025-06-10"), /closed period/);
  assert.match(reasonInWords("STOCK_SHORT: PARA-500 needs 4, 1 available"), /unexpired stock/);
  assert.equal(reasonInWords("SOMETHING_NEW"), "SOMETHING_NEW");
});

test("money is shown as the API sent it, with thousands separators and the currency", () => {
  assert.equal(formatAmount({ amount: "1234.50", currency: "USD" }), "$1,234.50");
  assert.equal(formatAmount({ amount: "-450.00", currency: "USD" }), "-$450.00");
  assert.equal(formatAmount({ amount: "1234.5", currency: "KES" }), "KES 1,234.50");
  assert.equal(formatAmount({ amount: "0.00", currency: "EUR" }), "€0.00");
  assert.equal(formatAmount(null), "—");
  assert.equal(formatQuantity("1234567"), "1,234,567");
  assert.equal(formatQuantity("12"), "12");
});

test("account codes accept the usual forms and refuse blanks and spaces", () => {
  assert.equal(isAccountCode("1300"), true);
  assert.equal(isAccountCode("EXP-500"), true);
  assert.equal(isAccountCode("10.10"), true);
  assert.equal(isAccountCode(""), false);
  assert.equal(isAccountCode("13 00"), false);
  assert.equal(isAccountCode("1300/1"), false);
});

test("the stock and till accounts are built from the same configuration", () => {
  const stock = stockAccounts(DEFAULT_POSTING_ACCOUNTS);
  assert.deepEqual(stock, { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100", countVariance: "5200" });
  const till = tillAccounts(DEFAULT_POSTING_ACCOUNTS);
  assert.equal(till.cash, "1000");
  assert.equal(till.taxPayable, "2100");
  assert.equal(till.inventory, "1300");
});

test("what the keyboard can type is limited to digits, and to one decimal point for money", () => {
  assert.equal(digitsOnly("1a2 3"), "123");
  assert.equal(amountText("12.3.4"), "12.34");
  assert.equal(amountText("abc"), "");
});
