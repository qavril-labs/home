import type { AccountType } from "../../types";

export const ACCOUNT_SUBTYPE_SUGGESTIONS: Record<AccountType, string[]> = {
  ASSET: [
    "Cash & Cash Equivalents",
    "Current Assets",
    "Accounts Receivable",
    "Inventory",
    "Property, Plant & Equipment",
    "Contra Asset",
    "Other Assets",
  ],
  LIABILITY: [
    "Current Liabilities",
    "Accounts Payable",
    "Tax Liabilities",
    "Payroll Liabilities",
    "Credit Cards",
    "Long-term Debt",
  ],
  EQUITY: [
    "Contributed Capital",
    "Common Stock",
    "Retained Earnings",
    "Owner Distributions",
  ],
  REVENUE: [
    "Operating Revenue",
    "Product Sales",
    "Service Revenue",
    "Discounts & Returns",
    "Other Income",
  ],
  EXPENSE: [
    "Cost of Goods Sold",
    "Direct Materials",
    "Direct Overhead",
    "Operating Expenses",
    "Payroll Expenses",
    "Rent & Leases",
    "Depreciation & Amortization",
    "Tax & Regulatory",
  ],
};

const CODE_PATTERN = /^[0-9A-Za-z.-]{1,20}$/;

export function isValidAccountCode(code: string): boolean {
  return CODE_PATTERN.test(code.trim());
}

export function validateAccountForm(input: {
  code: string;
  name: string;
  type: string;
}): { code?: string; name?: string; type?: string } {
  const errors: { code?: string; name?: string; type?: string } = {};

  const trimmedCode = input.code.trim();
  if (!trimmedCode) {
    errors.code = "Account code is required.";
  } else if (!isValidAccountCode(trimmedCode)) {
    errors.code = "Account code must be 1 to 20 letters, digits, dots, or hyphens (e.g. 1010 or 10.10).";
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    errors.name = "Account name is required.";
  } else if (trimmedName.length > 120) {
    errors.name = "Account name must be under 120 characters.";
  }

  if (!["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].includes(input.type)) {
    errors.type = "Please select a valid account classification.";
  }

  return errors;
}
