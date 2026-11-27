/**
 * Contract-Generated HTTP Client (from contracts/openapi.yaml)
 * Connects the Frontend Lane (MDM-01, MDM-02, MDM-03, SAL-04, FIN-01, FIN-02, FIN-14, PLT-23)
 * to Fastify backend endpoints over HTTP, with graceful contract mock fallback when offline.
 */
import type {
  Account,
  AccountType,
  Bill,
  CustomerStatement,
  Invoice,
  InvoicesSummary,
  ItemType,
  JournalEntry,
  OverdueInvoice,
  Party,
  PartyStatus,
  PartyType,
  PaymentTerms,
  ProductItem,
  ReminderDraft,
  WorkspaceInsights,
} from "../types";
import {
  initialOverdueInvoices,
  initialMockInsights,
  mockCustomerStatements,
} from "./api-mock";

// ---------------------------------------------------------------------------
// OpenAPI Wire Schemas (contracts/openapi.yaml & master-data-routes.ts)
// ---------------------------------------------------------------------------

export interface OpenApiPartyWire {
  id: string;
  name: string;
  partyType: PartyType;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  status: PartyStatus;
  balance: string;
  metadata?: {
    tradeName?: string;
    contactPerson?: string;
    paymentTerms?: PaymentTerms;
    currency?: string;
    billingAddress?: Party["billingAddress"];
    shippingAddress?: Party["shippingAddress"];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface OpenApiItemWire {
  id: string;
  sku: string;
  name: string;
  itemType: "good" | "service" | "bundle" | ItemType;
  category: string;
  unit: string;
  unitPrice: string;
  stockQuantity: number;
  reorderPoint: number;
  status: "active" | "inactive" | ProductItem["status"];
  metadata?: {
    barcode?: string;
    costPrice?: string;
    taxCode?: string;
    description?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface OpenApiAccountWire {
  code: string;
  name: string;
  type: AccountType;
  balance: string;
  active: boolean;
  subtype?: string;
  currency?: string;
  isSystem?: boolean;
  description?: string;
}

export interface ApiResult<T> {
  data: T;
  isLive: boolean;
  endpoint: string;
}

// ---------------------------------------------------------------------------
// Helpers & Mappers
// ---------------------------------------------------------------------------

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const winConfig = (window as unknown as { ERP_CONFIG?: { apiBase?: string } }).ERP_CONFIG;
    if (winConfig?.apiBase) {
      return winConfig.apiBase.replace(/\/+$/, "");
    }
  }
  const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }
  return "http://localhost:3002";
}

let inMemorySessionToken: string | null = null;

export function setApiSessionToken(token: string | null): void {
  inMemorySessionToken = token;
}

export function getApiSessionToken(): string | null {
  return inMemorySessionToken;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (inMemorySessionToken) {
    headers.Authorization = `Bearer ${inMemorySessionToken}`;
  }
  return headers;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...getAuthHeaders(),
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} on ${path}`);
    }
    if (response.status === 204) {
      return undefined as unknown as T;
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function mapWireToParty(wire: OpenApiPartyWire): Party {
  const meta = wire.metadata || {};
  const defaultAddress: Party["billingAddress"] = {
    line1: "100 Commerce Way",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "United States",
  };
  return {
    id: wire.id,
    type: wire.partyType || "customer",
    legalName: wire.name,
    tradeName: meta.tradeName || wire.name,
    taxRegistrationNumber: wire.taxId || "UNREGISTERED",
    contactPerson: meta.contactPerson || "Primary Contact",
    email: wire.email || "accounts@company.io",
    phone: wire.phone || "+1 (555) 010-0000",
    paymentTerms: meta.paymentTerms || "Net 30",
    currency: meta.currency || "USD",
    outstandingBalance: wire.balance || "0.00",
    billingAddress: meta.billingAddress || defaultAddress,
    shippingAddress: meta.shippingAddress || meta.billingAddress || defaultAddress,
    status: wire.status || "active",
  };
}

export function mapPartyToWirePayload(party: Party) {
  return {
    name: party.legalName || party.tradeName,
    partyType: party.type,
    email: party.email || null,
    phone: party.phone || null,
    taxId: party.taxRegistrationNumber || null,
    status: party.status,
    balance: party.outstandingBalance || "0.00",
    metadata: {
      tradeName: party.tradeName,
      contactPerson: party.contactPerson,
      paymentTerms: party.paymentTerms,
      currency: party.currency,
      billingAddress: party.billingAddress,
      shippingAddress: party.shippingAddress,
    },
  };
}

export function mapWireToItem(wire: OpenApiItemWire): ProductItem {
  const meta = wire.metadata || {};
  const normalizedType: ItemType =
    wire.itemType === "good" || wire.itemType === "goods"
      ? "goods"
      : wire.itemType === "service"
      ? "service"
      : "bundle";

  const qty = wire.stockQuantity ?? 0;
  const rop = wire.reorderPoint ?? 0;
  const computedStatus: ProductItem["status"] =
    wire.status === "in_stock" ||
    wire.status === "low_stock" ||
    wire.status === "out_of_stock"
      ? wire.status
      : normalizedType === "service"
      ? "in_stock"
      : qty <= 0
      ? "out_of_stock"
      : qty <= rop
      ? "low_stock"
      : "in_stock";

  return {
    id: wire.id,
    sku: wire.sku,
    barcode: meta.barcode,
    name: wire.name,
    type: normalizedType,
    category: wire.category || "Hardware",
    unit: wire.unit || "ea",
    costPrice: meta.costPrice || "0.00",
    unitPrice: wire.unitPrice || "0.00",
    taxCode: meta.taxCode || "TAX-STD",
    stockQuantity: qty,
    reorderPoint: rop,
    status: computedStatus,
    description: meta.description,
  };
}

export function mapItemToWirePayload(item: ProductItem) {
  return {
    sku: item.sku,
    name: item.name,
    itemType: item.type === "goods" ? "good" : item.type,
    category: item.category,
    unit: item.unit,
    unitPrice: item.unitPrice,
    stockQuantity: item.stockQuantity,
    reorderPoint: item.reorderPoint,
    status: item.status === "out_of_stock" ? "inactive" : "active",
    metadata: {
      barcode: item.barcode,
      costPrice: item.costPrice,
      taxCode: item.taxCode,
      description: item.description,
    },
  };
}

export function mapWireToAccount(wire: OpenApiAccountWire): Account {
  return {
    code: wire.code,
    name: wire.name,
    type: wire.type,
    subtype: wire.subtype,
    currency: wire.currency || "USD",
    balance: wire.balance || "0.00",
    active: wire.active ?? true,
    isSystem: wire.isSystem,
    description: wire.description,
  };
}

// ---------------------------------------------------------------------------
// Contract API Client Singleton
// ---------------------------------------------------------------------------

export const apiClient = {
  // ── MDM-01: Parties (Customers & Suppliers) ───────────────────────────────
  async listParties(params?: {
    partyType?: PartyType;
    status?: PartyStatus;
    search?: string;
  }): Promise<ApiResult<Party[]>> {
    const qs = new URLSearchParams();
    if (params?.partyType) qs.set("partyType", params.partyType);
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const endpoint = `/v1/master-data/parties${qs.toString() ? `?${qs.toString()}` : ""}`;

    try {
      const wireList = await requestJson<OpenApiPartyWire[]>(endpoint);
      return {
        data: wireList.map(mapWireToParty),
        isLive: true,
        endpoint: "/v1/master-data/parties",
      };
    } catch {
      return {
        data: [],
        isLive: false,
        endpoint: "/v1/master-data/parties",
      };
    }
  },

  async createParty(party: Party): Promise<ApiResult<Party>> {
    const endpoint = "/v1/master-data/parties";
    try {
      const created = await requestJson<OpenApiPartyWire>(endpoint, {
        method: "POST",
        body: JSON.stringify(mapPartyToWirePayload(party)),
      });
      return { data: mapWireToParty(created), isLive: true, endpoint };
    } catch {
      return { data: party, isLive: false, endpoint };
    }
  },

  async updateParty(party: Party): Promise<ApiResult<Party>> {
    const endpoint = `/v1/master-data/parties/${encodeURIComponent(party.id)}`;
    try {
      const updated = await requestJson<OpenApiPartyWire>(endpoint, {
        method: "PUT",
        body: JSON.stringify(mapPartyToWirePayload(party)),
      });
      return { data: mapWireToParty(updated), isLive: true, endpoint };
    } catch {
      return { data: party, isLive: false, endpoint };
    }
  },

  async deleteParty(id: string): Promise<ApiResult<{ id: string }>> {
    const endpoint = `/v1/master-data/parties/${encodeURIComponent(id)}`;
    try {
      await requestJson<void>(endpoint, { method: "DELETE" });
      return { data: { id }, isLive: true, endpoint };
    } catch {
      return { data: { id }, isLive: false, endpoint };
    }
  },

  // ── MDM-02: Item Master & Products ────────────────────────────────────────
  async listItems(params?: {
    itemType?: string;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResult<ProductItem[]>> {
    const qs = new URLSearchParams();
    if (params?.itemType) qs.set("itemType", params.itemType);
    if (params?.category) qs.set("category", params.category);
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const endpoint = `/v1/master-data/items${qs.toString() ? `?${qs.toString()}` : ""}`;

    try {
      const wireList = await requestJson<OpenApiItemWire[]>(endpoint);
      return {
        data: wireList.map(mapWireToItem),
        isLive: true,
        endpoint: "/v1/master-data/items",
      };
    } catch {
      return {
        data: [],
        isLive: false,
        endpoint: "/v1/master-data/items",
      };
    }
  },

  async createItem(item: ProductItem): Promise<ApiResult<ProductItem>> {
    const endpoint = "/v1/master-data/items";
    try {
      const created = await requestJson<OpenApiItemWire>(endpoint, {
        method: "POST",
        body: JSON.stringify(mapItemToWirePayload(item)),
      });
      return { data: mapWireToItem(created), isLive: true, endpoint };
    } catch {
      return { data: item, isLive: false, endpoint };
    }
  },

  async updateItem(item: ProductItem): Promise<ApiResult<ProductItem>> {
    const endpoint = `/v1/master-data/items/${encodeURIComponent(item.id)}`;
    try {
      const payload = mapItemToWirePayload(item);
      const updated = await requestJson<OpenApiItemWire>(endpoint, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return { data: mapWireToItem(updated), isLive: true, endpoint };
    } catch {
      return { data: item, isLive: false, endpoint };
    }
  },

  async deleteItem(id: string): Promise<ApiResult<{ id: string }>> {
    const endpoint = `/v1/master-data/items/${encodeURIComponent(id)}`;
    try {
      await requestJson<void>(endpoint, { method: "DELETE" });
      return { data: { id }, isLive: true, endpoint };
    } catch {
      return { data: { id }, isLive: false, endpoint };
    }
  },

  // ── MDM-03: Chart of Accounts ─────────────────────────────────────────────
  async listAccounts(): Promise<ApiResult<Account[]>> {
    const endpoint = "/v1/master-data/accounts";
    try {
      const wireList = await requestJson<OpenApiAccountWire[]>(endpoint);
      return {
        data: wireList.map(mapWireToAccount),
        isLive: true,
        endpoint,
      };
    } catch {
      return {
        data: [],
        isLive: false,
        endpoint,
      };
    }
  },

  async createAccount(account: Account): Promise<ApiResult<Account>> {
    const endpoint = "/v1/master-data/accounts";
    try {
      const created = await requestJson<OpenApiAccountWire>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          code: account.code,
          name: account.name,
          type: account.type,
        }),
      });
      return {
        data: {
          ...account,
          ...mapWireToAccount(created),
          description: account.description,
          currency: account.currency,
        },
        isLive: true,
        endpoint,
      };
    } catch {
      return { data: account, isLive: false, endpoint };
    }
  },

  async updateAccount(account: Account): Promise<ApiResult<Account>> {
    const endpoint = `/v1/master-data/accounts/${encodeURIComponent(account.code)}`;
    try {
      const updated = await requestJson<OpenApiAccountWire>(endpoint, {
        method: "PUT",
        body: JSON.stringify({
          name: account.name,
          active: account.active,
        }),
      });
      return {
        data: {
          ...account,
          ...mapWireToAccount(updated),
          description: account.description,
          currency: account.currency,
        },
        isLive: true,
        endpoint,
      };
    } catch {
      return { data: account, isLive: false, endpoint };
    }
  },

  // ── SAL-04 / FIN-02 / FIN-14: Invoicing, Statements & Chase Chloe ─────────
  async listInvoices(): Promise<
    ApiResult<{ invoices: Invoice[]; summary: InvoicesSummary }>
  > {
    const endpoint = "/v1/invoicing/invoices";
    try {
      const res = await requestJson<{
        invoices: Invoice[];
        summary: InvoicesSummary;
      }>(endpoint);
      return { data: res, isLive: true, endpoint };
    } catch {
      return {
        data: {
          invoices: [],
          summary: {
            totalReceivable: "0.00",
            overdue: "0.00",
            overdueCount: 0,
            paidThisMonth: "0.00",
            invoiceCount: 0,
          },
        },
        isLive: false,
        endpoint,
      };
    }
  },

  async createInvoice(invoice: Invoice): Promise<ApiResult<Invoice>> {
    const endpoint = "/v1/invoicing/invoices";
    try {
      const created = await requestJson<Invoice>(endpoint, {
        method: "POST",
        body: JSON.stringify(invoice),
      });
      return { data: created, isLive: true, endpoint };
    } catch {
      return { data: invoice, isLive: false, endpoint };
    }
  },

  async updateInvoice(invoice: Invoice): Promise<ApiResult<Invoice>> {
    const endpoint = `/v1/invoicing/invoices/${encodeURIComponent(invoice.id)}`;
    try {
      const updated = await requestJson<Invoice>(endpoint, {
        method: "PUT",
        body: JSON.stringify(invoice),
      });
      return { data: updated, isLive: true, endpoint };
    } catch {
      return { data: invoice, isLive: false, endpoint };
    }
  },

  async deleteInvoice(id: string): Promise<ApiResult<{ id: string }>> {
    const endpoint = `/v1/invoicing/invoices/${encodeURIComponent(id)}`;
    try {
      await requestJson<void>(endpoint, { method: "DELETE" });
      return { data: { id }, isLive: true, endpoint };
    } catch {
      return { data: { id }, isLive: false, endpoint };
    }
  },

  async markInvoicePaid(id: string): Promise<ApiResult<{ id: string }>> {
    const endpoint = `/v1/invoicing/invoices/${encodeURIComponent(id)}/pay`;
    try {
      await requestJson<void>(endpoint, { method: "POST" });
      return { data: { id }, isLive: true, endpoint };
    } catch {
      return { data: { id }, isLive: false, endpoint };
    }
  },

  async getCustomerStatement(
    partyId: string,
    fallbackParty?: Party,
    invoices?: Invoice[]
  ): Promise<ApiResult<CustomerStatement>> {
    const endpoint = `/v1/invoicing/statements/${encodeURIComponent(partyId)}`;
    try {
      const stmt = await requestJson<CustomerStatement>(endpoint);
      return { data: stmt, isLive: true, endpoint };
    } catch {
      if (mockCustomerStatements[partyId]) {
        return {
          data: mockCustomerStatements[partyId],
          isLive: false,
          endpoint,
        };
      }
      // Build statement from existing party + invoice records without browser arithmetic
      const partyInvoices = (invoices || []).filter(
        (inv) => inv.partyId === partyId
      );
      const firstInv = partyInvoices[0];
      const fallbackStmt: CustomerStatement = {
        partyId,
        partyName:
          fallbackParty?.tradeName ||
          fallbackParty?.legalName ||
          firstInv?.partyName ||
          "Customer Account",
        email: fallbackParty?.email || "ap@customer.io",
        phone: fallbackParty?.phone || "+1 (555) 010-0000",
        paymentTerms: fallbackParty?.paymentTerms || "Net 30",
        currentBalance:
          fallbackParty?.outstandingBalance ||
          firstInv?.balanceDue ||
          "0.00",
        overdueBalance:
          partyInvoices.find((i) => i.status === "overdue")?.balanceDue || "0.00",
        transactions: partyInvoices.map((inv, idx) => ({
          id: `st-line-${idx + 1}`,
          date: inv.issueDate,
          type: "Invoice" as const,
          reference: inv.invoiceNumber,
          amount: inv.total,
          balance: inv.balanceDue,
        })),
      };
      return { data: fallbackStmt, isLive: false, endpoint };
    }
  },

  async sendPaymentReminder(
    invoiceId: string,
    draft: ReminderDraft
  ): Promise<ApiResult<{ invoiceId: string; sentAt: string }>> {
    const endpoint = "/v1/invoicing/reminders";
    try {
      const res = await requestJson<{ invoiceId: string; sentAt: string }>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({ ...draft, invoiceId }),
        }
      );
      return { data: res, isLive: true, endpoint };
    } catch {
      return {
        data: { invoiceId, sentAt: new Date().toISOString() },
        isLive: false,
        endpoint,
      };
    }
  },

  buildOverdueInvoiceForReminder(
    invoice: Invoice,
    party?: Party
  ): OverdueInvoice {
    const existing = initialOverdueInvoices.find(
      (o) => o.id === invoice.invoiceNumber || o.id === invoice.id
    );
    if (existing) {
      return existing;
    }
    const displayName = party?.tradeName || party?.legalName || invoice.partyName;
    const email = party?.email || "ap@customer.io";
    return {
      id: invoice.invoiceNumber,
      partyId: invoice.partyId,
      partyName: displayName,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      amount: invoice.total,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.balanceDue,
      daysOverdue: invoice.status === "overdue" ? 14 : 3,
      agingBucket: invoice.status === "overdue" ? "1-30" : "current",
      status: "overdue",
      draftReminder: {
        id: `REM-${invoice.invoiceNumber}`,
        invoiceId: invoice.invoiceNumber,
        channel: "email",
        recipient: email,
        recipientName: displayName,
        subject: `Courtesy reminder: Invoice ${invoice.invoiceNumber} ($${invoice.balanceDue})`,
        message: `Hi ${displayName} team, friendly reminder from Apex Production: Invoice ${invoice.invoiceNumber} ($${invoice.balanceDue}) was due on ${invoice.dueDate}. Please let us know when payment has been scheduled. Thank you!`,
        tone: invoice.status === "overdue" ? "firm" : "friendly",
        status: "draft",
      },
    };
  },

  // ── FIN-01 & PLT-23: Ledger & Workspace Insights ──────────────────────────
  async listJournalEntries(): Promise<ApiResult<JournalEntry[]>> {
    const endpoint = "/v1/ledger/entries";
    try {
      const list = await requestJson<JournalEntry[]>(endpoint);
      return { data: list, isLive: true, endpoint };
    } catch {
      return { data: [], isLive: false, endpoint };
    }
  },

  async getWorkspaceInsights(): Promise<ApiResult<WorkspaceInsights>> {
    const endpoint = "/v1/workspace/insights";
    try {
      const data = await requestJson<WorkspaceInsights>(endpoint);
      return { data, isLive: true, endpoint };
    } catch {
      return { data: initialMockInsights, isLive: false, endpoint };
    }
  },

  // ── PLT-23 & FIN-01: Workspace Live Overview & Realtime Ledger Sync ────────
  async getWorkspaceOverview(): Promise<
    ApiResult<{
      principal: { email: string; roles: string[] };
      workspace: { slug: string; name: string };
      company: { id: string; name: string; currency: string; country: string };
      products: string[];
      booksReady: boolean;
      asOf: string;
      totals: {
        cash: string;
        revenue: string;
        expenses: string;
        profit: string;
        receivable: string;
        payable: string;
      };
      trend: Array<{ month: string; revenue: string; expenses: string }>;
      insights: Record<string, unknown>;
      accounts: Array<{ code: string; name: string; type: string; balance: string }>;
      recent: Array<{
        id: string;
        reference: string;
        date: string;
        memo?: string;
        reversal: boolean;
        amount: string;
        accounts: string[];
      }>;
    }>
  > {
    const endpoint = "/v1/workspace/overview";
    try {
      const data = await requestJson<{
        principal: { email: string; roles: string[] };
        workspace: { slug: string; name: string };
        company: { id: string; name: string; currency: string; country: string };
        products: string[];
        booksReady: boolean;
        asOf: string;
        totals: {
          cash: string;
          revenue: string;
          expenses: string;
          profit: string;
          receivable: string;
          payable: string;
        };
        trend: Array<{ month: string; revenue: string; expenses: string }>;
        insights: Record<string, unknown>;
        accounts: Array<{ code: string; name: string; type: string; balance: string }>;
        recent: Array<{
          id: string;
          reference: string;
          date: string;
          memo?: string;
          reversal: boolean;
          amount: string;
          accounts: string[];
        }>;
      }>(endpoint);
      return { data, isLive: true, endpoint };
    } catch {
      return {
        data: {
          principal: { email: "operator@apex.com", roles: ["owner"] },
          workspace: { slug: "apex", name: "Apex Production" },
          company: { id: "cmp_apex", name: "Apex Production LLC", currency: "USD", country: "US" },
          products: ["FIN-01", "MDM-01", "MDM-02", "MDM-03", "SAL-04"],
          booksReady: true,
          asOf: new Date().toISOString().slice(0, 10),
          totals: {
            cash: initialMockInsights.totals.cash,
            revenue: initialMockInsights.totals.revenue,
            expenses: initialMockInsights.totals.expenses,
            profit: initialMockInsights.totals.profit,
            receivable: initialMockInsights.totals.receivable ?? "18450.00",
            payable: initialMockInsights.totals.payable ?? "8650.00",
          },
          trend: initialMockInsights.trend.map((t) => ({
            month: t.month,
            revenue: t.sales,
            expenses: t.expenses,
          })),
          insights: {},
          accounts: [],
          recent: [],
        },
        isLive: false,
        endpoint,
      };
    }
  },

  async postQuickEntry(payload: {
    kind: "sale" | "expense" | "customer_payment" | "owner_investment";
    amount: string;
    date: string;
    via: "1000" | "1100" | "1200" | "2000";
    memo?: string;
    account?: string;
  }): Promise<ApiResult<{ id: string; reference: string }>> {
    const endpoint = "/v1/workspace/quick-entries";
    const res = await requestJson<{ id: string; reference: string }>(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { data: res, isLive: true, endpoint };
  },

  async postStarterBooks(): Promise<ApiResult<{ status: string }>> {
    const endpoint = "/v1/workspace/starter-books";
    const res = await requestJson<{ status: string }>(endpoint, {
      method: "POST",
    });
    return { data: res, isLive: true, endpoint };
  },

  async listBills(): Promise<ApiResult<Bill[]>> {
    const endpoint = "/v1/invoicing/bills";
    try {
      const res = await requestJson<{ bills: Bill[] }>(endpoint);
      return { data: res.bills, isLive: true, endpoint };
    } catch {
      return { data: [], isLive: false, endpoint };
    }
  },

  async createBill(bill: Bill): Promise<ApiResult<Bill>> {
    const endpoint = "/v1/invoicing/bills";
    try {
      const created = await requestJson<Bill>(endpoint, {
        method: "POST",
        body: JSON.stringify(bill),
      });
      return { data: created, isLive: true, endpoint };
    } catch {
      return { data: bill, isLive: false, endpoint };
    }
  },

  subscribeToEvents(
    onEvent: (event: { type: string; tenantId: string; occurredAt: string; payload: any }) => void,
    onStatusChange?: (status: "connected" | "connecting" | "disconnected") => void,
  ): () => void {
    if (typeof window === "undefined") return () => {};

    const token = getApiSessionToken() || "tok_demo";
    const url = `${getApiBaseUrl()}/v1/events/stream?token=${encodeURIComponent(token)}`;
    let eventSource: EventSource | null = null;
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      onStatusChange?.("connecting");
      try {
        eventSource = new EventSource(url);
        eventSource.onopen = () => {
          onStatusChange?.("connected");
        };
        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data && data.type !== "connected") {
              onEvent(data);
            }
          } catch {
            // Ignore malformed ping or comment
          }
        };
        eventSource.onerror = () => {
          onStatusChange?.("disconnected");
          eventSource?.close();
          eventSource = null;
          if (!isCancelled) {
            setTimeout(connect, 3000);
          }
        };
      } catch {
        onStatusChange?.("disconnected");
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      onStatusChange?.("disconnected");
    };
  },
};
