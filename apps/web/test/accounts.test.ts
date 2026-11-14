import { describe, expect, it } from "vitest";
import {
  isValidAccountCode,
  validateAccountForm,
} from "../src/modules/accounts/AccountDrawer";
import { formatMoney } from "../src/lib/currency";
import { initialMockAccounts } from "../src/lib/api-mock";
import type { Account, AccountType } from "../src/types";

describe("MDM-03 Chart of Accounts Master Data", () => {
  describe("Account Code Validation", () => {
    it("validates standard numerical and alphanumeric account codes", () => {
      expect(isValidAccountCode("1010")).toBe(true);
      expect(isValidAccountCode("2000")).toBe(true);
      expect(isValidAccountCode("10.10")).toBe(true);
      expect(isValidAccountCode("EXP-500")).toBe(true);
      expect(isValidAccountCode("6900.01")).toBe(true);
    });

    it("rejects invalid, empty, or special-character codes", () => {
      expect(isValidAccountCode("")).toBe(false);
      expect(isValidAccountCode("   ")).toBe(false);
      expect(isValidAccountCode("1010/20")).toBe(false);
      expect(isValidAccountCode("1000?")).toBe(false);
      expect(isValidAccountCode("A".repeat(25))).toBe(false); // over 20 chars
    });

    it("validates account form fields accurately", () => {
      const valid = validateAccountForm({
        code: "1010",
        name: "Operating Cash",
        type: "ASSET",
      });
      expect(Object.keys(valid)).toHaveLength(0);

      const invalidCode = validateAccountForm({
        code: "",
        name: "Test",
        type: "ASSET",
      });
      expect(invalidCode.code).toBe("Account code is required.");

      const invalidName = validateAccountForm({
        code: "1010",
        name: "",
        type: "ASSET",
      });
      expect(invalidName.name).toBe("Account name is required.");

      const invalidType = validateAccountForm({
        code: "1010",
        name: "Test",
        type: "INVALID_TYPE",
      });
      expect(invalidType.type).toContain("valid account classification");
    });
  });

  describe("Standard Chart of Accounts (initialMockAccounts)", () => {
    it("contains complete 5-category coverage", () => {
      const types: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
      types.forEach((t) => {
        const matching = initialMockAccounts.filter((a) => a.type === t);
        expect(matching.length).toBeGreaterThan(0);
      });
    });

    it("adheres to standard numbering bands", () => {
      const assets = initialMockAccounts.filter((a) => a.type === "ASSET");
      const liabilities = initialMockAccounts.filter((a) => a.type === "LIABILITY");
      const equity = initialMockAccounts.filter((a) => a.type === "EQUITY");
      const revenue = initialMockAccounts.filter((a) => a.type === "REVENUE");
      const expenses = initialMockAccounts.filter((a) => a.type === "EXPENSE");

      // 1000s Assets
      expect(assets.every((a) => a.code.startsWith("1"))).toBe(true);
      // 2000s Liabilities
      expect(liabilities.every((a) => a.code.startsWith("2"))).toBe(true);
      // 3000s Equity
      expect(equity.every((a) => a.code.startsWith("3"))).toBe(true);
      // 4000s Revenue
      expect(revenue.every((a) => a.code.startsWith("4"))).toBe(true);
      // 5000s & 6000s Expenses
      expect(expenses.every((a) => a.code.startsWith("5") || a.code.startsWith("6"))).toBe(true);
    });

    it("identifies protected core system accounts", () => {
      const systemAccounts = initialMockAccounts.filter((a) => a.isSystem);
      const systemCodes = systemAccounts.map((a) => a.code);

      expect(systemCodes).toContain("1010"); // Cash checking
      expect(systemCodes).toContain("1200"); // Accounts receivable
      expect(systemCodes).toContain("2000"); // Accounts payable
      expect(systemCodes).toContain("3000"); // Common stock
      expect(systemCodes).toContain("4000"); // Sales revenue
      expect(systemCodes).toContain("5000"); // COGS
    });
  });

  describe("Normal Balance Rules & Money Display", () => {
    it("formats account balances without client arithmetic", () => {
      const checking = initialMockAccounts.find((a) => a.code === "1010")!;
      expect(formatMoney(checking.balance, "$")).toBe("$42,150.00");

      const payables = initialMockAccounts.find((a) => a.code === "2000")!;
      expect(formatMoney(payables.balance, "$")).toBe("-$8,650.00");

      const accumulatedDepreciation = initialMockAccounts.find((a) => a.code === "1590")!;
      expect(formatMoney(accumulatedDepreciation.balance, "$")).toBe("-$8,500.00");
    });
  });

  describe("Search & Filtering Logic", () => {
    it("searches accounts by code, name, and subtype", () => {
      const byCode = initialMockAccounts.filter((a) => a.code.includes("1010"));
      expect(byCode).toHaveLength(1);
      expect(byCode[0]!.name).toContain("Operating Checking");

      const byName = initialMockAccounts.filter((a) =>
        a.name.toLowerCase().includes("depreciation")
      );
      expect(byName.length).toBeGreaterThanOrEqual(2); // Accumulated dep + Depreciation expense

      const bySubtype = initialMockAccounts.filter(
        (a) => a.subtype && a.subtype.toLowerCase().includes("cost of goods sold")
      );
      expect(bySubtype).toHaveLength(1);
      expect(bySubtype[0]!.code).toBe("5000");
    });
  });
});
