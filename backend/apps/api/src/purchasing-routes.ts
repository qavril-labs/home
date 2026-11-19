import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Principal } from "@erp/identity";
import { DomainError, type Clock } from "@erp/kernel";
import type { Company } from "@erp/tenancy";
import {
  PgPurchasingStore,
  withTenantTransaction,
  type Pool,
  type Queryable,
} from "@erp/db";
import { realtimeEvents } from "./invoicing-routes";

export interface PurchasingRouteDeps {
  pool: Pool;
  clock?: Clock;
  purchasingStore?: PgPurchasingStore;
  authenticate: (req: FastifyRequest) => Promise<Principal>;
  findCompany?: (queryable: Queryable, tenantId: string) => Promise<Company | null>;
}

const POLineItemSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  sku: z.string().min(1),
  description: z.string().min(1),
  quantityOrdered: z.number().positive(),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a decimal string"),
  lineTotal: z.string().optional(),
});

const CreatePurchaseOrderSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().min(1),
  supplierName: z.string().min(1),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Order date must be YYYY-MM-DD"),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected delivery date must be YYYY-MM-DD"),
  status: z.enum(["draft", "issued", "partially_received", "received", "billed", "closed", "cancelled"]).optional(),
  currency: z.string().optional(),
  total: z.string().optional(),
  notes: z.string().optional(),
  approvedBy: z.string().optional(),
  lines: z.array(POLineItemSchema).min(1),
});

const UpdatePOStatusSchema = z.object({
  status: z.enum(["draft", "issued", "partially_received", "received", "billed", "closed", "cancelled"]),
});

const GRNLineItemSchema = z.object({
  id: z.string().optional(),
  poLineId: z.string().optional(),
  sku: z.string().min(1),
  description: z.string().min(1),
  quantityReceived: z.number().positive(),
  quantityRejected: z.number().nonnegative().optional(),
  batchLotNumber: z.string().optional(),
  warehouseId: z.string().min(1),
  warehouseName: z.string().min(1),
});

const CreateGoodsReceiptSchema = z.object({
  id: z.string().optional(),
  poId: z.string().min(1),
  poRef: z.string().min(1),
  supplierId: z.string().min(1),
  supplierName: z.string().min(1),
  receiptDate: z.string().optional(),
  receivedBy: z.string().min(1),
  status: z.enum(["received", "inspected", "quarantined"]).optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(GRNLineItemSchema).min(1),
});

const MatchOverrideSchema = z.object({
  note: z.string().min(1),
});

export function registerPurchasingRoutes(
  app: FastifyInstance,
  deps: PurchasingRouteDeps
): void {
  const store = deps.purchasingStore ?? new PgPurchasingStore(deps.clock);

  async function resolvePrincipalAndCompany(req: FastifyRequest): Promise<{
    principal: Principal;
    companyId: string;
  }> {
    const principal = await deps.authenticate(req);
    const companyId = await withTenantTransaction(
      deps.pool,
      principal.tenantId,
      async (tx) => {
        if (deps.findCompany) {
          const comp = await deps.findCompany(tx, principal.tenantId);
          if (comp) return comp.id;
        }
        const { rows } = await tx.query<{ id: string }>(
          "SELECT id FROM companies WHERE tenant_id = $1 ORDER BY id LIMIT 1",
          [principal.tenantId]
        );
        const id = rows[0]?.id;
        if (!id) {
          throw new DomainError("NOT_FOUND", "Company not found for tenant");
        }
        return id;
      }
    );

    return { principal, companyId };
  }

  // 1. List Purchase Orders
  app.get("/v1/procurement/orders", async (request) => {
    const { principal } = await resolvePrincipalAndCompany(request);
    const query = request.query as { status?: string; limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 100;

    const orders = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.listPurchaseOrders(tx, { status: query.status, limit })
    );

    return { ok: true, orders };
  });

  // 2. Create Purchase Order
  app.post("/v1/procurement/orders", async (request, reply) => {
    const { principal, companyId } = await resolvePrincipalAndCompany(request);
    const parsed = CreatePurchaseOrderSchema.parse(request.body);

    const order = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.createPurchaseOrder(tx, principal.tenantId, {
        ...parsed,
        companyId,
      })
    );

    realtimeEvents.broadcast(principal.tenantId, "procurement.order.created", order);

    return reply.status(201).send({ ok: true, order });
  });

  // 3. Update Purchase Order Status
  app.patch("/v1/procurement/orders/:id/status", async (request) => {
    const { principal } = await resolvePrincipalAndCompany(request);
    const { id } = request.params as { id: string };
    const { status } = UpdatePOStatusSchema.parse(request.body);

    await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.updatePurchaseOrderStatus(tx, id, status)
    );

    realtimeEvents.broadcast(principal.tenantId, "procurement.order.updated", { id, status });

    return { ok: true, id, status };
  });

  // 4. List Goods Receipt Notes
  app.get("/v1/procurement/receipts", async (request) => {
    const { principal } = await resolvePrincipalAndCompany(request);
    const query = request.query as { status?: string; limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 100;

    const receipts = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.listGoodsReceiptNotes(tx, { status: query.status, limit })
    );

    return { ok: true, receipts };
  });

  // 5. Create Goods Receipt Note
  app.post("/v1/procurement/receipts", async (request, reply) => {
    const { principal, companyId } = await resolvePrincipalAndCompany(request);
    const parsed = CreateGoodsReceiptSchema.parse(request.body);

    const receipt = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.createGoodsReceiptNote(tx, principal.tenantId, {
        ...parsed,
        companyId,
      })
    );

    realtimeEvents.broadcast(principal.tenantId, "procurement.receipt.created", receipt);

    return reply.status(201).send({ ok: true, receipt });
  });

  // 6. List 3-Way Matches with Summary Metrics
  app.get("/v1/procurement/matches", async (request) => {
    const { principal } = await resolvePrincipalAndCompany(request);
    const query = request.query as { status?: string; limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 100;

    const matches = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.listThreeWayMatches(tx, { status: query.status, limit })
    );

    let matchedCount = 0;
    let varianceCount = 0;
    let unmatchedCount = 0;
    let totalValueNum = 0;

    for (const m of matches) {
      if (m.overrideApproved || m.status === "MATCHED") {
        matchedCount++;
      } else if (m.status === "PRICE_VARIANCE" || m.status === "QUANTITY_VARIANCE") {
        varianceCount++;
        totalValueNum += parseFloat(m.billTotal) || 0;
      } else {
        unmatchedCount++;
        totalValueNum += parseFloat(m.billTotal) || 0;
      }
    }

    const summary = {
      totalItems: matches.length,
      matchedCount,
      varianceCount,
      unmatchedCount,
      totalValueUnderReview: totalValueNum.toFixed(2),
    };

    return { ok: true, matches, summary };
  });

  // 7. Approve Match Override
  app.post("/v1/procurement/matches/:id/override", async (request) => {
    const { principal } = await resolvePrincipalAndCompany(request);
    const { id } = request.params as { id: string };
    const { note } = MatchOverrideSchema.parse(request.body);

    await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      store.approveMatchOverride(tx, id, note, principal.userId || "Procurement Lead")
    );

    const payload = { id, note, overrideApproved: true, toleranceOk: true };
    realtimeEvents.broadcast(principal.tenantId, "procurement.match.override", payload);

    return { ok: true, match: payload };
  });
}
