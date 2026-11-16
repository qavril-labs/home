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

// ==========================================
// Inventory & Warehouses (INV-01 to INV-05)
// ==========================================

export interface WarehouseLocation {
  id: string;
  code: string; // e.g. "WH-MAIN", "WH-EAST", "WH-SHOP"
  name: string;
  city: string;
  capacityUnits: number;
  utilizedUnits: number;
  manager: string;
}

export interface WarehouseStockSlot {
  id: string;
  warehouseCode: string; // e.g. "WH-MAIN"
  warehouseName: string;
  aisle: string; // e.g. "A1", "B2"
  shelf: number;
  sku: string;
  itemName: string;
  uom: string; // "pcs" | "kg" | "m" | "hrs"
  quantity: number;
  reorderPoint: number;
  unitValue: string; // decimal string
  totalValue: string; // decimal string
}

export interface StockTransfer {
  id: string;
  transferNumber: string; // e.g. "TRF-2026-081"
  sku: string;
  itemName: string;
  fromWarehouse: string; // code e.g. "WH-MAIN"
  toWarehouse: string;   // code e.g. "WH-EAST"
  quantity: number;
  uom: string;
  status: "Draft" | "In Transit" | "Completed";
  requestedAt: string;
  notes?: string;
}

// ==========================================
// Quotes & CPQ (SAL-02)
// ==========================================

export interface SalesQuote {
  id: string;
  quoteNumber: string; // e.g. "QUO-2026-301"
  dealId?: string;
  customerName: string;
  contactPerson: string;
  issuedAt: string;
  validUntil: string;
  status: "Draft" | "Sent" | "Accepted" | "Expired";
  subtotal: string; // decimal string
  discountPercent: number;
  taxTotal: string; // decimal string
  grandTotal: string; // decimal string
  itemsCount: number;
  notes?: string;
}

// ==========================================
// Bank & Cash Reconciliation (FIN-04)
// ==========================================

export interface BankFeedLine {
  id: string;
  postedDate: string;
  reference: string;
  description: string;
  amount: string; // decimal string
  direction: "IN" | "OUT";
  status: "Unmatched" | "Suggested" | "Reconciled";
  matchedRef?: string;
  matchedLabel?: string;
  confidence?: number;
}

// ==========================================
// Sprint 6+: Industry Pack Bots (GAR / FMCG) & AI-09
// ==========================================

export type PackReadinessStatus = "READY" | "PARTIAL" | "BLOCKED";

export interface GarmentCostLine {
  id: string;
  category: "Fabric" | "Trim" | "Labour (SAM)" | "Overhead";
  componentName: string;
  consumptionOrSam: string;
  unit: string;
  approvedRate: string; // decimal string
  lineCost: string; // decimal string
  configId: string;
  configVersion: string;
}

export interface GarmentCostSheet {
  id: string;
  styleCode: string;
  styleName: string;
  season: string;
  techPackId: string;
  techPackVersion: string;
  readiness: PackReadinessStatus;
  missingInputs: string[];
  totalManufacturingCost: string; // decimal string
  suggestedWholesalePrice: string; // decimal string (target 38% margin)
  suggestedFobPrice: string; // decimal string (target 24% margin)
  targetMarginPct: string;
  calcId: string;
  lines: GarmentCostLine[];
  status: "draft" | "approved";
}

export interface TechPackBomRow {
  id: string;
  itemCode: string;
  description: string;
  placement: string;
  supplier: string;
  sizeCurveConsumption: {
    XS: string;
    S: string;
    M: string;
    L: string;
    XL: string;
  };
  unit: string;
}

export interface GarmentTechPack {
  id: string;
  styleCode: string;
  styleName: string;
  version: string;
  buyerName: string;
  readiness: PackReadinessStatus;
  missingInputs: string[];
  fabricWeightGsm: number;
  samMinutes: string;
  sampleStatus: "Proto" | "Fit Sample" | "PP Sample" | "Gold Seal Approved";
  bom: TechPackBomRow[];
  lastUpdated: string;
}

export interface FmcgExpiryBatch {
  id: string;
  batchNumber: string;
  sku: string;
  productName: string;
  warehouseBin: string;
  mfgDate: string;
  expiryDate: string;
  daysRemaining: number;
  totalUnits: number;
  unitValue: string; // decimal string
  totalBatchValue: string; // decimal string
  ruleId: string;
  ruleVersion: string;
  fefoPriority: "Dispatch First (FEFO)" | "Markdown 25% Draft" | "Quarantine / Near Expiry";
  status: "active" | "markdown_drafted" | "quarantined";
}

export interface FmcgLabelCheckRule {
  id: string;
  ruleCode: string;
  jurisdiction: string;
  ruleSetVersion: string;
  approvedBy: string;
  checkName: string;
  extractedText: string;
  expectedRequirement: string;
  result: "PASS" | "WARN" | "BLOCK";
  remediationNote?: string;
}

export interface FmcgLabelReport {
  id: string;
  sku: string;
  productName: string;
  artworkVersion: string;
  readiness: PackReadinessStatus;
  overallVerdict: "COMPLIANT" | "NON_COMPLIANT";
  ruleSetId: string;
  ruleSetVersion: string;
  checks: FmcgLabelCheckRule[];
}

export interface IndustryPacksData {
  lastUpdated: string;
  garmentCostSheets: GarmentCostSheet[];
  techPacks: GarmentTechPack[];
  fmcgBatches: FmcgExpiryBatch[];
  fmcgLabelReports: FmcgLabelReport[];
}

export interface ConversationalTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  agentBadge?: {
    name: string;
    catalogId: string;
    color: string;
    tier: CanonicalTier;
  };
  provenanceRef?: string;
  actionLink?: {
    label: string;
    targetTab: string;
  };
}

// ==========================================
// Domain Events Specification (contracts/events.md)
// ==========================================

export interface DomainEvent<T = Record<string, unknown>> {
  id: string; // unique UUID v7 or ULID
  tenantId: string; // isolated tenant
  type: string; // dot-notated event name, e.g. "ledger.entry.posted"
  version: number; // schema version (starts at 1)
  occurredAt: string; // ISO 8601 UTC timestamp
  producer: string; // service identifier, e.g. "@erp/api"
  correlationId?: string; // causal tracing ID
  data: T; // strongly-typed payload
}

// ==========================================
// Financial Digital Twin & Stress Testing (AIS-02 / FIN-09)
// ==========================================

export interface ScenarioParameters {
  scenarioName: string;
  revenueGrowthDelta: number; // percentage, e.g. -25 for -25%
  cogsInflationDelta: number; // percentage, e.g. 15 for +15%
  opexHiringCount: number; // additional headcount
  averageSalaryPerHire: string; // decimal string
  dsoDaysDelta: number; // customer payment term shift (+30 days)
  priceIncreaseDelta: number; // sales price adjustment %
}

export interface ScenarioBotAlert {
  botId: string;
  botName: string;
  botColor: string;
  headline: string;
  severity: "watch" | "act" | "good";
  recommendation: string;
}

export interface ScenarioProjection {
  scenarioName: string;
  projectedRunwayMonths: number;
  projectedCash30d: string;
  projectedCash60d: string;
  projectedCash90d: string;
  netCashflowDelta: string;
  monthlyBurnRate: string;
  riskScore: number; // 0 - 100
  riskLevel: "low" | "moderate" | "severe" | "critical";
  botAlerts: ScenarioBotAlert[];
}

// ==========================================
// Ticket Tess Support Bot (AGT-05 / SAL-11 / SAL-12)
// ==========================================

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerId: string;
  subject: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "drafted" | "resolved" | "escalated";
  receivedAt: string;
  inquiryChannel: "email" | "whatsapp" | "portal";
  inquiryText: string;
  sentiment: "positive" | "neutral" | "frustrated" | "critical";
  relatedInvoiceId?: string;
  relatedOrderAmount?: string;
  warrantyStatus: "active" | "expired" | "not_applicable";
  draftedReply?: string;
  confidenceScore: number;
}

// ==========================================
// Onboard Ola People Agent (HRM-10 / HRM-01 / PLT-01)
// ==========================================

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  category: "access" | "compliance" | "hardware" | "hr";
  status: "pending" | "approved" | "completed";
  tierLevel: 1 | 2 | 3;
}

export interface OnboardingRecord {
  id: string;
  employeeName: string;
  roleTitle: string;
  department: string;
  startDate: string;
  status: "staged" | "review_pending" | "provisioned";
  email: string;
  managerName: string;
  roleTier: "Tier 1" | "Tier 2" | "Tier 3 (Executive)";
  checklist: OnboardingChecklistItem[];
  requestedHardware: string[];
  systemPermissions: string[];
}

// ==========================================
// Document Intelligence & OCR (AI-01 / PLT-11)
// ==========================================

export interface OcrBoundingBox {
  id: string;
  fieldKey: "vendorName" | "invoiceNumber" | "invoiceDate" | "dueDate" | "currency" | "subtotal" | "taxTotal" | "totalAmount" | "lineItem";
  label: string;
  box: {
    top: number; // percentage 0-100
    left: number; // percentage 0-100
    width: number; // percentage 0-100
    height: number; // percentage 0-100
  };
  extractedValue: string;
  confidence: number; // e.g. 0.992 for 99.2%
}

export interface OcrLineItem {
  id: string;
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: string; // decimal string
  lineTotal: string; // decimal string
  confidence: number;
}

export interface OcrDocument {
  id: string;
  filename: string;
  fileSize: string;
  mimeType: string;
  uploadedAt: string;
  status: "processing" | "extracted" | "verified" | "posted";
  provenanceSha256: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: string; // decimal string
  taxTotal: string; // decimal string
  totalAmount: string; // decimal string
  lines: OcrLineItem[];
  boundingBoxes: OcrBoundingBox[];
}





