/**
 * Live API client for the stock and till screens. It calls only the real API. There is no mock fallback here:
 * a failed call is reported as a failure, never shown as sample figures (UI contract, section 5). Money stays as
 * the decimal strings the API returns, and the browser never adds it up.
 */

export interface Amount {
  amount: string;
  currency: string;
}

export interface LiveSession {
  token: string;
  companyId: string | null;
}

const SESSION_KEY = "qavril-session";
/** The token the demo sign-in writes. It is not a real session, so the live screens do not use it. */
const DEMO_TOKEN = "tok_demo";

/** The signed-in session for live calls, or null when there is none (signed out, or demo only). */
export function readLiveSession(): LiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw || raw === "signed-out") return null;
    const parsed = JSON.parse(raw) as { token?: unknown; companyId?: unknown };
    if (typeof parsed.token !== "string" || parsed.token === "" || parsed.token === DEMO_TOKEN) return null;
    return { token: parsed.token, companyId: typeof parsed.companyId === "string" ? parsed.companyId : null };
  } catch {
    return null;
  }
}

/** Remembers which company this viewer works on. The token is kept as it was. */
export function saveLiveCompany(companyId: string): void {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw && raw !== "signed-out" ? (JSON.parse(raw) as Record<string, unknown>) : {};
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...parsed, companyId }));
  } catch {
    // Storage can be blocked; the choice then lasts for this screen only.
  }
}

/**
 * Where the API is. With VITE_API_URL set (production), calls go there. Without it, calls are same-origin paths,
 * which the development server forwards to the API (see vite.config.ts), so the browser never needs CORS for them.
 */
function apiBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
  return envUrl ? envUrl.replace(/\/+$/, "") : "";
}

/** A failed call. `status` is 0 when the server could not be reached at all. */
export class LiveApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "LiveApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The reasons a sale was refused, when the server sends them (a 409 from the review endpoint). */
export function reasonsOf(error: unknown): string[] {
  if (!(error instanceof LiveApiError) || typeof error.details !== "object" || error.details === null) return [];
  const reasons = (error.details as { reasons?: unknown }).reasons;
  return Array.isArray(reasons) ? reasons.filter((item): item is string => typeof item === "string") : [];
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

interface CallOptions {
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly contentType?: string;
}

async function call<T>(method: "GET" | "POST", path: string, token: string, options: CallOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": options.contentType ?? "application/json",
      },
      body,
      signal: controller.signal,
    });
    const parsed = parseJson(await response.text());
    if (!response.ok) {
      const error = (parsed as { error?: { code?: unknown; message?: unknown } } | undefined)?.error;
      const code = typeof error?.code === "string" ? error.code : "HTTP";
      const message = typeof error?.message === "string" ? error.message : `The server answered ${response.status}.`;
      throw new LiveApiError(response.status, code, message, parsed);
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof LiveApiError) throw error;
    throw new LiveApiError(0, "NETWORK", "The server cannot be reached right now.");
  } finally {
    clearTimeout(timer);
  }
}

// ── Wire types (contracts/openapi.yaml) ─────────────────────────────────────

export interface LiveCompany {
  id: string;
  legalName: string;
  countryCode: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
}

export interface LiveBatch {
  id: string;
  companyId: string;
  warehouse: string;
  item: string;
  batchNo: string;
  expiresOn: string | null;
  receivedOn: string;
  receivedQty: string;
  balance: string;
  unitCost: Amount;
  receiptReference: string;
}

export interface LiveBatchStatus {
  batch: LiveBatch;
  daysLeft: number;
}

export interface LiveExpiryReport {
  asOf: string;
  expired: LiveBatchStatus[];
  expiringSoon: LiveBatchStatus[];
  expiredValue: Amount | null;
  expiringValue: Amount | null;
}

export interface LiveStockResult {
  allocations: { batchId: string; batchNo: string; expiresOn: string | null; qty: string; unitCost: Amount; cost: Amount }[];
  cost: Amount;
  entry: { id: string; reference: string; date: string } | null;
}

export interface LiveTransferResult {
  transferred: string;
  allocations: { batchId: string; batchNo: string; expiresOn: string | null; qty: string; unitCost: Amount }[];
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface LiveApproval {
  id: string;
  companyId: string;
  kind: string;
  reason: string;
  payload: Record<string, unknown>;
  requestedBy: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  effect?: Record<string, unknown>;
}

export interface LiveCountLine {
  batchId: string;
  batchNo: string;
  item: string;
  expiresOn: string | null;
  unitCost: Amount;
  counted: string | null;
  /** Present only for reviewers, or once the count is no longer open. */
  expected?: string;
  variance?: string | null;
}

export type CountStatus = "OPEN" | "SUBMITTED" | "APPLIED" | "CANCELLED";

export interface LiveCount {
  id: string;
  companyId: string;
  warehouse: string;
  date: string;
  status: CountStatus;
  lines: LiveCountLine[];
}

export interface LiveImportReport {
  rows: number;
  applied: boolean;
  created: number;
  repeated: number;
  errors: { row: number; message: string }[];
  totalQty: string;
  totalValue: Amount | null;
  createdValue: Amount | null;
  reconciliation: {
    stockAccount: string;
    before: Amount;
    after: Amount;
    change: Amount;
    expected: Amount;
    reconciled: boolean;
  };
}

export interface LivePriceLine {
  itemCode: string;
  description: string;
  qty: string;
  tracked: boolean;
  unitPrice: Amount;
  discount: Amount;
  billDiscount: Amount;
  net: Amount;
  tax: Amount;
  total: Amount;
}

export interface LivePriceResult {
  currency: string;
  lines: LivePriceLine[];
  billDiscount: Amount;
  subtotal: Amount;
  tax: Amount;
  total: Amount;
  tendered: Amount;
  change: Amount;
  problems: string[];
}

export type TenderMethod = "CASH" | "CARD" | "MOBILE";

export interface LiveDecision {
  decision: "POSTED" | "VOIDED";
  decidedBy: string;
  decidedAt: string;
  reason: string;
  postedOn: string | null;
  number: string | null;
  entryId: string | null;
  cost: Amount | null;
  change: Amount;
  tenders: { method: TenderMethod; amount: Amount }[];
}

export interface LiveSale {
  id: string;
  status: "POSTED" | "NEEDS_REVIEW";
  effectiveStatus: "POSTED" | "NEEDS_REVIEW" | "VOIDED";
  number: string | null;
  warehouse: string;
  date: string;
  currency: string;
  billDiscount: Amount;
  billDiscountReason: string | null;
  billDiscountApprovedBy: string | null;
  subtotal: Amount;
  tax: Amount;
  total: Amount;
  change: Amount;
  cost: Amount | null;
  tenders: { method: TenderMethod; amount: Amount }[];
  reasons: string[];
  recordedAt: string;
  resolution: LiveDecision | null;
}

export interface LiveSyncResult {
  id: string;
  status: "POSTED" | "NEEDS_REVIEW" | "REJECTED";
  number: string | null;
  duplicate: boolean;
  reasons: string[];
}

export interface LiveReviewResponse {
  sale: LiveSale;
  decision: LiveDecision | null;
  reasons: string[];
}

export interface LiveMe {
  principal: { userId: string; tenantId: string; permissions: string[] };
}

// ── Calls ───────────────────────────────────────────────────────────────────

export const liveApi = {
  async me(token: string): Promise<LiveMe> {
    return call<LiveMe>("GET", "/v1/me", token);
  },

  async companies(token: string): Promise<LiveCompany[]> {
    return (await call<{ companies: LiveCompany[] }>("GET", "/v1/companies", token)).companies;
  },

  async batches(token: string, companyId: string, filter: { warehouse?: string; item?: string } = {}): Promise<LiveBatch[]> {
    const qs = new URLSearchParams({ companyId });
    if (filter.warehouse) qs.set("warehouse", filter.warehouse);
    if (filter.item) qs.set("item", filter.item);
    return call<LiveBatch[]>("GET", `/v1/inventory/batches?${qs.toString()}`, token);
  },

  async expiry(token: string, companyId: string, asOf: string, withinDays: number): Promise<LiveExpiryReport> {
    const qs = new URLSearchParams({ companyId, asOf, withinDays: String(withinDays) });
    return call<LiveExpiryReport>("GET", `/v1/inventory/expiry?${qs.toString()}`, token);
  },

  async receive(token: string, body: Record<string, unknown>): Promise<LiveBatch> {
    return call<LiveBatch>("POST", "/v1/inventory/receipts", token, { body });
  },

  async transfer(token: string, body: Record<string, unknown>): Promise<LiveTransferResult> {
    return call<LiveTransferResult>("POST", "/v1/inventory/transfers", token, { body });
  },

  /** Asks for a write-off. Nothing moves until a second person approves it. */
  async requestWriteOff(token: string, body: Record<string, unknown>): Promise<LiveApproval> {
    return call<LiveApproval>("POST", "/v1/inventory/write-offs", token, { body });
  },

  async approvals(token: string, companyId: string, status?: ApprovalStatus): Promise<LiveApproval[]> {
    const qs = new URLSearchParams({ companyId });
    if (status) qs.set("status", status);
    return call<LiveApproval[]>("GET", `/v1/approvals?${qs.toString()}`, token);
  },

  async createApproval(token: string, body: Record<string, unknown>): Promise<LiveApproval> {
    return call<LiveApproval>("POST", "/v1/approvals", token, { body });
  },

  async approve(token: string, id: string, companyId: string, note?: string): Promise<LiveApproval> {
    return call<LiveApproval>("POST", `/v1/approvals/${id}/approve`, token, { body: note ? { companyId, note } : { companyId } });
  },

  async reject(token: string, id: string, companyId: string, note: string): Promise<LiveApproval> {
    return call<LiveApproval>("POST", `/v1/approvals/${id}/reject`, token, { body: { companyId, note } });
  },

  async counts(token: string, companyId: string): Promise<LiveCount[]> {
    return call<LiveCount[]>("GET", `/v1/inventory/counts?companyId=${companyId}`, token);
  },

  async startCount(token: string, body: Record<string, unknown>): Promise<LiveCount> {
    return call<LiveCount>("POST", "/v1/inventory/counts", token, { body });
  },

  async recordCountLine(token: string, countId: string, body: { companyId: string; batchId: string; counted: string }): Promise<LiveCount> {
    return call<LiveCount>("POST", `/v1/inventory/counts/${countId}/lines`, token, { body });
  },

  async submitCount(token: string, countId: string, body: Record<string, unknown>): Promise<{ count: LiveCount; approval: LiveApproval }> {
    return call<{ count: LiveCount; approval: LiveApproval }>("POST", `/v1/inventory/counts/${countId}/submit`, token, { body });
  },

  async cancelCount(token: string, countId: string, companyId: string): Promise<LiveCount> {
    return call<LiveCount>("POST", `/v1/inventory/counts/${countId}/cancel`, token, { body: { companyId } });
  },

  /** Imports receipts from CSV text. The default is a dry run, so the file is checked before anything is written. */
  async importReceipts(
    token: string,
    companyId: string,
    csv: string,
    accounts: { inventory: string; clearing: string; cogs: string; writeOff: string; countVariance?: string },
    dryRun: boolean,
  ): Promise<LiveImportReport> {
    const qs = new URLSearchParams({
      companyId,
      dryRun: dryRun ? "true" : "false",
      inventory: accounts.inventory,
      clearing: accounts.clearing,
      cogs: accounts.cogs,
      writeOff: accounts.writeOff,
    });
    if (accounts.countVariance) qs.set("countVariance", accounts.countVariance);
    return call<LiveImportReport>("POST", `/v1/inventory/imports/receipts?${qs.toString()}`, token, {
      rawBody: csv,
      contentType: "text/csv",
    });
  },

  /** Prices a sale in progress on the server. Nothing is stored. */
  async priceSale(token: string, body: Record<string, unknown>): Promise<LivePriceResult> {
    return call<LivePriceResult>("POST", "/v1/pos/sales/price", token, { body });
  },

  async syncSales(token: string, body: Record<string, unknown>): Promise<{ companyId: string; results: LiveSyncResult[] }> {
    return call<{ companyId: string; results: LiveSyncResult[] }>("POST", "/v1/pos/sales/sync", token, { body });
  },

  async sales(token: string, companyId: string, options: { status?: "POSTED" | "NEEDS_REVIEW"; pending?: boolean } = {}): Promise<LiveSale[]> {
    const qs = new URLSearchParams({ companyId });
    if (options.status) qs.set("status", options.status);
    if (options.pending) qs.set("pending", "true");
    return call<LiveSale[]>("GET", `/v1/pos/sales?${qs.toString()}`, token);
  },

  /** Decides a sale that needed review. A refused POST throws a LiveApiError with status 409 and the reasons. */
  async reviewSale(token: string, saleId: string, body: Record<string, unknown>): Promise<LiveReviewResponse> {
    return call<LiveReviewResponse>("POST", `/v1/pos/sales/${saleId}/review`, token, { body });
  },
};
