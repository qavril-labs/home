/**
 * The ledger accounts the stock and till screens post to. They come from this company's chart of accounts,
 * which the viewer names here. The codes are configuration, so they are kept per viewer in session storage and
 * never sent anywhere except as the accounts of a request.
 */

export interface PostingAccounts {
  inventory: string;
  clearing: string;
  cogs: string;
  writeOff: string;
  countVariance: string;
  cash: string;
  card: string;
  mobile: string;
  taxPayable: string;
  /** Bill discounts above this amount need an approver. Empty means there is no threshold. */
  discountApprovalAbove: string;
}

export const DEFAULT_POSTING_ACCOUNTS: PostingAccounts = {
  inventory: "1300",
  clearing: "2050",
  cogs: "5000",
  writeOff: "5100",
  countVariance: "5200",
  cash: "1000",
  card: "1010",
  mobile: "1020",
  taxPayable: "2100",
  discountApprovalAbove: "",
};

const STORAGE_KEY = "qavril-posting-accounts";

export function readPostingAccounts(): PostingAccounts {
  if (typeof window === "undefined") return { ...DEFAULT_POSTING_ACCOUNTS };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POSTING_ACCOUNTS };
    const parsed = JSON.parse(raw) as Partial<PostingAccounts>;
    const merged = { ...DEFAULT_POSTING_ACCOUNTS };
    for (const key of Object.keys(DEFAULT_POSTING_ACCOUNTS) as (keyof PostingAccounts)[]) {
      const value = parsed[key];
      if (typeof value === "string") merged[key] = value.trim();
    }
    return merged;
  } catch {
    return { ...DEFAULT_POSTING_ACCOUNTS };
  }
}

export function writePostingAccounts(accounts: PostingAccounts): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Storage can be blocked; the codes then last for this screen only.
  }
}

/** The four accounts every stock movement names, plus the variance account a count needs. */
export function stockAccounts(accounts: PostingAccounts) {
  return {
    inventory: accounts.inventory,
    clearing: accounts.clearing,
    cogs: accounts.cogs,
    writeOff: accounts.writeOff,
    countVariance: accounts.countVariance,
  };
}

/** The accounts a sale posts to: where each payment lands, tax payable, and the stock accounts. */
export function tillAccounts(accounts: PostingAccounts) {
  return {
    cash: accounts.cash,
    card: accounts.card,
    mobile: accounts.mobile,
    taxPayable: accounts.taxPayable,
    inventory: accounts.inventory,
    clearing: accounts.clearing,
    cogs: accounts.cogs,
    writeOff: accounts.writeOff,
    countVariance: accounts.countVariance,
  };
}

/** A ledger account code: letters, digits, dots and hyphens, up to 20 characters. */
export function isAccountCode(value: string): boolean {
  return /^[0-9A-Za-z.-]{1,20}$/.test(value);
}
