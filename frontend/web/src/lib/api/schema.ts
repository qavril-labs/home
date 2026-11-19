/**
 * Generated from contracts/openapi.yaml.
 * DO NOT EDIT DIRECTLY. Run `npm --prefix frontend run api:generate`.
 */

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>[];
  };
};

export type LeadSubmission = {
  name: string;
  email: string;
  company?: string;
  country?: string;
  interest: "early_access" | "demo" | "partner" | "trial";
  industry?: string;
  message?: string;
  source?: string;
  slot?: string;
  timezone?: string;
  consent: true;
  website?: string;
};

export type SignUpRequest = {
  workspace: string;
  companyName: string;
  country: string;
  currency: string;
  name: string;
  email: string;
  password: string;
  website?: string;
};

export type SignUpResponse = {
  workspace: string;
  tenantId: string;
  company: {
    id?: string;
    name?: string;
  };
  session: SessionInfo;
};

export type LoginRequest = {
  tenantSlug: string;
  email: string;
  password: string;
};

export type SessionInfo = {
  token: string;
  expiresAt: string;
};

export type SessionResponse = {
  session: SessionInfo;
  principal: Principal;
};

export type Principal = {
  id: string;
  tenantId: string;
  email: string;
  permissions: string[];
};

export type WorkspaceTotals = {
  cash: string;
  revenue: string;
  expenses: string;
  profit: string;
};

export type MonthlyTrendRow = {
  month: string;
  revenue: string;
  expenses: string;
};

export type WorkspaceOverview = {
  company: {
    name?: string;
    currency?: string;
  };
  workspace: {
    slug?: string;
  };
  asOf: string;
  booksReady: boolean;
  totals: WorkspaceTotals;
  trend: MonthlyTrendRow[];
  recent?: RecentEntry[];
};

export type BotInsight = {
  id: string;
  name: string;
  role: string;
  color: string;
  status: "good" | "watch" | "act" | "idle";
  statusText: string;
  foundText: string;
  nextText: string;
  hasDraft?: boolean;
  draftType?: string;
  draftLabel?: string;
  actionVerb?: string;
};

export type WorkspaceInsights = {
  company: string;
  workspaceName: string;
  currency: string;
  asOf: string;
  totals: WorkspaceTotals;
  trend: MonthlyTrendRow[];
  bots: BotInsight[];
};

export type QuickEntryRequest = {
  kind: "sale" | "expense" | "owner_investment" | "customer_payment";
  amount: string;
  date: string;
  account?: string;
  via: "1000" | "1100" | "1200" | "2000";
  memo?: string;
};

export type QuickEntryResponse = {
  reference: string;
  date?: string;
  amount?: string;
};

export type Account = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  balance?: string;
};

export type CreateAccountRequest = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
};

export type JournalLine = {
  account: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
};

export type JournalEntry = {
  id: string;
  reference: string;
  date: string;
  memo?: string;
  lines: JournalLine[];
  reversalOf?: string;
};

export type PostJournalRequest = {
  date: string;
  reference?: string;
  memo?: string;
  lines: JournalLine[];
};

export type TrialBalance = {
  asOf: string;
  balanced: boolean;
  debitTotal: string;
  creditTotal: string;
  accounts: Account[];
};

export type RecentEntry = {
  id: string;
  date: string;
  kind: string;
  description: string;
  party?: string;
  amount: string;
  status: string;
};

export type Party = {
  id: string;
  name: string;
  partyType: "customer" | "supplier" | "both";
  email?: string;
  phone?: string;
  taxId?: string;
  status: "active" | "hold" | "archived" | "inactive";
  balance: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePartyRequest = {
  name: string;
  partyType: "customer" | "supplier" | "both";
  email?: string;
  phone?: string;
  taxId?: string;
  status?: "active" | "hold" | "archived" | "inactive";
  balance?: string;
};

export type UpdatePartyRequest = {
  name?: string;
  partyType?: "customer" | "supplier" | "both";
  email?: string;
  phone?: string;
  taxId?: string;
  status?: "active" | "hold" | "archived" | "inactive";
};

export type ProductItem = {
  id: string;
  sku: string;
  name: string;
  itemType: "goods" | "service" | "bundle";
  category?: string;
  unit: string;
  unitPrice: string;
  stockQuantity: number;
  reorderPoint: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
  createdAt?: string;
  updatedAt?: string;
};

export type CreateItemRequest = {
  sku: string;
  name: string;
  itemType?: "goods" | "service" | "bundle";
  category?: string;
  unit?: string;
  unitPrice?: string;
  stockQuantity?: number;
  reorderPoint?: number;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
};

export type UpdateItemRequest = {
  name?: string;
  itemType?: "goods" | "service" | "bundle";
  category?: string;
  unit?: string;
  unitPrice?: string;
  stockQuantity?: number;
  reorderPoint?: number;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
};

/** Bot API error envelope. Unlike ErrorResponse above, details is an object and request_id is always present. */
export type UaapErrorResponse = {
  error: {
    code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "APPROVAL_ALREADY_CONSUMED" | "APPROVAL_EXPIRED" | "APPROVAL_REQUIRED" | "IDEMPOTENCY_CONFLICT" | "TOOL_BLOCKED" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "UPSTREAM_FAILED" | "UPSTREAM_TIMEOUT" | "UPSTREAM_INVALID_RESPONSE" | "INTERNAL";
    message: string;
    details: Record<string, unknown>;
    request_id: string;
  };
};

export type AgentList = {
  agents: AgentSummary[];
};

export type AgentSummary = {
  agent_id: string;
  name: string;
  purpose: string;
  enabled: boolean;
  use_cases: {
    title: string;
    example: string;
  }[];
  out_of_scope: string[];
};

export type AgentMessageRequest = {
  message: string;
  company_id?: string;
  today?: string;
};

export type AgentReply = {
  status: "answered" | "awaiting_approval" | "needs_clarification" | "refused" | "failed";
  text: string;
  run_id: string;
  approval: {
    approval_id: string;
    summary: string;
    expires_at: string;
  };
  error_code: string;
  guardrail_events: ("INPUT_EMPTY" | "INPUT_TOO_LONG" | "PII_REDACTED" | "INJECTION_SUSPECTED" | "UNGROUNDED_FIGURE" | "UNGROUNDED_IDENTIFIER" | "UNGROUNDED_REPLY" | "OUT_OF_SCOPE")[];
  data: Record<string, unknown>;
};

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "FAILED" | "EXPIRED";

export type Approval = {
  approval_id: string;
  run_id: string;
  agent_id: string;
  initiator_id: string;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  created_at: string;
  expires_at: string;
  status: ApprovalStatus;
  can_decide: boolean;
  decided_by: string;
  decided_at: string;
  outcome: string;
};

export type ApprovalDecisionRequest = {
  decision: "approve" | "reject";
  payload_hash?: string;
  reason?: string;
};

export type ApprovalDecisionResponse = {
  approval: Approval;
  reply: AgentReply;
};

export type CmsAuthVerifyInput = {
  key: string;
};

export type CmsSettingsInput = {
  settings: {
    [key: string]: string;
  };
};

export type CmsPageInput = {
  title: string;
  metaDescription?: string;
  kicker?: string;
  heroHeadline?: string;
  heroSubhead?: string;
  heroBadge?: string;
  contentJson?: Record<string, unknown>;
  isPublished?: boolean;
};

export type CmsArticleInput = {
  slug: string;
  type?: "blog" | "case_study" | "news";
  title: string;
  excerpt?: string;
  contentMarkdown: string;
  author?: string;
  readTime?: string;
  categoryTag?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
};

export type CmsFaqInput = {
  category: string;
  question: string;
  answer: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type InvoiceLineInput = {
  itemId?: string;
  sku: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: string;
  taxRate?: string;
  taxCode?: string;
  lineTotal: string;
};

export type InvoiceInput = {
  partyId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  status?: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid?: string;
  balanceDue?: string;
  paymentTerms?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  lines: InvoiceLineInput[];
};

/** Any subset of InvoiceInput fields, except lines. */
export type InvoiceUpdateInput = {
  partyId?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  status?: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
  subtotal?: string;
  taxTotal?: string;
  total?: string;
  amountPaid?: string;
  balanceDue?: string;
  paymentTerms?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type BillLineInput = {
  itemId?: string;
  sku: string;
  description: string;
  quantity: number;
  unit?: string;
  unitCost: string;
  accountCode?: string;
  lineTotal: string;
};

export type BillInput = {
  supplierId: string;
  billNumber: string;
  vendorInvoiceNumber?: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  status?: "draft" | "pending_approval" | "approved" | "paid" | "overdue" | "disputed";
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid?: string;
  balanceDue?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  lines: BillLineInput[];
};

export type ReminderInput = {
  invoiceId: string;
  channel: "whatsapp" | "email";
  recipient: string;
  recipientName: string;
  subject?: string;
  message: string;
  tone: "friendly" | "firm" | "urgent";
  status?: "draft" | "approved" | "sent";
};

export type CmsError = {
  error: (string) | (Record<string, unknown>[]);
};

export type CmsStatus = {
  ok: boolean;
  message?: string;
};

export type CmsSettings = {
  ok: boolean;
  settings: ({
    [key: string]: string;
  }) | (Record<string, unknown>[]);
};

export type CmsRecordResponse = {
  ok: boolean;
  page?: Record<string, unknown>;
  article?: Record<string, unknown>;
  faq?: Record<string, unknown>;
};

export type CmsPageListItem = {
  slug: string;
  title: string;
  meta_description?: string;
  kicker?: string;
  hero_headline?: string;
  hero_subhead?: string;
  hero_badge?: string;
  updated_at?: string;
};

export type CmsArticleListItem = {
  id: string;
  slug: string;
  type: "blog" | "case_study" | "news";
  title: string;
  excerpt?: string;
  author?: string;
  read_time?: string;
  category_tag?: string;
  is_featured?: boolean;
  published_at?: string;
};

export type CmsFaqListItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order?: number;
  is_active?: boolean;
};

export type CmsLeadListItem = {
  id: string;
  name?: string;
  email: string;
  company?: string;
  notes?: string;
  created_at?: string;
};

export type CmsListResponse = {
  ok: boolean;
  pages?: CmsPageListItem[];
  articles?: CmsArticleListItem[];
  faqs?: CmsFaqListItem[];
  leads?: CmsLeadListItem[];
};

export type CmsOverview = {
  ok: boolean;
  stats: {
    totalPages: number;
    totalArticles: number;
    totalFaqs: number;
    totalLeads: number;
  };
};

export type CmsAuthResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

/** One line of an invoice, as stored. Fields follow InvoiceLineInput. */
export type InvoiceLine = Record<string, unknown>;

export type Invoice = {
  id: string;
  tenantId?: string;
  companyId?: string;
  partyId: string;
  partyName: string;
  partyTaxId?: string;
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  status: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  paymentTerms?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  lines: InvoiceLine[];
  createdAt?: string;
  updatedAt?: string;
};

export type InvoicesSummary = {
  totalReceivable: string;
  overdue: string;
  overdueCount: number;
  paidThisMonth: string;
  invoiceCount: number;
};

export type InvoiceList = {
  invoices: Invoice[];
  summary: InvoicesSummary;
};

export type CustomerStatement = {
  partyId: string;
  partyName: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  currentBalance: string;
  overdueBalance: string;
  transactions: Record<string, unknown>[];
};

export type PaymentReminder = {
  id: string;
  tenantId?: string;
  companyId?: string;
  invoiceId: string;
  channel: "whatsapp" | "email";
  recipient: string;
  recipientName: string;
  subject?: string;
  message: string;
  tone: "friendly" | "firm" | "urgent";
  status: "draft" | "approved" | "sent";
  sentAt?: string;
  createdAt?: string;
};

/** One line of a bill, as stored. Fields follow BillLineInput. */
export type BillLine = Record<string, unknown>;

export type Bill = {
  id: string;
  tenantId?: string;
  companyId?: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  vendorInvoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  status: "draft" | "pending_approval" | "approved" | "paid" | "overdue" | "disputed";
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  lines: BillLine[];
  createdAt?: string;
  updatedAt?: string;
};

export type BillList = {
  bills: Bill[];
};

export type FiscalPeriodsResponse = {
  periods: ({
    id: string;
    startDate: string;
    endDate: string;
    status: "OPEN" | "CLOSED";
  })[];
};

export type RateSavedResponse = {
  status: "saved";
};

export type TenantProvisionedResponse = {
  tenant: Record<string, unknown>;
  company: Record<string, unknown>;
  admin: Record<string, unknown>;
};

export type TenantProductsResponse = {
  tenantId: string;
  products: string[];
};

export type StreamTicket = {
  ticket: string;
  expiresInSeconds: 60;
};

// -------------------------------------------------------------
// Operations Map
// -------------------------------------------------------------
export interface Operations {
  "getHealth": {
    method: "GET";
    path: "/health";
    requestBody?: unknown;
    response: {
      status: string;
    };
  };
  "submitLead": {
    method: "POST";
    path: "/v1/public/leads";
    requestBody: LeadSubmission;
    response: {
      status: string;
    };
  };
  "signUp": {
    method: "POST";
    path: "/v1/public/signup";
    requestBody: SignUpRequest;
    response: SignUpResponse;
  };
  "login": {
    method: "POST";
    path: "/v1/auth/login";
    requestBody: LoginRequest;
    response: SessionResponse;
  };
  "logout": {
    method: "POST";
    path: "/v1/auth/logout";
    requestBody?: unknown;
    response?: unknown;
  };
  "getMe": {
    method: "GET";
    path: "/v1/me";
    requestBody?: unknown;
    response: {
      principal: Principal;
    };
  };
  "getWorkspaceOverview": {
    method: "GET";
    path: "/v1/workspace/overview";
    requestBody?: unknown;
    response: WorkspaceOverview;
  };
  "getWorkspaceInsights": {
    method: "GET";
    path: "/v1/workspace/insights";
    requestBody?: unknown;
    response: WorkspaceInsights;
  };
  "setUpStarterBooks": {
    method: "POST";
    path: "/v1/workspace/starter-books";
    requestBody?: unknown;
    response: {
      status?: string;
    };
  };
  "postQuickEntry": {
    method: "POST";
    path: "/v1/workspace/quick-entries";
    requestBody: QuickEntryRequest;
    response: QuickEntryResponse;
  };
  "listParties": {
    method: "GET";
    path: "/v1/master-data/parties";
    requestBody?: unknown;
    response: Party[];
  };
  "createParty": {
    method: "POST";
    path: "/v1/master-data/parties";
    requestBody: CreatePartyRequest;
    response: Party;
  };
  "getParty": {
    method: "GET";
    path: "/v1/master-data/parties/{id}";
    requestBody?: unknown;
    response: Party;
  };
  "updateParty": {
    method: "PUT";
    path: "/v1/master-data/parties/{id}";
    requestBody: UpdatePartyRequest;
    response: Party;
  };
  "deleteParty": {
    method: "DELETE";
    path: "/v1/master-data/parties/{id}";
    requestBody?: unknown;
    response?: unknown;
  };
  "listItems": {
    method: "GET";
    path: "/v1/master-data/items";
    requestBody?: unknown;
    response: ProductItem[];
  };
  "createItem": {
    method: "POST";
    path: "/v1/master-data/items";
    requestBody: CreateItemRequest;
    response: ProductItem;
  };
  "getItem": {
    method: "GET";
    path: "/v1/master-data/items/{id}";
    requestBody?: unknown;
    response: ProductItem;
  };
  "updateItem": {
    method: "PUT";
    path: "/v1/master-data/items/{id}";
    requestBody: UpdateItemRequest;
    response: ProductItem;
  };
  "deleteItem": {
    method: "DELETE";
    path: "/v1/master-data/items/{id}";
    requestBody?: unknown;
    response?: unknown;
  };
  "listMasterDataAccounts": {
    method: "GET";
    path: "/v1/master-data/accounts";
    requestBody?: unknown;
    response: Account[];
  };
  "createMasterDataAccount": {
    method: "POST";
    path: "/v1/master-data/accounts";
    requestBody: CreateAccountRequest;
    response: Account;
  };
  "updateMasterDataAccount": {
    method: "PUT";
    path: "/v1/master-data/accounts/{code}";
    requestBody: {
      name: string;
      active?: boolean;
    };
    response: Account;
  };
  "createAccount": {
    method: "POST";
    path: "/v1/ledger/accounts";
    requestBody: CreateAccountRequest;
    response: Account;
  };
  "listEntries": {
    method: "GET";
    path: "/v1/ledger/journal-entries";
    requestBody?: unknown;
    response: JournalEntry[];
  };
  "postJournalEntry": {
    method: "POST";
    path: "/v1/ledger/journal-entries";
    requestBody: PostJournalRequest;
    response: JournalEntry;
  };
  "reverseJournalEntry": {
    method: "POST";
    path: "/v1/ledger/journal-entries/{id}/reverse";
    requestBody: {
      memo?: string;
    };
    response: JournalEntry;
  };
  "getTrialBalance": {
    method: "GET";
    path: "/v1/ledger/trial-balance";
    requestBody?: unknown;
    response: TrialBalance;
  };
  "listAgents": {
    method: "GET";
    path: "/v1/agents";
    requestBody?: unknown;
    response: AgentList;
  };
  "sendAgentMessage": {
    method: "POST";
    path: "/v1/agents/{agentId}/messages";
    requestBody: AgentMessageRequest;
    response: AgentReply;
  };
  "listApprovals": {
    method: "GET";
    path: "/v1/approvals";
    requestBody?: unknown;
    response: {
      approvals: Approval[];
    };
  };
  "getApproval": {
    method: "GET";
    path: "/v1/approvals/{approvalId}";
    requestBody?: unknown;
    response: Approval;
  };
  "decideApproval": {
    method: "POST";
    path: "/v1/approvals/{approvalId}/decision";
    requestBody: ApprovalDecisionRequest;
    response: ApprovalDecisionResponse;
  };
  "postEventTicket": {
    method: "POST";
    path: "/v1/events/tickets";
    requestBody?: unknown;
    response: StreamTicket;
  };
  "getAdminCmsArticles": {
    method: "GET";
    path: "/v1/admin/cms/articles";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "postAdminCmsArticles": {
    method: "POST";
    path: "/v1/admin/cms/articles";
    requestBody: CmsArticleInput;
    response: CmsRecordResponse;
  };
  "putAdminCmsArticlesId": {
    method: "PUT";
    path: "/v1/admin/cms/articles/{id}";
    requestBody: CmsArticleInput;
    response: CmsRecordResponse;
  };
  "deleteAdminCmsArticlesId": {
    method: "DELETE";
    path: "/v1/admin/cms/articles/{id}";
    requestBody?: unknown;
    response: CmsStatus;
  };
  "postAdminCmsAuthVerify": {
    method: "POST";
    path: "/v1/admin/cms/auth/verify";
    requestBody: CmsAuthVerifyInput;
    response: CmsAuthResponse;
  };
  "getAdminCmsFaqs": {
    method: "GET";
    path: "/v1/admin/cms/faqs";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "postAdminCmsFaqs": {
    method: "POST";
    path: "/v1/admin/cms/faqs";
    requestBody: CmsFaqInput;
    response: CmsRecordResponse;
  };
  "putAdminCmsFaqsId": {
    method: "PUT";
    path: "/v1/admin/cms/faqs/{id}";
    requestBody: CmsFaqInput;
    response: CmsRecordResponse;
  };
  "deleteAdminCmsFaqsId": {
    method: "DELETE";
    path: "/v1/admin/cms/faqs/{id}";
    requestBody?: unknown;
    response: CmsStatus;
  };
  "getAdminCmsLeads": {
    method: "GET";
    path: "/v1/admin/cms/leads";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "getAdminCmsOverview": {
    method: "GET";
    path: "/v1/admin/cms/overview";
    requestBody?: unknown;
    response: CmsOverview;
  };
  "getAdminCmsPages": {
    method: "GET";
    path: "/v1/admin/cms/pages";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "putAdminCmsPagesSlug": {
    method: "PUT";
    path: "/v1/admin/cms/pages/{slug}";
    requestBody: CmsPageInput;
    response: CmsRecordResponse;
  };
  "getAdminCmsSettings": {
    method: "GET";
    path: "/v1/admin/cms/settings";
    requestBody?: unknown;
    response: CmsSettings;
  };
  "putAdminCmsSettings": {
    method: "PUT";
    path: "/v1/admin/cms/settings";
    requestBody: CmsSettingsInput;
    response: CmsStatus;
  };
  "getEventsStream": {
    method: "GET";
    path: "/v1/events/stream";
    requestBody?: unknown;
    response?: unknown;
  };
  "getInvoicingBills": {
    method: "GET";
    path: "/v1/invoicing/bills";
    requestBody?: unknown;
    response: BillList;
  };
  "postInvoicingBills": {
    method: "POST";
    path: "/v1/invoicing/bills";
    requestBody: BillInput;
    response: Bill;
  };
  "getInvoicingInvoices": {
    method: "GET";
    path: "/v1/invoicing/invoices";
    requestBody?: unknown;
    response: InvoiceList;
  };
  "postInvoicingInvoices": {
    method: "POST";
    path: "/v1/invoicing/invoices";
    requestBody: InvoiceInput;
    response: Invoice;
  };
  "getInvoicingInvoicesId": {
    method: "GET";
    path: "/v1/invoicing/invoices/{id}";
    requestBody?: unknown;
    response: Invoice;
  };
  "putInvoicingInvoicesId": {
    method: "PUT";
    path: "/v1/invoicing/invoices/{id}";
    requestBody: InvoiceUpdateInput;
    response: Invoice;
  };
  "deleteInvoicingInvoicesId": {
    method: "DELETE";
    path: "/v1/invoicing/invoices/{id}";
    requestBody?: unknown;
    response?: unknown;
  };
  "postInvoicingInvoicesIdPay": {
    method: "POST";
    path: "/v1/invoicing/invoices/{id}/pay";
    requestBody: Record<string, unknown>;
    response: Invoice;
  };
  "postInvoicingReminders": {
    method: "POST";
    path: "/v1/invoicing/reminders";
    requestBody: ReminderInput;
    response: PaymentReminder;
  };
  "getInvoicingStatementsPartyId": {
    method: "GET";
    path: "/v1/invoicing/statements/{partyId}";
    requestBody?: unknown;
    response: CustomerStatement;
  };
  "postLedgerFiscalYears": {
    method: "POST";
    path: "/v1/ledger/fiscal-years";
    requestBody: Record<string, unknown>;
    response: FiscalPeriodsResponse;
  };
  "postLedgerFxRates": {
    method: "POST";
    path: "/v1/ledger/fx-rates";
    requestBody: Record<string, unknown>;
    response: RateSavedResponse;
  };
  "postPlatformTenants": {
    method: "POST";
    path: "/v1/platform/tenants";
    requestBody: Record<string, unknown>;
    response: TenantProvisionedResponse;
  };
  "postPlatformTenantsTenantIdProducts": {
    method: "POST";
    path: "/v1/platform/tenants/{tenantId}/products";
    requestBody: Record<string, unknown>;
    response: TenantProductsResponse;
  };
  "getPublicCmsArticles": {
    method: "GET";
    path: "/v1/public/cms/articles";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "getPublicCmsArticlesSlug": {
    method: "GET";
    path: "/v1/public/cms/articles/{slug}";
    requestBody?: unknown;
    response: CmsRecordResponse;
  };
  "getPublicCmsFaqs": {
    method: "GET";
    path: "/v1/public/cms/faqs";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "getPublicCmsPages": {
    method: "GET";
    path: "/v1/public/cms/pages";
    requestBody?: unknown;
    response: CmsListResponse;
  };
  "getPublicCmsPagesSlug": {
    method: "GET";
    path: "/v1/public/cms/pages/{slug}";
    requestBody?: unknown;
    response: CmsRecordResponse;
  };
  "getPublicCmsSettings": {
    method: "GET";
    path: "/v1/public/cms/settings";
    requestBody?: unknown;
    response: CmsSettings;
  };
}
