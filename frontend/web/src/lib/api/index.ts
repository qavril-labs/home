/**
 * Generated contract-compliant HTTP client from contracts/openapi.yaml.
 * Provides strong typing for API queries, mutations and error payloads.
 */
import type { Operations } from "./schema";

export interface ApiClientOptions {
  baseUrl?: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
}

export interface ApiResult<T> {
  data: T;
  isLive: boolean;
  status: number;
  endpoint: string;
}

export class ContractApiClient {
  private baseUrl: string;
  private getToken: () => string | null;
  private onUnauthorized?: () => void;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || "";
    this.getToken = options.getToken || (() => null);
    this.onUnauthorized = options.onUnauthorized;
  }

  public async request<K extends keyof Operations>(
    operationId: K,
    params?: {
      pathParams?: Record<string, string | number>;
      queryParams?: Record<string, string | number | boolean | undefined>;
      body?: Operations[K] extends { requestBody: infer B } ? B : never;
      idempotencyKey?: string;
    }
  ): Promise<ApiResult<Operations[K] extends { response: infer R } ? R : unknown>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (params?.idempotencyKey) {
      headers["Idempotency-Key"] = params.idempotencyKey;
    }

    // Route lookup table
    const routeMeta = this.getOperationRoute(operationId);
    let resolvedPath = routeMeta.path;
    if (params?.pathParams) {
      for (const [key, val] of Object.entries(params.pathParams)) {
        resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(val)));
      }
    }

    if (params?.queryParams) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(params.queryParams)) {
        if (val !== undefined) {
          searchParams.append(key, String(val));
        }
      }
      const qs = searchParams.toString();
      if (qs) resolvedPath += `?${qs}`;
    }

    const url = `${this.baseUrl}${resolvedPath}`;
    try {
      const res = await fetch(url, {
        method: routeMeta.method,
        headers,
        body: params?.body ? JSON.stringify(params.body) : undefined,
      });

      if (res.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }

      const data = await res.json().catch(() => ({}));
      return {
        data: data as any,
        isLive: true,
        status: res.status,
        endpoint: resolvedPath,
      };
    } catch (err) {
      return {
        data: {} as any,
        isLive: false,
        status: 0,
        endpoint: resolvedPath,
      };
    }
  }

  private getOperationRoute(opId: keyof Operations): { method: string; path: string } {
    const routes: Record<keyof Operations, { method: string; path: string }> = {
      "getHealth": { method: "GET", path: "/health" },
      "submitLead": { method: "POST", path: "/v1/public/leads" },
      "signUp": { method: "POST", path: "/v1/public/signup" },
      "login": { method: "POST", path: "/v1/auth/login" },
      "logout": { method: "POST", path: "/v1/auth/logout" },
      "forgotPassword": { method: "POST", path: "/v1/auth/forgot-password" },
      "resetPassword": { method: "POST", path: "/v1/auth/reset-password" },
      "getMe": { method: "GET", path: "/v1/me" },
      "getWorkspaceOverview": { method: "GET", path: "/v1/workspace/overview" },
      "getWorkspaceInsights": { method: "GET", path: "/v1/workspace/insights" },
      "setUpStarterBooks": { method: "POST", path: "/v1/workspace/starter-books" },
      "postQuickEntry": { method: "POST", path: "/v1/workspace/quick-entries" },
      "listParties": { method: "GET", path: "/v1/master-data/parties" },
      "createParty": { method: "POST", path: "/v1/master-data/parties" },
      "getParty": { method: "GET", path: "/v1/master-data/parties/{id}" },
      "updateParty": { method: "PUT", path: "/v1/master-data/parties/{id}" },
      "deleteParty": { method: "DELETE", path: "/v1/master-data/parties/{id}" },
      "listItems": { method: "GET", path: "/v1/master-data/items" },
      "createItem": { method: "POST", path: "/v1/master-data/items" },
      "getItem": { method: "GET", path: "/v1/master-data/items/{id}" },
      "updateItem": { method: "PUT", path: "/v1/master-data/items/{id}" },
      "deleteItem": { method: "DELETE", path: "/v1/master-data/items/{id}" },
      "listMasterDataAccounts": { method: "GET", path: "/v1/master-data/accounts" },
      "createMasterDataAccount": { method: "POST", path: "/v1/master-data/accounts" },
      "updateMasterDataAccount": { method: "PUT", path: "/v1/master-data/accounts/{code}" },
      "createAccount": { method: "POST", path: "/v1/ledger/accounts" },
      "listEntries": { method: "GET", path: "/v1/ledger/journal-entries" },
      "postJournalEntry": { method: "POST", path: "/v1/ledger/journal-entries" },
      "reverseJournalEntry": { method: "POST", path: "/v1/ledger/journal-entries/{id}/reverse" },
      "getTrialBalance": { method: "GET", path: "/v1/ledger/trial-balance" },
      "getBankLines": { method: "GET", path: "/v1/banking/lines" },
      "importBankStatement": { method: "POST", path: "/v1/banking/statements/import" },
      "reconcileBankLine": { method: "POST", path: "/v1/banking/reconcile" },
      "unreconcileBankLine": { method: "POST", path: "/v1/banking/unreconcile" },
      "listAgents": { method: "GET", path: "/v1/agents" },
      "sendAgentMessage": { method: "POST", path: "/v1/agents/{agentId}/messages" },
      "listApprovals": { method: "GET", path: "/v1/approvals" },
      "getApproval": { method: "GET", path: "/v1/approvals/{approvalId}" },
      "decideApproval": { method: "POST", path: "/v1/approvals/{approvalId}/decision" },
      "postEventTicket": { method: "POST", path: "/v1/events/tickets" },
      "getAdminCmsArticles": { method: "GET", path: "/v1/admin/cms/articles" },
      "postAdminCmsArticles": { method: "POST", path: "/v1/admin/cms/articles" },
      "putAdminCmsArticlesId": { method: "PUT", path: "/v1/admin/cms/articles/{id}" },
      "deleteAdminCmsArticlesId": { method: "DELETE", path: "/v1/admin/cms/articles/{id}" },
      "postAdminCmsAuthVerify": { method: "POST", path: "/v1/admin/cms/auth/verify" },
      "getAdminCmsFaqs": { method: "GET", path: "/v1/admin/cms/faqs" },
      "postAdminCmsFaqs": { method: "POST", path: "/v1/admin/cms/faqs" },
      "putAdminCmsFaqsId": { method: "PUT", path: "/v1/admin/cms/faqs/{id}" },
      "deleteAdminCmsFaqsId": { method: "DELETE", path: "/v1/admin/cms/faqs/{id}" },
      "getAdminCmsLeads": { method: "GET", path: "/v1/admin/cms/leads" },
      "getAdminCmsOverview": { method: "GET", path: "/v1/admin/cms/overview" },
      "getAdminCmsPages": { method: "GET", path: "/v1/admin/cms/pages" },
      "putAdminCmsPagesSlug": { method: "PUT", path: "/v1/admin/cms/pages/{slug}" },
      "getAdminCmsSettings": { method: "GET", path: "/v1/admin/cms/settings" },
      "putAdminCmsSettings": { method: "PUT", path: "/v1/admin/cms/settings" },
      "getEventsStream": { method: "GET", path: "/v1/events/stream" },
      "getInvoicingBills": { method: "GET", path: "/v1/invoicing/bills" },
      "postInvoicingBills": { method: "POST", path: "/v1/invoicing/bills" },
      "getInvoicingInvoices": { method: "GET", path: "/v1/invoicing/invoices" },
      "postInvoicingInvoices": { method: "POST", path: "/v1/invoicing/invoices" },
      "getInvoicingInvoicesId": { method: "GET", path: "/v1/invoicing/invoices/{id}" },
      "putInvoicingInvoicesId": { method: "PUT", path: "/v1/invoicing/invoices/{id}" },
      "deleteInvoicingInvoicesId": { method: "DELETE", path: "/v1/invoicing/invoices/{id}" },
      "postInvoicingInvoicesIdPay": { method: "POST", path: "/v1/invoicing/invoices/{id}/pay" },
      "postInvoicingReminders": { method: "POST", path: "/v1/invoicing/reminders" },
      "getInvoicingStatementsPartyId": { method: "GET", path: "/v1/invoicing/statements/{partyId}" },
      "postLedgerFiscalYears": { method: "POST", path: "/v1/ledger/fiscal-years" },
      "postLedgerFxRates": { method: "POST", path: "/v1/ledger/fx-rates" },
      "postPlatformTenants": { method: "POST", path: "/v1/platform/tenants" },
      "postPlatformTenantsTenantIdProducts": { method: "POST", path: "/v1/platform/tenants/{tenantId}/products" },
      "getPublicCmsArticles": { method: "GET", path: "/v1/public/cms/articles" },
      "getPublicCmsArticlesSlug": { method: "GET", path: "/v1/public/cms/articles/{slug}" },
      "getPublicCmsFaqs": { method: "GET", path: "/v1/public/cms/faqs" },
      "getPublicCmsPages": { method: "GET", path: "/v1/public/cms/pages" },
      "getPublicCmsPagesSlug": { method: "GET", path: "/v1/public/cms/pages/{slug}" },
      "getPublicCmsSettings": { method: "GET", path: "/v1/public/cms/settings" },
      "listPurchaseOrders": { method: "GET", path: "/v1/procurement/orders" },
      "createPurchaseOrder": { method: "POST", path: "/v1/procurement/orders" },
      "updatePurchaseOrderStatus": { method: "PATCH", path: "/v1/procurement/orders/{id}/status" },
      "listGoodsReceipts": { method: "GET", path: "/v1/procurement/receipts" },
      "createGoodsReceipt": { method: "POST", path: "/v1/procurement/receipts" },
      "listThreeWayMatches": { method: "GET", path: "/v1/procurement/matches" },
      "overrideThreeWayMatch": { method: "POST", path: "/v1/procurement/matches/{id}/override" },
      "listApprovalRequests": { method: "GET", path: "/v1/approval-requests" },
      "createApprovalRequest": { method: "POST", path: "/v1/approval-requests" },
      "listAgentAuditLogs": { method: "GET", path: "/v1/approval-requests/audit-logs" },
      "getApprovalRequest": { method: "GET", path: "/v1/approval-requests/{id}" },
      "approveApprovalRequest": { method: "POST", path: "/v1/approval-requests/{id}/approve" },
      "rejectApprovalRequest": { method: "POST", path: "/v1/approval-requests/{id}/reject" },
      "listNotifications": { method: "GET", path: "/v1/notifications" },
      "getNotification": { method: "GET", path: "/v1/notifications/{id}" },
    };
    return routes[opId] || { method: 'GET', path: '/health' };
  }
}

export const defaultContractClient = new ContractApiClient();

export * from "./schema";