import { randomBytes } from "node:crypto";
import { type TicketStore } from "./stream-tickets";
import type { RealtimeBus, RealtimeMessage } from "./realtime-bus";

const STREAM_TICKET_TTL_SECONDS = 60;
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { createEvent } from "@erp/events";
import { DomainError, type Clock } from "@erp/kernel";
import { idempotencyKeyFrom, runIdempotent } from "./idempotency";
import { auditWrite, pick } from "./audit-write";
import type { Company } from "@erp/tenancy";
import { enqueueEmail, type EmailJobQueue } from "@erp/notifications";
import {
  INVOICE_ISSUED,
  INVOICE_PAID,
  PgInvoicingStore,
  PgNotificationStore,
  PgOutboxStore,
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
  private bus: RealtimeBus | null = null;

  /**
   * Sends events through a bus shared by all API instances. Without one, events reach only the
   * clients connected to this process.
   */
  attachBus(bus: RealtimeBus): void {
    this.bus = bus;
    bus.onMessage((tenantId, message) => this.deliver(tenantId, message));
  }

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
    const evt = { type, tenantId, occurredAt: new Date().toISOString(), payload };
    if (this.bus) {
      this.bus.publish(tenantId, evt);
    } else {
      this.deliver(tenantId, evt);
    }
  }

  private deliver(tenantId: string, evt: RealtimeMessage): void {
    const set = this.listeners.get(tenantId);
    if (!set || set.size === 0) return;
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

/**
 * Until edits post a reversal and a new entry, an invoice that is in the books may only change fields
 * that do not touch money, so the invoice and the ledger cannot drift apart.
 */
function assertEditableWhilePosted(
  before: { postingStatus: string; status: string; partyId: string; issueDate: string; subtotal: string; taxTotal: string; total: string; amountPaid: string; balanceDue: string },
  body: Partial<{ partyId: string; issueDate: string; status: string; subtotal: string; taxTotal: string; total: string; amountPaid: string; balanceDue: string }>,
): void {
  const moneyFields = ["partyId", "issueDate", "subtotal", "taxTotal", "total", "amountPaid", "balanceDue"] as const;
  const changed = moneyFields.filter((field) => body[field] !== undefined && body[field] !== before[field]);
  const leavingBooks = body.status !== undefined && ["draft", "paid", "void", "partially_paid"].includes(body.status) && body.status !== before.status;
  if (changed.length > 0 || leavingBooks) {
    throw new DomainError(
      "CONFLICT",
      "This invoice is in your books. Changing its amounts, customer, date or status will be supported soon; for now use the pay action.",
      { fields: leavingBooks ? [...changed, "status"] : changed },
    );
  }
}

const INVOICE_AUDIT_FIELDS = ["invoiceNumber", "partyId", "status", "currency", "subtotal", "taxTotal", "total", "amountPaid", "balanceDue"] as const;
const BILL_AUDIT_FIELDS = ["billNumber", "supplierId", "status", "currency", "subtotal", "taxTotal", "total", "amountPaid", "balanceDue"] as const;

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
  readonly tickets: TicketStore;
  /**
   * Where email sends are queued (the `notifications` queue). Without it, email reminders are
   * recorded as approved but not sent, because nothing could deliver them.
   */
  readonly emailQueue?: EmailJobQueue;
}

export function registerInvoicingRoutes(app: FastifyInstance, deps: InvoicingRouteDeps): void {
  /** Issues a ticket for one stream connection. The client calls this again after every reconnect. */
  app.post("/v1/events/tickets", async (request) => {
    const principal = await signedIn(request);
    const ticket = randomBytes(24).toString("base64url");
    await deps.tickets.issue(ticket, principal.tenantId, STREAM_TICKET_TTL_SECONDS);
    return { ticket, expiresInSeconds: STREAM_TICKET_TTL_SECONDS };
  });

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
    // A single-use ticket from POST /v1/events/tickets. The session token is never accepted in a URL.
    const q = request.query as { ticket?: string };
    const tenantId = typeof q.ticket === "string" && q.ticket.length > 0 ? await deps.tickets.consume(q.ticket) : null;
    if (!tenantId) {
      return reply.status(401).send({ error: { code: "UNAUTHENTICATED", message: "A valid stream ticket is required" } });
    }

    // Set Server-Sent Events headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", request.headers.origin || "*");
    reply.raw.setHeader("Vary", "Origin");
    reply.raw.flushHeaders();

    // Initial connection ack
    reply.raw.write(`data: ${JSON.stringify({ type: "connected", tenantId, time: deps.clock.now().toISOString() })}\n\n`);

    // Subscribe to live tenant events
    const unsubscribe = realtimeEvents.subscribe(tenantId, (evt) => {
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
    const principal = await signedIn(request, "sal.invoice.read");
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
    const principal = await signedIn(request, "sal.invoice.read");
    const { id } = request.params as { id: string };
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const invoice = await store.findInvoice(id);
      if (!invoice) throw new DomainError("NOT_FOUND", `Invoice ${id} not found`);
      return invoice;
    });
  });

  app.post("/v1/invoicing/invoices", async (request, reply) => {
    const principal = await signedIn(request, "sal.invoice.write");
    const body = CreateInvoiceBody.parse(request.body);
    const key = idempotencyKeyFrom(request);
    const result = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      runIdempotent(tx, { tenantId: principal.tenantId, scope: "invoicing.invoice.create", key, payload: body }, async () => {
        const company = await firstCompany(tx, principal.tenantId);
        const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
        let created = await store.createInvoice(company.id, body);
        await auditWrite(tx, deps.clock, principal, request, {
          action: "sales.invoice.create", entityType: "invoice", entityId: String((created as { id: string }).id),
          after: pick(created, INVOICE_AUDIT_FIELDS),
        });
        // An issued invoice reaches the books through the outbox, in this same transaction (rule 3).
        if (await store.queueForPosting(created.id)) {
          await new PgOutboxStore(tx).append([createEvent(INVOICE_ISSUED, principal.tenantId, { invoiceId: created.id }, deps.clock)]);
          created = (await store.findInvoice(created.id)) ?? created;
        }
        return { status: 201, body: created };
      }),
    );
    // A replayed response was already announced when it was first created.
    if (!result.replayed) realtimeEvents.broadcast(principal.tenantId, "sales.invoice.created", result.body);
    return reply.status(result.status).send(result.body);
  });

  app.put("/v1/invoicing/invoices/:id", async (request) => {
    const principal = await signedIn(request, "sal.invoice.write");
    const { id } = request.params as { id: string };
    const body = UpdateInvoiceBody.parse(request.body);
    const updated = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const before = await store.findInvoice(id);
      if (before && before.postingStatus !== "NOT_POSTED") assertEditableWhilePosted(before, body);
      let result = await store.updateInvoice(id, body);
      await auditWrite(tx, deps.clock, principal, request, {
        action: "sales.invoice.update", entityType: "invoice", entityId: id,
        before: pick(before, INVOICE_AUDIT_FIELDS), after: pick(result, INVOICE_AUDIT_FIELDS),
      });
      // A draft that is issued now goes to the books.
      if (before?.status === "draft" && (await store.queueForPosting(id))) {
        await new PgOutboxStore(tx).append([createEvent(INVOICE_ISSUED, principal.tenantId, { invoiceId: id }, deps.clock)]);
        result = (await store.findInvoice(id)) ?? result;
      }
      return result;
    });

    realtimeEvents.broadcast(principal.tenantId, "sales.invoice.updated", updated);
    return updated;
  });

  app.delete("/v1/invoicing/invoices/:id", async (request, reply) => {
    const principal = await signedIn(request, "sal.invoice.write");
    const { id } = request.params as { id: string };
    await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const before = await store.findInvoice(id);
      if (before && before.postingStatus !== "NOT_POSTED") {
        throw new DomainError("CONFLICT", "This invoice is in your books and cannot be deleted yet. Voiding it will be supported soon.");
      }
      await store.deleteInvoice(id);
      await auditWrite(tx, deps.clock, principal, request, {
        action: "sales.invoice.delete", entityType: "invoice", entityId: id, before: pick(before, INVOICE_AUDIT_FIELDS), after: null,
      });
    });

    realtimeEvents.broadcast(principal.tenantId, "sales.invoice.deleted", { id });
    return reply.status(204).send();
  });

  app.post("/v1/invoicing/invoices/:id/pay", async (request) => {
    const principal = await signedIn(request, "sal.invoice.write");
    const { id } = request.params as { id: string };
    const key = idempotencyKeyFrom(request);
    const result = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      runIdempotent(tx, { tenantId: principal.tenantId, scope: "invoicing.invoice.pay", key, payload: { id } }, async () => {
        const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
        const before = await store.findInvoice(id);
        const paid = await store.markInvoicePaid(id);
        // Money received reaches the books too, for an invoice that is in them and was not already paid.
        if (before && before.postingStatus !== "NOT_POSTED" && before.status !== "paid" && before.balanceDue !== "0.00") {
          await new PgOutboxStore(tx).append([
            createEvent(INVOICE_PAID, principal.tenantId, {
              invoiceId: id, amount: before.balanceDue, date: deps.clock.now().toISOString().slice(0, 10), sequence: 1,
            }, deps.clock),
          ]);
        }
        await auditWrite(tx, deps.clock, principal, request, {
          action: "sales.invoice.pay", entityType: "invoice", entityId: id,
          before: pick(before, INVOICE_AUDIT_FIELDS), after: pick(paid, INVOICE_AUDIT_FIELDS),
        });
        return { status: 200, body: paid };
      }),
    );
    if (!result.replayed) realtimeEvents.broadcast(principal.tenantId, "sales.invoice.paid", result.body);
    return result.body;
  });

  // ==========================================
  // Customer Statement (FIN-02)
  // ==========================================
  app.get("/v1/invoicing/statements/:partyId", async (request) => {
    const principal = await signedIn(request, "sal.invoice.read");
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
    const principal = await signedIn(request, "sal.invoice.write");
    const body = RecordReminderBody.parse(request.body);
    // "sent" means handed to delivery. Only email can be delivered today, and only when a queue is
    // configured; anything else is recorded as approved so the books never claim a send that did not happen.
    let status = body.status ?? "sent";
    let notificationId: string | null = null;
    if (status === "sent") {
      if (body.channel === "email" && deps.emailQueue) {
        const subject = body.subject?.trim() || `Payment reminder from your supplier`;
        if (/[\r\n]/.test(subject)) {
          throw new DomainError("VALIDATION", "Subject must be a single line");
        }
        const queued = await enqueueEmail(new PgNotificationStore(deps.pool), deps.emailQueue, {
          tenantId: principal.tenantId,
          templateKey: "invoice.reminder",
          to: body.recipient,
          email: { subject, text: body.message },
        });
        notificationId = queued.id;
      } else {
        status = "approved";
      }
    }
    const recorded = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      return store.recordPaymentReminder(company.id, { ...body, status });
    });

    realtimeEvents.broadcast(principal.tenantId, "receivables.reminder.sent", recorded);
    return reply.status(201).send({ ...recorded, notificationId });
  });

  // ==========================================
  // Vendor Bills (FIN-03 & AP)
  // ==========================================
  app.get("/v1/invoicing/bills", async (request) => {
    const principal = await signedIn(request, "prc.bill.read");
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
      const bills = await store.listBills(company.id);
      return { bills };
    });
  });

  app.post("/v1/invoicing/bills", async (request, reply) => {
    const principal = await signedIn(request, "prc.bill.write");
    const body = CreateBillBody.parse(request.body);
    const key = idempotencyKeyFrom(request);
    const result = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      runIdempotent(tx, { tenantId: principal.tenantId, scope: "invoicing.bill.create", key, payload: body }, async () => {
        const company = await firstCompany(tx, principal.tenantId);
        const store = new PgInvoicingStore(tx, principal.tenantId, deps.clock);
        const created = await store.createBill(company.id, body);
        await auditWrite(tx, deps.clock, principal, request, {
          action: "purchasing.bill.create", entityType: "bill", entityId: String((created as { id: string }).id),
          after: pick(created, BILL_AUDIT_FIELDS),
        });
        return { status: 201, body: created };
      }),
    );
    if (!result.replayed) realtimeEvents.broadcast(principal.tenantId, "purchasing.bill.created", result.body);
    return reply.status(result.status).send(result.body);
  });
}
