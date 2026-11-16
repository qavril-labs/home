import { DomainError, newId, type Clock } from "@erp/kernel";
import type { Queryable } from "./pool";

export interface InvoiceLineRecord {
  id: string;
  invoiceId: string;
  itemId?: string | null;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxCode?: string | null;
  lineTotal: string;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  companyId: string;
  partyId: string;
  partyName: string;
  partyTaxId?: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  paymentTerms?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  lines: InvoiceLineRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoicesSummaryRecord {
  totalReceivable: string;
  overdue: string;
  overdueCount: number;
  paidThisMonth: string;
  invoiceCount: number;
}

export interface BillLineRecord {
  id: string;
  billId: string;
  itemId?: string | null;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: string;
  accountCode?: string | null;
  lineTotal: string;
}

export interface BillRecord {
  id: string;
  tenantId: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  vendorInvoiceNumber?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: "draft" | "pending_approval" | "approved" | "paid" | "overdue" | "disputed";
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  notes?: string | null;
  metadata: Record<string, unknown>;
  lines: BillLineRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStatementTransaction {
  id: string;
  date: string;
  type: "Invoice" | "Payment" | "Credit Note";
  reference: string;
  amount: string;
  balance: string;
}

export interface CustomerStatementRecord {
  partyId: string;
  partyName: string;
  email: string;
  phone: string;
  paymentTerms: string;
  currentBalance: string;
  overdueBalance: string;
  transactions: CustomerStatementTransaction[];
}

export interface PaymentReminderRecord {
  id: string;
  tenantId: string;
  companyId: string;
  invoiceId: string;
  channel: "whatsapp" | "email";
  recipient: string;
  recipientName: string;
  subject?: string | null;
  message: string;
  tone: "friendly" | "firm" | "urgent";
  status: "draft" | "approved" | "sent";
  sentAt: string;
  createdAt: string;
}

export class PgInvoicingStore {
  constructor(
    private readonly client: Queryable,
    private readonly tenantId: string,
    private readonly clock: Clock,
  ) {}

  // ==========================================
  // Invoices (SAL-04 & AR)
  // ==========================================

  async listInvoices(
    companyId: string,
    filters: { status?: string; search?: string } = {},
  ): Promise<InvoiceRecord[]> {
    let sql = `
      SELECT i.id, i.tenant_id, i.company_id, i.party_id, p.name AS party_name, p.tax_id AS party_tax_id,
             i.invoice_number, i.issue_date::text, i.due_date::text, i.currency, i.status,
             i.subtotal::text, i.tax_total::text, i.total::text, i.amount_paid::text, i.balance_due::text,
             i.payment_terms, i.notes, i.metadata, i.created_at, i.updated_at
        FROM invoices i
        JOIN parties p ON p.id = i.party_id
       WHERE i.tenant_id = $1 AND i.company_id = $2
    `;
    const params: unknown[] = [this.tenantId, companyId];

    if (filters.status) {
      params.push(filters.status);
      sql += ` AND i.status = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (lower(i.invoice_number) LIKE $${params.length} OR lower(p.name) LIKE $${params.length} OR lower(COALESCE(i.notes, '')) LIKE $${params.length})`;
    }

    sql += " ORDER BY i.created_at DESC";

    const { rows: invRows } = await this.client.query<any>(sql, params);
    if (invRows.length === 0) return [];

    const invoiceIds = invRows.map((r) => r.id);
    const { rows: lineRows } = await this.client.query<any>(
      `SELECT id, invoice_id, item_id, sku, description, quantity::float, unit,
              unit_price::text, tax_rate::text, tax_code, line_total::text
         FROM invoice_lines
        WHERE invoice_id = ANY($1::uuid[])
        ORDER BY id ASC`,
      [invoiceIds],
    );

    const linesByInvoice = new Map<string, InvoiceLineRecord[]>();
    for (const l of lineRows) {
      const arr = linesByInvoice.get(l.invoice_id) ?? [];
      arr.push({
        id: l.id,
        invoiceId: l.invoice_id,
        itemId: l.item_id,
        sku: l.sku,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unit_price,
        taxRate: l.tax_rate,
        taxCode: l.tax_code,
        lineTotal: l.line_total,
      });
      linesByInvoice.set(l.invoice_id, arr);
    }

    return invRows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      partyId: r.party_id,
      partyName: r.party_name,
      partyTaxId: r.party_tax_id,
      invoiceNumber: r.invoice_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      currency: r.currency,
      status: r.status,
      subtotal: r.subtotal,
      taxTotal: r.tax_total,
      total: r.total,
      amountPaid: r.amount_paid,
      balanceDue: r.balance_due,
      paymentTerms: r.payment_terms,
      notes: r.notes,
      metadata: r.metadata ?? {},
      lines: linesByInvoice.get(r.id) ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async findInvoice(id: string): Promise<InvoiceRecord | null> {
    const { rows } = await this.client.query<any>(
      `SELECT i.id, i.tenant_id, i.company_id, i.party_id, p.name AS party_name, p.tax_id AS party_tax_id,
              i.invoice_number, i.issue_date::text, i.due_date::text, i.currency, i.status,
              i.subtotal::text, i.tax_total::text, i.total::text, i.amount_paid::text, i.balance_due::text,
              i.payment_terms, i.notes, i.metadata, i.created_at, i.updated_at
         FROM invoices i
         JOIN parties p ON p.id = i.party_id
        WHERE i.tenant_id = $1 AND i.id = $2`,
      [this.tenantId, id],
    );
    if (!rows[0]) return null;

    const r = rows[0];
    const { rows: lineRows } = await this.client.query<any>(
      `SELECT id, invoice_id, item_id, sku, description, quantity::float, unit,
              unit_price::text, tax_rate::text, tax_code, line_total::text
         FROM invoice_lines
        WHERE invoice_id = $1
        ORDER BY id ASC`,
      [id],
    );

    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      partyId: r.party_id,
      partyName: r.party_name,
      partyTaxId: r.party_tax_id,
      invoiceNumber: r.invoice_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      currency: r.currency,
      status: r.status,
      subtotal: r.subtotal,
      taxTotal: r.tax_total,
      total: r.total,
      amountPaid: r.amount_paid,
      balanceDue: r.balance_due,
      paymentTerms: r.payment_terms,
      notes: r.notes,
      metadata: r.metadata ?? {},
      lines: lineRows.map((l: any) => ({
        id: l.id,
        invoiceId: l.invoice_id,
        itemId: l.item_id,
        sku: l.sku,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unit_price,
        taxRate: l.tax_rate,
        taxCode: l.tax_code,
        lineTotal: l.line_total,
      })),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getInvoicesSummary(companyId: string): Promise<InvoicesSummaryRecord> {
    const { rows } = await this.client.query<any>(
      `SELECT
         COALESCE(SUM(CASE WHEN status NOT IN ('paid', 'void') THEN balance_due ELSE 0 END), 0)::text AS total_receivable,
         COALESCE(SUM(CASE WHEN status = 'overdue' THEN balance_due ELSE 0 END), 0)::text AS overdue,
         COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int AS overdue_count,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0)::text AS paid_this_month,
         COUNT(*)::int AS invoice_count
        FROM invoices
       WHERE tenant_id = $1 AND company_id = $2`,
      [this.tenantId, companyId],
    );

    const r = rows[0] || {};
    return {
      totalReceivable: r.total_receivable ?? "0.00",
      overdue: r.overdue ?? "0.00",
      overdueCount: r.overdue_count ?? 0,
      paidThisMonth: r.paid_this_month ?? "0.00",
      invoiceCount: r.invoice_count ?? 0,
    };
  }

  async createInvoice(
    companyId: string,
    input: {
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
      paymentTerms?: string | null;
      notes?: string | null;
      metadata?: Record<string, unknown>;
      lines: Array<{
        itemId?: string | null;
        sku: string;
        description: string;
        quantity: number;
        unit?: string;
        unitPrice: string;
        taxRate?: string;
        taxCode?: string | null;
        lineTotal: string;
      }>;
    },
  ): Promise<InvoiceRecord> {
    const id = newId(this.clock.now().getTime());
    const now = this.clock.now().toISOString();
    const currency = input.currency || "USD";
    const status = input.status || "issued";
    const amountPaid = input.amountPaid || "0.00";
    const balanceDue = input.balanceDue || input.total;

    await this.client.query(
      `INSERT INTO invoices (
         id, tenant_id, company_id, party_id, invoice_number, issue_date, due_date,
         currency, status, subtotal, tax_total, total, amount_paid, balance_due,
         payment_terms, notes, metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $18
       )`,
      [
        id,
        this.tenantId,
        companyId,
        input.partyId,
        input.invoiceNumber,
        input.issueDate,
        input.dueDate,
        currency,
        status,
        input.subtotal,
        input.taxTotal,
        input.total,
        amountPaid,
        balanceDue,
        input.paymentTerms ?? null,
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
        now,
      ],
    );

    for (const l of input.lines) {
      const lineId = newId(this.clock.now().getTime());
      await this.client.query(
        `INSERT INTO invoice_lines (
           id, invoice_id, item_id, sku, description, quantity, unit, unit_price, tax_rate, tax_code, line_total
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
         )`,
        [
          lineId,
          id,
          l.itemId ?? null,
          l.sku,
          l.description,
          l.quantity,
          l.unit || "ea",
          l.unitPrice,
          l.taxRate || "0.0000",
          l.taxCode ?? null,
          l.lineTotal,
        ],
      );
    }

    const created = await this.findInvoice(id);
    if (!created) throw new Error("Failed to retrieve created invoice");
    return created;
  }

  async updateInvoice(
    id: string,
    input: Partial<{
      partyId: string;
      issueDate: string;
      dueDate: string;
      status: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
      subtotal: string;
      taxTotal: string;
      total: string;
      amountPaid: string;
      balanceDue: string;
      paymentTerms: string | null;
      notes: string | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<InvoiceRecord> {
    const existing = await this.findInvoice(id);
    if (!existing) throw new DomainError("NOT_FOUND", `Invoice ${id} not found`);

    const now = this.clock.now().toISOString();
    await this.client.query(
      `UPDATE invoices
          SET party_id = COALESCE($3, party_id),
              issue_date = COALESCE($4, issue_date),
              due_date = COALESCE($5, due_date),
              status = COALESCE($6, status),
              subtotal = COALESCE($7, subtotal),
              tax_total = COALESCE($8, tax_total),
              total = COALESCE($9, total),
              amount_paid = COALESCE($10, amount_paid),
              balance_due = COALESCE($11, balance_due),
              payment_terms = COALESCE($12, payment_terms),
              notes = COALESCE($13, notes),
              metadata = COALESCE($14, metadata),
              updated_at = $15
        WHERE tenant_id = $1 AND id = $2`,
      [
        this.tenantId,
        id,
        input.partyId ?? null,
        input.issueDate ?? null,
        input.dueDate ?? null,
        input.status ?? null,
        input.subtotal ?? null,
        input.taxTotal ?? null,
        input.total ?? null,
        input.amountPaid ?? null,
        input.balanceDue ?? null,
        input.paymentTerms ?? null,
        input.notes ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        now,
      ],
    );

    const updated = await this.findInvoice(id);
    if (!updated) throw new Error("Failed to retrieve updated invoice");
    return updated;
  }

  async deleteInvoice(id: string): Promise<void> {
    const { rowCount } = await this.client.query(
      "DELETE FROM invoices WHERE tenant_id = $1 AND id = $2",
      [this.tenantId, id],
    );
    if (rowCount === 0) throw new DomainError("NOT_FOUND", `Invoice ${id} not found`);
  }

  async markInvoicePaid(id: string): Promise<InvoiceRecord> {
    const existing = await this.findInvoice(id);
    if (!existing) throw new DomainError("NOT_FOUND", `Invoice ${id} not found`);

    const now = this.clock.now().toISOString();
    await this.client.query(
      `UPDATE invoices
          SET status = 'paid',
              amount_paid = total,
              balance_due = 0.00,
              updated_at = $3
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, id, now],
    );

    const updated = await this.findInvoice(id);
    if (!updated) throw new Error("Failed to retrieve updated invoice");
    return updated;
  }

  // ==========================================
  // Customer Statements (FIN-02)
  // ==========================================

  async getCustomerStatement(companyId: string, partyId: string): Promise<CustomerStatementRecord> {
    const { rows: partyRows } = await this.client.query<any>(
      `SELECT id, name, email, phone, metadata
         FROM parties
        WHERE tenant_id = $1 AND id = $2`,
      [this.tenantId, partyId],
    );
    if (!partyRows[0]) throw new DomainError("NOT_FOUND", `Party ${partyId} not found`);
    const party = partyRows[0];
    const meta = party.metadata || {};

    const { rows: invRows } = await this.client.query<any>(
      `SELECT id, invoice_number, issue_date::text, total::text, balance_due::text, status
         FROM invoices
        WHERE tenant_id = $1 AND company_id = $2 AND party_id = $3
        ORDER BY issue_date ASC, created_at ASC`,
      [this.tenantId, companyId, partyId],
    );

    let runningCents = 0;
    let overdueCents = 0;
    const transactions: CustomerStatementTransaction[] = [];

    for (const inv of invRows) {
      const totalNorm = String(inv.total).replace(/,/g, "");
      const [tInt = "0", tDec = "00"] = totalNorm.split(".");
      const totalCents = (parseInt(tInt, 10) || 0) * 100 + (parseInt(tDec, 10) || 0);

      const balNorm = String(inv.balance_due).replace(/,/g, "");
      const [bInt = "0", bDec = "00"] = balNorm.split(".");
      const balCents = (parseInt(bInt, 10) || 0) * 100 + (parseInt(bDec, 10) || 0);

      runningCents += totalCents;
      if (inv.status === "overdue") {
        overdueCents += balCents;
      }

      const rInt = Math.floor(runningCents / 100);
      const rDec = String(runningCents % 100).padStart(2, "0");

      transactions.push({
        id: inv.id,
        date: inv.issue_date,
        type: "Invoice",
        reference: inv.invoice_number,
        amount: inv.total,
        balance: `${rInt}.${rDec}`,
      });
    }

    const curInt = Math.floor(runningCents / 100);
    const curDec = String(runningCents % 100).padStart(2, "0");
    const ovInt = Math.floor(overdueCents / 100);
    const ovDec = String(overdueCents % 100).padStart(2, "0");

    return {
      partyId: party.id,
      partyName: party.name,
      email: party.email || "ap@customer.io",
      phone: party.phone || "+1 (555) 010-0000",
      paymentTerms: meta.paymentTerms || "Net 30",
      currentBalance: `${curInt}.${curDec}`,
      overdueBalance: `${ovInt}.${ovDec}`,
      transactions,
    };
  }

  // ==========================================
  // Chase Chloe Reminders (FIN-14)
  // ==========================================

  async recordPaymentReminder(
    companyId: string,
    input: {
      invoiceId: string;
      channel: "whatsapp" | "email";
      recipient: string;
      recipientName: string;
      subject?: string | null;
      message: string;
      tone: "friendly" | "firm" | "urgent";
      status?: "draft" | "approved" | "sent";
    },
  ): Promise<PaymentReminderRecord> {
    const id = newId(this.clock.now().getTime());
    const now = this.clock.now().toISOString();
    const status = input.status || "sent";

    await this.client.query(
      `INSERT INTO payment_reminders (
         id, tenant_id, company_id, invoice_id, channel, recipient, recipient_name,
         subject, message, tone, status, sent_at, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $12
       )`,
      [
        id,
        this.tenantId,
        companyId,
        input.invoiceId,
        input.channel,
        input.recipient,
        input.recipientName,
        input.subject ?? null,
        input.message,
        input.tone,
        status,
        now,
      ],
    );

    return {
      id,
      tenantId: this.tenantId,
      companyId,
      invoiceId: input.invoiceId,
      channel: input.channel,
      recipient: input.recipient,
      recipientName: input.recipientName,
      subject: input.subject ?? null,
      message: input.message,
      tone: input.tone,
      status,
      sentAt: now,
      createdAt: now,
    };
  }

  // ==========================================
  // Vendor Bills (FIN-03 & AP)
  // ==========================================

  async listBills(companyId: string): Promise<BillRecord[]> {
    const { rows: billRows } = await this.client.query<any>(
      `SELECT b.id, b.tenant_id, b.company_id, b.supplier_id, p.name AS supplier_name,
              b.bill_number, b.vendor_invoice_number, b.issue_date::text, b.due_date::text,
              b.currency, b.status, b.subtotal::text, b.tax_total::text, b.total::text,
              b.amount_paid::text, b.balance_due::text, b.notes, b.metadata, b.created_at, b.updated_at
         FROM bills b
         JOIN parties p ON p.id = b.supplier_id
        WHERE b.tenant_id = $1 AND b.company_id = $2
        ORDER BY b.created_at DESC`,
      [this.tenantId, companyId],
    );
    if (billRows.length === 0) return [];

    const billIds = billRows.map((r) => r.id);
    const { rows: lineRows } = await this.client.query<any>(
      `SELECT id, bill_id, item_id, sku, description, quantity::float, unit,
              unit_cost::text, account_code, line_total::text
         FROM bill_lines
        WHERE bill_id = ANY($1::uuid[])
        ORDER BY id ASC`,
      [billIds],
    );

    const linesByBill = new Map<string, BillLineRecord[]>();
    for (const l of lineRows) {
      const arr = linesByBill.get(l.bill_id) ?? [];
      arr.push({
        id: l.id,
        billId: l.bill_id,
        itemId: l.item_id,
        sku: l.sku,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitCost: l.unit_cost,
        accountCode: l.account_code,
        lineTotal: l.line_total,
      });
      linesByBill.set(l.bill_id, arr);
    }

    return billRows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      billNumber: r.bill_number,
      vendorInvoiceNumber: r.vendor_invoice_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      currency: r.currency,
      status: r.status,
      subtotal: r.subtotal,
      taxTotal: r.tax_total,
      total: r.total,
      amountPaid: r.amount_paid,
      balanceDue: r.balance_due,
      notes: r.notes,
      metadata: r.metadata ?? {},
      lines: linesByBill.get(r.id) ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async createBill(
    companyId: string,
    input: {
      supplierId: string;
      billNumber: string;
      vendorInvoiceNumber?: string | null;
      issueDate: string;
      dueDate: string;
      currency?: string;
      status?: "draft" | "pending_approval" | "approved" | "paid" | "overdue" | "disputed";
      subtotal: string;
      taxTotal: string;
      total: string;
      amountPaid?: string;
      balanceDue?: string;
      notes?: string | null;
      metadata?: Record<string, unknown>;
      lines: Array<{
        itemId?: string | null;
        sku: string;
        description: string;
        quantity: number;
        unit?: string;
        unitCost: string;
        accountCode?: string | null;
        lineTotal: string;
      }>;
    },
  ): Promise<BillRecord> {
    const id = newId(this.clock.now().getTime());
    const now = this.clock.now().toISOString();
    const currency = input.currency || "USD";
    const status = input.status || "pending_approval";
    const amountPaid = input.amountPaid || "0.00";
    const balanceDue = input.balanceDue || input.total;

    await this.client.query(
      `INSERT INTO bills (
         id, tenant_id, company_id, supplier_id, bill_number, vendor_invoice_number,
         issue_date, due_date, currency, status, subtotal, tax_total, total,
         amount_paid, balance_due, notes, metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, $18, $18
       )`,
      [
        id,
        this.tenantId,
        companyId,
        input.supplierId,
        input.billNumber,
        input.vendorInvoiceNumber ?? null,
        input.issueDate,
        input.dueDate,
        currency,
        status,
        input.subtotal,
        input.taxTotal,
        input.total,
        amountPaid,
        balanceDue,
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
        now,
      ],
    );

    for (const l of input.lines) {
      const lineId = newId(this.clock.now().getTime());
      await this.client.query(
        `INSERT INTO bill_lines (
           id, bill_id, item_id, sku, description, quantity, unit, unit_cost, account_code, line_total
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
         )`,
        [
          lineId,
          id,
          l.itemId ?? null,
          l.sku,
          l.description,
          l.quantity,
          l.unit || "ea",
          l.unitCost,
          l.accountCode ?? null,
          l.lineTotal,
        ],
      );
    }

    const { rows } = await this.client.query<any>(
      `SELECT b.id, b.tenant_id, b.company_id, b.supplier_id, p.name AS supplier_name,
              b.bill_number, b.vendor_invoice_number, b.issue_date::text, b.due_date::text,
              b.currency, b.status, b.subtotal::text, b.tax_total::text, b.total::text,
              b.amount_paid::text, b.balance_due::text, b.notes, b.metadata, b.created_at, b.updated_at
         FROM bills b
         JOIN parties p ON p.id = b.supplier_id
        WHERE b.tenant_id = $1 AND b.id = $2`,
      [this.tenantId, id],
    );
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      companyId: r.company_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      billNumber: r.bill_number,
      vendorInvoiceNumber: r.vendor_invoice_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      currency: r.currency,
      status: r.status,
      subtotal: r.subtotal,
      taxTotal: r.tax_total,
      total: r.total,
      amountPaid: r.amount_paid,
      balanceDue: r.balance_due,
      notes: r.notes,
      metadata: r.metadata ?? {},
      lines: input.lines.map((l, i) => ({
        id: `line-${i}`,
        billId: id,
        itemId: l.itemId ?? null,
        sku: l.sku,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit || "ea",
        unitCost: l.unitCost,
        accountCode: l.accountCode ?? null,
        lineTotal: l.lineTotal,
      })),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
