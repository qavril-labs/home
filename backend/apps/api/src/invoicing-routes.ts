import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { DomainError, type Clock } from "@erp/kernel";
import type { Company } from "@erp/tenancy";
import {
  PgInvoicingStore,
  PgTenantRepository,
  withTenantTransaction,
  type Pool,
  type Queryable,
} from "@erp/db";

// In-process Real-Time Event Broadcaster for Server-Sent Events (SSE)
export type RealtimeEventListener = (event: {
  type: string;
  tenantId: string;
  occurredAt: string;
  payload: unknown;
}) => void;

export class RealtimeEventManager {
  private readonly listeners = new Map<string, Set<RealtimeEventListener>>();

  subscribe(tenantId: string, listener: RealtimeEventListener): () => void {
    let set = this.listeners.get(tenantId);
    if (!set) {
      set = new Set();
      this.listeners.set(tenantId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set?.size === 0) {
        this.listeners.delete(tenantId);
      }
    };
  }

  broadcast(tenantId: string, type: string, payload: unknown): void {
    const set = this.listeners.get(tenantId);
    if (!set || set.size === 0) return;
    const evt = {
      type,
      tenantId,
      occurredAt: new Date().toISOString(),
      payload,
    };
    for (const listener of set) {
      try {
        listener(evt);
      } catch {
        // Ignore single subscriber delivery error
      }
    }
  }
}

export const realtimeEvents = new RealtimeEventManager();

async function firstCompany(tx: Queryable, tenantId: string): Promise<Company> {
  const { rows } = await tx.query<{ id: string }>(
    "SELECT id FROM companies WHERE tenant_id = $1 ORDER BY id LIMIT 1",
    [tenantId],
  );
  const id = rows[0]?.id;
  const company = id ? await new PgTenantRepository(tx).findCompany(id) : null;
  if (!company) throw new DomainError("NOT_FOUND", "This workspace has no company yet");
  return company;
}

const CreateInvoiceLineBody = z.object({
  itemId: z.string().uuid().optional().nullable(),
  sku: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().trim().max(20).optional(),
  unitPrice: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  taxRate: z.string().trim().optional(),
  taxCode: z.string().trim().max(50).optional().nullable(),
  lineTotal: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
});

const CreateInvoiceBody = z.object({
  partyId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(64),
  issueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().trim().max(10).optional(),
  status: z.enum(["draft", "issued", "sent", "partially_paid", "paid", "overdue", "void"]).optional(),
  subtotal: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  taxTotal: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  total: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  amountPaid: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  balanceDue: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  paymentTerms: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(CreateInvoiceLineBody).min(1),
});

const UpdateInvoiceBody = CreateInvoiceBody.partial().omit({ lines: true });

const CreateBillLineBody = z.object({
  itemId: z.string().uuid().optional().nullable(),
  sku: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().trim().max(20).optional(),
  unitCost: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  accountCode: z.string().trim().max(20).optional().nullable(),
  lineTotal: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
});

const CreateBillBody = z.object({
  supplierId: z.string().uuid(),
  billNumber: z.string().trim().min(1).max(64),
  vendorInvoiceNumber: z.string().trim().max(64).optional().nullable(),
  issueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().trim().max(10).optional(),
  status: z.enum(["draft", "pending_approval", "approved", "paid", "overdue", "disputed"]).optional(),
  subtotal: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  taxTotal: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  total: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/),
  amountPaid: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  balanceDue: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(CreateBillLineBody).min(1),
});

const RecordReminderBody = z.object({
  invoiceId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email"]),
  recipient: z.string().trim().min(1).max(254),
  recipientName: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(300).optional().nullable(),
  message: z.string().trim().min(1).max(4000),
  tone: z.enum(["friendly", "firm", "urgent"]),
  status: z.enum(["draft", "approved", "sent"]).optional(),
});

export interface InvoicingRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

export function registerInvoicingRoutes(app: FastifyInstance, deps: InvoicingRouteDeps): void {
  async function signedIn(request: FastifyRequest, permission?: string): Promise<Principal> {
    const principal = await deps.authenticate(request);
    if (permission && !hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return principal;
  }

  // ==========================================
  // Real-Time Event Streaming (SSE / Step 3)
  // ==========================================
  app.get("/v1/events/stream", async (request: FastifyRequest, reply: FastifyReply) => {
    // Authenticate via Authorization header or ?token= query parameter (for standard EventSource)
    let token = "";
    const authHeader = request.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      const q = request.query as { token?: string };
      if (q.token) token = q.token;
    }

    if (!token) {
      return reply.status(401).send({ error: { code: "UNAUTHENTICATED", message: "Token required for live event stream" } });
    }

    let principal: Principal;
    try {
      request.headers.authorization = `Bearer ${token}`;
      principal = await deps.authenticate(request);
    } catch (err) {
      return reply.status(401).send({ error: { code: "UNAUTHENTICATED", message: "Invalid or expired token" } });
    }

    // Set Server-Sent Events headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", request.headers.origin || "*");
    reply.raw.setHeader("Vary", "Origin");
    reply.raw.flushHeaders();

    // Initial connection ack
    reply.raw.write(`data: ${JSON.stringify({ type: "connected", tenantId: principal.tenantId, time: deps.clock.now().toISOString() })}\n\n`);

    // Subscribe to live tenant events
    const unsubscribe = realtimeEvents.subscribe(principal.tenantId, (evt) => {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    });

    // Keepalive ping every 15 seconds
    const pingInterval = setInterval(() => {
      reply.raw.write(":ping\n\n");
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(pingInterval);
      unsubscribe();
    });

    return reply;
  });

  // ==========================================
  // Invoices (SAL-04 & AR)
  // ==========================================
  app.get("/v1/invoicing/invoices", async (request) => {
    const principal = await signedIn(request);
    const query = request.query as { status?: string; search?: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const [invoices, summary] = await Promise.all([
        store.listInvoices(company.id, query),
        store.getInvoicesSummary(company.id),
      ]);
      return { invoices, summary };
    });
  });

  app.get("/v1/invoicing/invoices/:id", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const invoice = await store.findInvoice(id);
      if (!invoice) throw new DomainError("NOT_FOUND", `Invoice ${id} not found`);
      return invoice;
    });
  });

  app.post("/v1/invoicing/invoices", async (request, reply) => {
    const principal = await signedIn(request);
    const body = CreateInvoiceBody.parse(request.body);
    const created = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.createInvoice(company.id, body);
    });

    // Real-time broadcast
    realtimeEvents.broadcast(principal.tenantId, "sales.invoice.created", created);
    return reply.status(201).send(created);
  });

  app.put("/v1/invoicing/invoices/:id", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    const body = UpdateInvoiceBody.parse(request.body);
    const updated = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.updateInvoice(id, body);
    });

    realtimeEvents.broadcast(principal.tenantId, "sales.invoice.updated", updated);
    return updated;
  });

  app.delete("/v1/invoicing/invoices/:id", async (request, reply) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      await store.deleteInvoice(id);
    });

    realtimeEvents.broadcast(principal.tenantId, "sales.invoice.deleted", { id });
    return reply.status(204).send();
  });

  app.post("/v1/invoicing/invoices/:id/pay", async (request) => {
    const principal = await signedIn(request);
    const { id } = request.params as { id: string };
    const updated = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.markInvoicePaid(id);
    });

    realtimeEvents.broadcast(principal.tenantId, "sales.invoice.paid", updated);
    return updated;
  });

  // ==========================================
  // Customer Statement (FIN-02)
  // ==========================================
  app.get("/v1/invoicing/statements/:partyId", async (request) => {
    const principal = await signedIn(request);
    const { partyId } = request.params as { partyId: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.getCustomerStatement(company.id, partyId);
    });
  });

  // ==========================================
  // Chase Chloe Reminders (FIN-14)
  // ==========================================
  app.post("/v1/invoicing/reminders", async (request, reply) => {
    const principal = await signedIn(request);
    const body = RecordReminderBody.parse(request.body);
    const recorded = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.recordPaymentReminder(company.id, body);
    });

    realtimeEvents.broadcast(principal.tenantId, "receivables.reminder.sent", recorded);
    return reply.status(201).send(recorded);
  });

  // ==========================================
  // Vendor Bills (FIN-03 & AP)
  // ==========================================
  app.get("/v1/invoicing/bills", async (request) => {
    const principal = await signedIn(request);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const bills = await store.listBills(company.id);
      return { bills };
    });
  });

  app.post("/v1/invoicing/bills", async (request, reply) => {
    const principal = await signedIn(request);
    const body = CreateBillBody.parse(request.body);
    const created = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.createBill(company.id, body);
    });

    realtimeEvents.broadcast(principal.tenantId, "purchasing.bill.created", created);
    return reply.status(201).send(created);
  });
}
