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
  via?: "1000" | "1100" | "1200" | "2000";
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

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  subtype?: string;
  currency: string;
  balance: string; // decimal string, e.g. "42150.00"
  active: boolean;
  isSystem?: boolean;
  description?: string;
}

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

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  debit: string;
  credit: string;
}

export interface CurrencyBalanceRow {
  currency: string;
  journalCount: number;
  totalDebit: string;
  totalCredit: string;
  variance: string;
  status: "balanced" | "variance";
}

// ==========================================
// Sales Invoicing (SAL-04) & AR / AP (FIN-02 / FIN-03 / FIN-14)
// ==========================================

export type InvoiceStatus = "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";

export interface InvoiceLineItem {
  id: string;
  itemId?: string;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: string; // decimal string
  taxRate: string; // decimal string, e.g. "0.15" or "0.00"
  taxCode: string; // e.g. "TAX-STD", "TAX-EXEMPT"
  lineTotal: string; // decimal string, e.g. "240.00"
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. "INV-2026-0042"
  partyId: string;
  partyName: string;
  partyTaxId?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  currency: string;
  status: InvoiceStatus;
  lines: InvoiceLineItem[];
  subtotal: string; // decimal string
  taxTotal: string; // decimal string
  total: string; // decimal string
  amountPaid: string; // decimal string
  balanceDue: string; // decimal string
  notes?: string;
  paymentTerms?: string;
}

export interface InvoicesSummary {
  totalReceivable: string; // decimal string returned by API
  overdue: string; // decimal string returned by API
  overdueCount: number;
  paidThisMonth: string; // decimal string returned by API
  invoiceCount: number;
}

export type BillStatus = "draft" | "pending_approval" | "approved" | "paid" | "overdue" | "disputed";

export interface BillLineItem {
  id: string;
  itemId?: string;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: string; // decimal string
  accountCode: string; // e.g. "5000" Cost of Goods Sold or "6200" Utilities
  lineTotal: string; // decimal string
}

export interface Bill {
  id: string;
  billNumber: string; // e.g. "BILL-8921"
  vendorInvoiceNumber?: string; // Vendor's reference
  supplierId: string;
  supplierName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: BillStatus;
  lines: BillLineItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  notes?: string;
}

export interface AgingBucket {
  current: string; // not yet due
  days30: string; // 1-30 days overdue
  days60: string; // 31-60 days overdue
  days90Plus: string; // 61+ days overdue
  totalOutstanding: string;
}

export interface ReminderDraft {
  id: string;
  invoiceId: string;
  channel: "whatsapp" | "email";
  recipient: string;
  recipientName: string;
  subject?: string;
  message: string;
  tone: "friendly" | "firm" | "urgent";
  status: "draft" | "approved" | "sent";
  updatedAt?: string;
}

export interface OverdueInvoice {
  id: string;
  partyId: string;
  partyName: string;
  issueDate: string;
  dueDate: string;
  amount: string; // decimal string
  amountPaid: string; // decimal string
  amountDue: string; // decimal string
  daysOverdue: number;
  agingBucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
  status: "overdue" | "reminder_sent" | "paid";
  draftReminder?: ReminderDraft;
}

export interface AgingBucketSummary {
  bucket: string;
  label: string;
  invoiceCount: number;
  totalAmount: string; // decimal string
  status: StatusType;
}

export interface StatementLine {
  id: string;
  date: string;
  type: "Invoice" | "Payment" | "Credit Note";
  reference: string;
  amount: string; // decimal string
  balance: string; // decimal string
}

export interface CustomerStatement {
  partyId: string;
  partyName: string;
  email: string;
  phone: string;
  paymentTerms: string;
  currentBalance: string;
  overdueBalance: string;
  transactions: StatementLine[];
}

export interface ChaseChloeData {
  botId: "chloe";
  name: string;
  role: string;
  color: string;
  isActive: boolean;
  lastUpdated: string;
  totalOverdue: string; // decimal string
  overdueCount: number;
  draftCount: number;
  avgDaysOverdue: string;
  zeroBadDebt: boolean;
  invoices: OverdueInvoice[];
  agingBuckets: AgingBucketSummary[];
}

// ==========================================
// General Ledger (FIN-01) & Journal Postings
// ==========================================

export type JournalEntryStatus = "draft" | "posted" | "reversed";

export interface JournalEntryLine {
  id: string;
  accountCode: string;
  accountName: string;
  side: "DEBIT" | "CREDIT";
  amount: string; // decimal string
  memo?: string;
  partyId?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string; // e.g. "JRN-2026-0104"
  date: string; // YYYY-MM-DD
  memo: string;
  sourceModule: "MANUAL" | "SALES" | "PURCHASING" | "BANK" | "PAYROLL" | "INVENTORY";
  referenceDocument?: string; // e.g. "INV-2026-0041"
  status: JournalEntryStatus;
  lines: JournalEntryLine[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  postedAt?: string;
  reversedByEntryId?: string;
}

// ==========================================
// Approvals (PLT-07) & Bots (AGT-01..AGT-06)
// ==========================================

export type CanonicalTier = 1 | 2 | 3 | 4 | 5;
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface ApprovalItem {
  id: string;
  runId: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  toolName: string;
  tier: 2 | 3 | 4;
  title: string;
  summary: string;
  initiator: string;
  initiatorPrincipal: string;
  requiresDualControl: boolean;
  amount?: string; // decimal string
  payload: Record<string, any>;
  payloadHash: string; // SHA-256 hash
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface AgentRegistryItem {
  id: string;
  name: string;
  role: string;
  color: string;
  catalogId: string;
  enabled: boolean;
  pendingApprovals: number;
  toolsGranted: string[];
  maxTier: CanonicalTier;
  lastActive: string;
}

export interface StockReplenishmentItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderPoint: number;
  suggestedReorder: number;
  unitCost: string; // decimal string
  supplierName: string;
  supplierLeadDays: number;
  status: "healthy" | "low_stock" | "stockout";
}

export interface POLineItem {
  sku: string;
  name: string;
  qty: number;
  unitPrice: string; // decimal string
  total: string; // decimal string
}

export interface DraftPurchaseOrder {
  id: string;
  vendorName: string;
  lines: POLineItem[];
  totalAmount: string; // decimal string
  status: "draft" | "submitted" | "approved";
  createdAt: string;
}

export interface RestockRexData {
  botId: "rex";
  name: string;
  role: string;
  color: string;
  isActive: boolean;
  lastUpdated: string;
  lowStockCount: number;
  criticalCount: number;
  pendingDraftTotal: string; // decimal string
  avgLeadDays: number;
  items: StockReplenishmentItem[];
  draftPO: DraftPurchaseOrder | null;
}

export type AnomalyRule = "duplicate_bill" | "margin_breach" | "unusual_velocity" | "post_period_entry";

export interface AnomalyFinding {
  id: string;
  rule: AnomalyRule;
  title: string;
  severity: "watch" | "act";
  confidence: number;
  suspectedRef: string;
  matchedRef?: string;
  partyName: string;
  amount: string; // decimal string
  details: string;
  status: "flagged" | "quarantined" | "dismissed";
  detectedAt: string;
}

export interface GuardGusData {
  botId: "gus";
  name: string;
  role: string;
  color: string;
  isActive: boolean;
  lastUpdated: string;
  activeAnomaliesCount: number;
  quarantinedCount: number;
  exposureBlocked: string; // decimal string
  findings: AnomalyFinding[];
}

export interface CashForecastPoint {
  day: number;
  date: string;
  label: string;
  inflowScheduled: string; // decimal string
  outflowScheduled: string; // decimal string
  projectedBalance: string; // decimal string
  optimisticBalance: string; // decimal string
  conservativeBalance: string; // decimal string
  eventMemo?: string;
}

export interface ForecastFinnData {
  botId: "finn";
  name: string;
  role: string;
  color: string;
  isActive: boolean;
  lastUpdated: string;
  currentCash: string;
  cash30Day: string;
  cash60Day: string;
  cash90Day: string;
  monthlyBurnRate: string;
  runwayMonths: string;
  scenario: "expected" | "conservative" | "optimistic";
  forecastPoints: CashForecastPoint[];
}

export type DealStage = "Lead" | "Discovery" | "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";

export interface PipelineDeal {
  id: string;
  title: string;
  customer: string;
  contactPerson: string;
  amount: string; // decimal string
  stage: DealStage;
  probability: number;
  expectedClose: string;
  daysQuiet: number;
  needsFollowUp: boolean;
  draftMessage?: string;
  discountOffered?: number;
}

export interface PipData {
  botId: "pip";
  name: string;
  role: string;
  color: string;
  isActive: boolean;
  lastUpdated: string;
  weightedValue: string; // decimal string
  activeDealsCount: number;
  winRate: string;
  quietDealsCount: number;
  deals: PipelineDeal[];
}
