export type StatusType = "good" | "watch" | "act" | "idle";

export interface BotInsight {
  id: string;
  name: string;
  role: string;
  color: string; // Token accent name: lime, pink, violet, cyan, yellow, orange
  status: StatusType;
  statusText: string;
  foundText: string;
  nextText: string;
  hasDraft?: boolean;
  draftType?: string;
  draftLabel?: string;
  actionVerb?: string;
  updatedAt?: string;
}

export interface MonthlyTrend {
  month: string; // e.g. "Jun", "Jul"
  sales: string; // decimal string
  expenses: string; // decimal string
  salesRaw: number;
  expensesRaw: number;
}

export interface WorkspaceTotals {
  cash: string;
  revenue: string;
  expenses: string;
  profit: string;
}

export interface WorkspaceInsights {
  company: string;
  workspaceName: string;
  currency: string;
  asOf: string;
  totals: WorkspaceTotals;
  trend: MonthlyTrend[];
  bots: BotInsight[];
}

export interface QuickEntryPayload {
  kind: "sale" | "expense" | "customer_payment" | "owner_investment";
  amount: string;
  partyName: string;
  date: string;
  description: string;
  account?: string;
}

export interface RecentEntry {
  id: string;
  date: string;
  kind: string;
  description: string;
  party: string;
  amount: string;
  status: "posted" | "draft" | "review";
}

export interface Contact {
  id: string;
  name: string;
  type: "customer" | "supplier" | "both";
  email: string;
  phone: string;
  balance: string; // decimal string
  status: "active" | "hold" | "archived";
  taxId?: string;
  city?: string;
}

export type PartyType = "customer" | "supplier" | "both";
export type PartyStatus = "active" | "inactive";
export type PaymentTerms = "Due on Receipt" | "Net 15" | "Net 30" | "Net 60" | "Net 90";

export interface PartyAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Party {
  id: string;
  type: PartyType;
  legalName: string;
  tradeName: string;
  taxRegistrationNumber: string;
  contactPerson: string;
  email: string;
  phone?: string;
  currency: string;
  paymentTerms: PaymentTerms;
  billingAddress: PartyAddress;
  shippingAddress: PartyAddress;
  sameAsBilling?: boolean;
  outstandingBalance: string; // decimal string, e.g. "3450.00" or "-1240.50"
  status: PartyStatus;
}

export type ItemType = "goods" | "service" | "bundle";

export interface ProductItem {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  type: ItemType;
  category: string;
  unit: string;
  unitPrice: string; // decimal string
  costPrice?: string; // decimal string
  taxCode?: string;
  stockQuantity: number;
  reorderPoint: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  description?: string;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  side: "DEBIT" | "CREDIT";
  amount: string; // decimal string
}

export interface UnpostedEntry {
  id: string;
  reference: string;
  date: string;
  memo: string;
  source: string;
  lines: JournalLine[];
  debitTotal: string; // decimal string
  creditTotal: string; // decimal string
  isBalanced: boolean;
}

export interface MonthEndChecklistItem {
  id: "bank_rec" | "unallocated_cash" | "unposted_depreciation" | "period_lock";
  title: string;
  description: string;
  targetAccount: string;
  status: StatusType;
  statusLabel: string;
  figures: { label: string; value: string }[];
  actionLabel?: string;
  isCompleted?: boolean;
}

export interface LedgerLouData {
  botId: "lou";
  name: string;
  role: string;
  color: string;
  isActive: boolean;
  lastUpdated: string;
  balancesBalanced: boolean;
  unpostedCount: number;
  totalDraftAmount: string; // decimal string returned by API
  periodClosingPending: boolean;
  currentPeriod: string;
  checklist: MonthEndChecklistItem[];
  unpostedEntries: UnpostedEntry[];
}
