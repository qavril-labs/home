import { DomainError, newId, type Clock } from "@erp/kernel";
import type { Queryable } from "./pool";

export interface PurchaseOrderLineRecord {
  id: string;
  poId: string;
  itemId: string;
  sku: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityBilled: number;
  unitPrice: string;
  lineTotal: string;
}

export interface PurchaseOrderRecord {
  id: string;
  tenantId: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: "draft" | "issued" | "partially_received" | "received" | "billed" | "closed" | "cancelled";
  lines: PurchaseOrderLineRecord[];
  currency: string;
  total: string;
  notes?: string | null;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptLineRecord {
  id: string;
  grnId: string;
  poLineId?: string | null;
  sku: string;
  description: string;
  quantityReceived: number;
  quantityRejected: number;
  batchLotNumber?: string | null;
  warehouseId: string;
  warehouseName: string;
}

export interface GoodsReceiptNoteRecord {
  id: string;
  tenantId: string;
  companyId: string;
  poId: string;
  poRef: string;
  supplierId: string;
  supplierName: string;
  receiptDate: string;
  receivedBy: string;
  status: "received" | "inspected" | "quarantined";
  lines: GoodsReceiptLineRecord[];
  carrier?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreeWayMatchRecord {
  id: string;
  tenantId: string;
  companyId: string;
  poId: string;
  poRef: string;
  grnId: string;
  grnRef: string;
  billId: string;
  billRef: string;
  supplierName: string;
  sku: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  agreedUnitPrice: string;
  billedUnitPrice: string;
  poTotal: string;
  billTotal: string;
  qtyVariance: number;
  priceVariance: string;
  status: "MATCHED" | "PRICE_VARIANCE" | "QUANTITY_VARIANCE" | "UNMATCHED_GRN" | "UNMATCHED_BILL";
  toleranceOk: boolean;
  overrideApproved: boolean;
  overrideNote?: string | null;
  overrideBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderInput {
  id?: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status?: "draft" | "issued" | "partially_received" | "received" | "billed" | "closed" | "cancelled";
  currency?: string;
  total?: string;
  notes?: string;
  approvedBy?: string;
  lines: {
    id?: string;
    itemId?: string;
    sku: string;
    description: string;
    quantityOrdered: number;
    unitPrice: string;
    lineTotal?: string;
  }[];
}

export interface CreateGoodsReceiptInput {
  id?: string;
  companyId: string;
  poId: string;
  poRef: string;
  supplierId: string;
  supplierName: string;
  receiptDate?: string;
  receivedBy: string;
  status?: "received" | "inspected" | "quarantined";
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  lines: {
    id?: string;
    poLineId?: string;
    sku: string;
    description: string;
    quantityReceived: number;
    quantityRejected?: number;
    batchLotNumber?: string;
    warehouseId: string;
    warehouseName: string;
  }[];
}

export class PgPurchasingStore {
  constructor(private readonly clock: Clock = { now: () => new Date() }) {}

  async listPurchaseOrders(
    client: Queryable,
    params: { status?: string; limit?: number } = {}
  ): Promise<PurchaseOrderRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status && params.status.toLowerCase() !== "all") {
      values.push(params.status.toLowerCase());
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(params.limit || 100, 200);

    const posRes = await client.query(
      `SELECT id, tenant_id, company_id, supplier_id, supplier_name, order_date,
              expected_delivery_date, status, currency, total, notes, approved_by,
              created_at, updated_at
         FROM purchase_orders
       ${whereClause}
       ORDER BY order_date DESC, created_at DESC
       LIMIT ${limit};`,
      values
    );

    if (posRes.rows.length === 0) {
      return [];
    }

    const poIds = posRes.rows.map((r: any) => r.id);
    const linesRes = await client.query(
      `SELECT id, po_id, item_id, sku, description, quantity_ordered,
              quantity_received, quantity_billed, unit_price, line_total
         FROM purchase_order_lines
        WHERE po_id = ANY($1::text[])
        ORDER BY created_at ASC;`,
      [poIds]
    );

    const linesByPo = new Map<string, PurchaseOrderLineRecord[]>();
    for (const line of linesRes.rows) {
      const arr = linesByPo.get(line.po_id) || [];
      arr.push({
        id: line.id,
        poId: line.po_id,
        itemId: line.item_id,
        sku: line.sku,
        description: line.description,
        quantityOrdered: parseFloat(line.quantity_ordered),
        quantityReceived: parseFloat(line.quantity_received),
        quantityBilled: parseFloat(line.quantity_billed),
        unitPrice: parseFloat(line.unit_price).toFixed(2),
        lineTotal: parseFloat(line.line_total).toFixed(2),
      });
      linesByPo.set(line.po_id, arr);
    }

    return posRes.rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      orderDate: r.order_date instanceof Date ? r.order_date.toISOString().slice(0, 10) : String(r.order_date).slice(0, 10),
      expectedDeliveryDate: r.expected_delivery_date instanceof Date ? r.expected_delivery_date.toISOString().slice(0, 10) : String(r.expected_delivery_date).slice(0, 10),
      status: r.status,
      lines: linesByPo.get(r.id) || [],
      currency: r.currency,
      total: parseFloat(r.total).toFixed(2),
      notes: r.notes,
      approvedBy: r.approved_by,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async findPurchaseOrder(client: Queryable, id: string): Promise<PurchaseOrderRecord | null> {
    const poRes = await client.query(
      `SELECT id, tenant_id, company_id, supplier_id, supplier_name, order_date,
              expected_delivery_date, status, currency, total, notes, approved_by,
              created_at, updated_at
         FROM purchase_orders
        WHERE id = $1
        LIMIT 1;`,
      [id]
    );

    const r = poRes.rows[0];
    if (!r) return null;

    const linesRes = await client.query(
      `SELECT id, po_id, item_id, sku, description, quantity_ordered,
              quantity_received, quantity_billed, unit_price, line_total
         FROM purchase_order_lines
        WHERE po_id = $1
        ORDER BY created_at ASC;`,
      [id]
    );

    const lines: PurchaseOrderLineRecord[] = linesRes.rows.map((l: any) => ({
      id: l.id,
      poId: l.po_id,
      itemId: l.item_id,
      sku: l.sku,
      description: l.description,
      quantityOrdered: parseFloat(l.quantity_ordered),
      quantityReceived: parseFloat(l.quantity_received),
      quantityBilled: parseFloat(l.quantity_billed),
      unitPrice: parseFloat(l.unit_price).toFixed(2),
      lineTotal: parseFloat(l.line_total).toFixed(2),
    }));

    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      orderDate: r.order_date instanceof Date ? r.order_date.toISOString().slice(0, 10) : String(r.order_date).slice(0, 10),
      expectedDeliveryDate: r.expected_delivery_date instanceof Date ? r.expected_delivery_date.toISOString().slice(0, 10) : String(r.expected_delivery_date).slice(0, 10),
      status: r.status,
      lines,
      currency: r.currency,
      total: parseFloat(r.total).toFixed(2),
      notes: r.notes,
      approvedBy: r.approved_by,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async createPurchaseOrder(
    client: Queryable,
    tenantId: string,
    input: CreatePurchaseOrderInput
  ): Promise<PurchaseOrderRecord> {
    const id = input.id || `PO-${new Date().getFullYear()}-${newId(this.clock.now().getTime()).slice(0, 6).toUpperCase()}`;
    const now = this.clock.now().toISOString();

    let computedTotal = 0;
    const computedLines = input.lines.map((l) => {
      const lineId = l.id || newId(this.clock.now().getTime());
      const qty = l.quantityOrdered || 1;
      const unit = parseFloat(l.unitPrice) || 0;
      const lt = l.lineTotal ? parseFloat(l.lineTotal) : qty * unit;
      computedTotal += lt;
      return {
        id: lineId,
        poId: id,
        itemId: l.itemId || "ITM-DEFAULT",
        sku: l.sku,
        description: l.description,
        quantityOrdered: qty,
        quantityReceived: 0,
        quantityBilled: 0,
        unitPrice: unit.toFixed(2),
        lineTotal: lt.toFixed(2),
      };
    });

    const finalTotal = input.total ? parseFloat(input.total).toFixed(2) : computedTotal.toFixed(2);
    const status = input.status || "issued";

    await client.query(
      `INSERT INTO purchase_orders (
         id, tenant_id, company_id, supplier_id, supplier_name, order_date,
         expected_delivery_date, status, currency, total, notes, approved_by,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13);`,
      [
        id,
        tenantId,
        input.companyId,
        input.supplierId,
        input.supplierName,
        input.orderDate,
        input.expectedDeliveryDate,
        status,
        input.currency || "USD",
        finalTotal,
        input.notes || null,
        input.approvedBy || "Procurement Lead",
        now,
      ]
    );

    for (const line of computedLines) {
      await client.query(
        `INSERT INTO purchase_order_lines (
           id, tenant_id, po_id, item_id, sku, description,
           quantity_ordered, quantity_received, quantity_billed, unit_price, line_total, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          line.id,
          tenantId,
          id,
          line.itemId,
          line.sku,
          line.description,
          line.quantityOrdered,
          line.quantityReceived,
          line.quantityBilled,
          line.unitPrice,
          line.lineTotal,
          now,
        ]
      );
    }

    return {
      id,
      tenantId,
      companyId: input.companyId,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      orderDate: input.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      status,
      lines: computedLines,
      currency: input.currency || "USD",
      total: finalTotal,
      notes: input.notes,
      approvedBy: input.approvedBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updatePurchaseOrderStatus(
    client: Queryable,
    id: string,
    status: PurchaseOrderRecord["status"]
  ): Promise<void> {
    const now = this.clock.now().toISOString();
    const res = await client.query(
      `UPDATE purchase_orders
          SET status = $1, updated_at = $2
        WHERE id = $3;`,
      [status, now, id]
    );

    if (res.rowCount === 0) {
      throw new DomainError("NOT_FOUND", `Purchase order ${id} not found`);
    }
  }

  async listGoodsReceiptNotes(
    client: Queryable,
    params: { status?: string; limit?: number } = {}
  ): Promise<GoodsReceiptNoteRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status && params.status.toLowerCase() !== "all") {
      values.push(params.status.toLowerCase());
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(params.limit || 100, 200);

    const grnsRes = await client.query(
      `SELECT id, tenant_id, company_id, po_id, po_ref, supplier_id, supplier_name,
              receipt_date, received_by, status, carrier, tracking_number, notes,
              created_at, updated_at
         FROM goods_receipt_notes
       ${whereClause}
       ORDER BY receipt_date DESC, created_at DESC
       LIMIT ${limit};`,
      values
    );

    if (grnsRes.rows.length === 0) {
      return [];
    }

    const grnIds = grnsRes.rows.map((r: any) => r.id);
    const linesRes = await client.query(
      `SELECT id, grn_id, po_line_id, sku, description, quantity_received,
              quantity_rejected, batch_lot_number, warehouse_id, warehouse_name
         FROM goods_receipt_lines
        WHERE grn_id = ANY($1::text[])
        ORDER BY created_at ASC;`,
      [grnIds]
    );

    const linesByGrn = new Map<string, GoodsReceiptLineRecord[]>();
    for (const line of linesRes.rows) {
      const arr = linesByGrn.get(line.grn_id) || [];
      arr.push({
        id: line.id,
        grnId: line.grn_id,
        poLineId: line.po_line_id,
        sku: line.sku,
        description: line.description,
        quantityReceived: parseFloat(line.quantity_received),
        quantityRejected: parseFloat(line.quantity_rejected),
        batchLotNumber: line.batch_lot_number,
        warehouseId: line.warehouse_id,
        warehouseName: line.warehouse_name,
      });
      linesByGrn.set(line.grn_id, arr);
    }

    return grnsRes.rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      poId: r.po_id,
      poRef: r.po_ref,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      receiptDate: r.receipt_date instanceof Date ? r.receipt_date.toISOString().slice(0, 10) : String(r.receipt_date).slice(0, 10),
      receivedBy: r.received_by,
      status: r.status,
      lines: linesByGrn.get(r.id) || [],
      carrier: r.carrier,
      trackingNumber: r.tracking_number,
      notes: r.notes,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async createGoodsReceiptNote(
    client: Queryable,
    tenantId: string,
    input: CreateGoodsReceiptInput
  ): Promise<GoodsReceiptNoteRecord> {
    const id = input.id || `GRN-${new Date().getFullYear()}-${newId(this.clock.now().getTime()).slice(0, 6).toUpperCase()}`;
    const now = this.clock.now().toISOString();
    const receiptDate = input.receiptDate || now.slice(0, 10);
    const status = input.status || "inspected";

    const lines: GoodsReceiptLineRecord[] = input.lines.map((l) => ({
      id: l.id || newId(this.clock.now().getTime()),
      grnId: id,
      poLineId: l.poLineId || null,
      sku: l.sku,
      description: l.description,
      quantityReceived: l.quantityReceived,
      quantityRejected: l.quantityRejected || 0,
      batchLotNumber: l.batchLotNumber || null,
      warehouseId: l.warehouseId,
      warehouseName: l.warehouseName,
    }));

    await client.query(
      `INSERT INTO goods_receipt_notes (
         id, tenant_id, company_id, po_id, po_ref, supplier_id, supplier_name,
         receipt_date, received_by, status, carrier, tracking_number, notes,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14);`,
      [
        id,
        tenantId,
        input.companyId,
        input.poId,
        input.poRef,
        input.supplierId,
        input.supplierName,
        receiptDate,
        input.receivedBy,
        status,
        input.carrier || null,
        input.trackingNumber || null,
        input.notes || null,
        now,
      ]
    );

    for (const line of lines) {
      await client.query(
        `INSERT INTO goods_receipt_lines (
           id, tenant_id, grn_id, po_line_id, sku, description,
           quantity_received, quantity_rejected, batch_lot_number,
           warehouse_id, warehouse_name, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          line.id,
          tenantId,
          id,
          line.poLineId,
          line.sku,
          line.description,
          line.quantityReceived,
          line.quantityRejected,
          line.batchLotNumber,
          line.warehouseId,
          line.warehouseName,
          now,
        ]
      );

      // Update quantity_received on the PO line if po_line_id is given
      if (line.poLineId) {
        await client.query(
          `UPDATE purchase_order_lines
              SET quantity_received = quantity_received + $1
            WHERE id = $2;`,
          [line.quantityReceived, line.poLineId]
        );
      }
    }

    return {
      id,
      tenantId,
      companyId: input.companyId,
      poId: input.poId,
      poRef: input.poRef,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      receiptDate,
      receivedBy: input.receivedBy,
      status,
      lines,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
  }

  async listThreeWayMatches(
    client: Queryable,
    params: { status?: string; limit?: number } = {}
  ): Promise<ThreeWayMatchRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status && params.status.toUpperCase() !== "ALL") {
      values.push(params.status.toUpperCase());
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(params.limit || 100, 200);

    const res = await client.query(
      `SELECT id, tenant_id, company_id, po_id, po_ref, grn_id, grn_ref,
              bill_id, bill_ref, supplier_name, sku, description, ordered_qty,
              received_qty, billed_qty, agreed_unit_price, billed_unit_price,
              po_total, bill_total, qty_variance, price_variance, status,
              tolerance_ok, override_approved, override_note, override_by,
              created_at, updated_at
         FROM three_way_matches
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit};`,
      values
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      poId: r.po_id,
      poRef: r.po_ref,
      grnId: r.grn_id,
      grnRef: r.grn_ref,
      billId: r.bill_id,
      billRef: r.bill_ref,
      supplierName: r.supplier_name,
      sku: r.sku,
      description: r.description,
      orderedQty: parseFloat(r.ordered_qty),
      receivedQty: parseFloat(r.received_qty),
      billedQty: parseFloat(r.billed_qty),
      agreedUnitPrice: parseFloat(r.agreed_unit_price).toFixed(2),
      billedUnitPrice: parseFloat(r.billed_unit_price).toFixed(2),
      poTotal: parseFloat(r.po_total).toFixed(2),
      billTotal: parseFloat(r.bill_total).toFixed(2),
      qtyVariance: parseFloat(r.qty_variance),
      priceVariance: parseFloat(r.price_variance).toFixed(2),
      status: r.status,
      toleranceOk: Boolean(r.tolerance_ok),
      overrideApproved: Boolean(r.override_approved),
      overrideNote: r.override_note,
      overrideBy: r.override_by,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async approveMatchOverride(
    client: Queryable,
    id: string,
    note: string,
    approvedBy: string = "Purchasing Lead"
  ): Promise<void> {
    const now = this.clock.now().toISOString();
    const res = await client.query(
      `UPDATE three_way_matches
          SET override_approved = true,
              override_note = $1,
              override_by = $2,
              tolerance_ok = true,
              updated_at = $3
        WHERE id = $4;`,
      [note, approvedBy, now, id]
    );

    if (res.rowCount === 0) {
      throw new DomainError("NOT_FOUND", `Match record ${id} not found`);
    }
  }
}
