import { DomainError } from "@erp/kernel";

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly active: boolean;
}

const CODE_PATTERN = /^[0-9A-Za-z.-]{1,20}$/;

export function createAccount(input: { code: string; name: string; type: string }): Account {
  if (!CODE_PATTERN.test(input.code)) {
    throw new DomainError("VALIDATION", "Account code must be 1 to 20 letters, digits, dots, or hyphens");
  }
  const name = input.name.trim();
  if (name.length === 0 || name.length > 120) {
    throw new DomainError("VALIDATION", "Account name must be 1 to 120 characters");
  }
  if (!(ACCOUNT_TYPES as readonly string[]).includes(input.type)) {
    throw new DomainError("VALIDATION", `Account type must be one of ${ACCOUNT_TYPES.join(", ")}`);
  }
  return { code: input.code, name, type: input.type as AccountType, active: true };
}
