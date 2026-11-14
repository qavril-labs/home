import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidAccountCode,
  validateAccountForm,
} from "../src/modules/accounts/accountHelpers.ts";
import { formatMoney } from "../src/lib/currency.ts";
import { initialMockAccounts } from "../src/lib/api-mock.ts";

test("Account Code Validation", () => {
  assert.equal(isValidAccountCode("1010"), true);
  assert.equal(isValidAccountCode("2000"), true);
  assert.equal(isValidAccountCode("10.10"), true);
  assert.equal(isValidAccountCode("EXP-500"), true);
  assert.equal(isValidAccountCode(""), false);
  assert.equal(isValidAccountCode("   "), false);
  assert.equal(isValidAccountCode("1010/20"), false);
  assert.equal(isValidAccountCode("1000?"), false);
});

test("Account Form Validation", () => {
  const valid = validateAccountForm({ code: "1010", name: "Operating Cash", type: "ASSET" });
  assert.equal(Object.keys(valid).length, 0);

  const invalidCode = validateAccountForm({ code: "", name: "Test", type: "ASSET" });
  assert.equal(invalidCode.code, "Account code is required.");

  const invalidName = validateAccountForm({ code: "1010", name: "", type: "ASSET" });
  assert.equal(invalidName.name, "Account name is required.");

  const invalidType = validateAccountForm({ code: "1010", name: "Test", type: "INVALID_TYPE" });
  assert.ok(invalidType.type?.includes("valid account classification"));
});

test("Standard 5-Category Coverage in Chart of Accounts", () => {
  const types = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
  types.forEach((t) => {
    const matching = initialMockAccounts.filter((a) => a.type === t);
    assert.ok(matching.length > 0);
  });
});

test("Standard Numbering Bands", () => {
  const assets = initialMockAccounts.filter((a) => a.type === "ASSET");
  const liabilities = initialMockAccounts.filter((a) => a.type === "LIABILITY");
  const equity = initialMockAccounts.filter((a) => a.type === "EQUITY");
  const revenue = initialMockAccounts.filter((a) => a.type === "REVENUE");
  const expenses = initialMockAccounts.filter((a) => a.type === "EXPENSE");

  assert.ok(assets.every((a) => a.code.startsWith("1")));
  assert.ok(liabilities.every((a) => a.code.startsWith("2")));
  assert.ok(equity.every((a) => a.code.startsWith("3")));
  assert.ok(revenue.every((a) => a.code.startsWith("4")));
  assert.ok(expenses.every((a) => a.code.startsWith("5") || a.code.startsWith("6")));
});

test("Protected Core System Accounts", () => {
  const systemAccounts = initialMockAccounts.filter((a) => a.isSystem);
  const systemCodes = systemAccounts.map((a) => a.code);

  assert.ok(systemCodes.includes("1010"));
  assert.ok(systemCodes.includes("1200"));
  assert.ok(systemCodes.includes("2000"));
  assert.ok(systemCodes.includes("3000"));
  assert.ok(systemCodes.includes("4000"));
  assert.ok(systemCodes.includes("5000"));
});

test("Balance Formatting & Zero Client Math", () => {
  const checking = initialMockAccounts.find((a) => a.code === "1010");
  assert.equal(formatMoney(checking.balance, "$"), "$42,150.00");

  const payables = initialMockAccounts.find((a) => a.code === "2000");
  assert.equal(formatMoney(payables.balance, "$"), "-$8,650.00");

  const accumulatedDepreciation = initialMockAccounts.find((a) => a.code === "1590");
  assert.equal(formatMoney(accumulatedDepreciation.balance, "$"), "-$8,500.00");
});

test("Search and Filtering Logic", () => {
  const byCode = initialMockAccounts.filter((a) => a.code.includes("1010"));
  assert.equal(byCode.length, 1);
  assert.ok(byCode[0].name.includes("Operating Checking"));

  const byName = initialMockAccounts.filter((a) => a.name.toLowerCase().includes("depreciation"));
  assert.ok(byName.length >= 2);

  const bySubtype = initialMockAccounts.filter(
    (a) => a.subtype && a.subtype.toLowerCase().includes("cost of goods sold")
  );
  assert.equal(bySubtype.length, 1);
  assert.equal(bySubtype[0].code, "5000");
});
