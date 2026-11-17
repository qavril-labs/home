import { DomainError } from "@erp/kernel";
import type { DecisionKind, PosDecision, PosSale, PosStore, PricedLine, SaleStatus, Tender, TaxMode, TenderMethod } from "@erp/pos";
import { Money } from "@erp/money";
import type { Queryable } from "./pool";

interface MoneyJson {
  amount: string;
  currency: string;
}

interface StoredLine {
  itemCode: string;
  description: string;
  qty: string;
  unitPrice: MoneyJson;
  discount: MoneyJson;
  /** Missing on sales stored before bill discounts existed. Those read as no bill discount. */
  billDiscount?: MoneyJson;
  taxRateBps: string;
  taxMode: TaxMode;
  revenueAccount: string;
  tracked: boolean;
  net: MoneyJson;
  tax: MoneyJson;
  total: MoneyJson;
}

interface StoredTender {
  method: TenderMethod;
  amount: MoneyJson;
}

interface SaleRow {
  id: string;
  company_id: string;
  status: SaleStatus;
  number: string | null;
  warehouse: string;
  sale_date: string;
  currency: string;
  lines: StoredLine[];
  tenders: StoredTender[];
  bill_discount_minor: string;
  bill_discount_reason: string | null;
  bill_discount_approved_by: string | null;
  subtotal_minor: string;
  tax_minor: string;
  total_minor: string;
  change_minor: string;
  cost_minor: string | null;
  entry_id: string | null;
  reasons: string[];
  recorded_at: Date;
  d_decision: DecisionKind | null;
  d_decided_by: string | null;
  d_decided_at: Date | null;
  d_reason: string | null;
  d_posted_on: string | null;
  d_number: string | null;
  d_entry_id: string | null;
  d_cost_minor: string | null;
  d_change_minor: string | null;
  d_tenders: StoredTender[] | null;
}

/** The sale's own columns, and the decision beside it, if there is one. */
const SALE_SELECT = `
  SELECT s.id, s.company_id, s.status, s.number, s.warehouse, s.sale_date::text AS sale_date, s.currency,
         s.lines, s.tenders, s.bill_discount_minor::text AS bill_discount_minor,
         s.bill_discount_reason, s.bill_discount_approved_by,
         s.subtotal_minor::text AS subtotal_minor, s.tax_minor::text AS tax_minor, s.total_minor::text AS total_minor,
         s.change_minor::text AS change_minor, s.cost_minor::text AS cost_minor, s.entry_id, s.reasons, s.recorded_at,
         d.decision AS d_decision, d.decided_by AS d_decided_by, d.decided_at AS d_decided_at, d.reason AS d_reason,
         d.posted_on::text AS d_posted_on, d.number AS d_number, d.entry_id AS d_entry_id,
         d.cost_minor::text AS d_cost_minor, d.change_minor::text AS d_change_minor, d.tenders AS d_tenders
    FROM pos_sales s
    LEFT JOIN pos_sale_decisions d
      ON d.tenant_id = s.tenant_id AND d.company_id = s.company_id AND d.sale_id = s.id`;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";

/**
 * Point-of-sale storage in Postgres. Create it from a tenant transaction (withTenantTransaction), so row-level
 * security limits it to that tenant and the advisory lock from `lock` is held until that transaction ends.
 */
export class PgPosStore implements PosStore {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async lock(companyId: string, saleId: string): Promise<void> {
    await this.db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`pos:${companyId}:${saleId}`]);
  }

  async find(companyId: string, saleId: string): Promise<PosSale | undefined> {
    const { rows } = await this.db.query<SaleRow>(`${SALE_SELECT} WHERE s.tenant_id = $1 AND s.company_id = $2 AND s.id = $3`, [
      this.tenantId,
      companyId,
      saleId,
    ]);
    return rows[0] ? toSale(rows[0], companyId) : undefined;
  }

  async save(sale: PosSale): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO pos_sales (tenant_id, company_id, id, status, number, warehouse, sale_date, currency, lines, tenders,
                                bill_discount_minor, bill_discount_reason, bill_discount_approved_by,
                                subtotal_minor, tax_minor, total_minor, change_minor, cost_minor, entry_id, reasons, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          this.tenantId,
          sale.companyId,
          sale.id,
          sale.status,
          sale.number,
          sale.warehouse,
          sale.date,
          sale.currency,
          JSON.stringify(sale.lines.map(toLineJson)),
          JSON.stringify(sale.tenders.map(toTenderJson)),
          sale.billDiscount.minor.toString(),
          sale.billDiscountReason,
          sale.billDiscountApprovedBy,
          sale.subtotal.minor.toString(),
          sale.tax.minor.toString(),
          sale.total.minor.toString(),
          sale.change.minor.toString(),
          sale.cost?.minor.toString() ?? null,
          sale.entryId,
          JSON.stringify(sale.reasons),
          sale.recordedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("CONFLICT", `Sale ${sale.id} is already stored`);
      }
      throw error;
    }
  }

  async saveDecision(decision: PosDecision): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO pos_sale_decisions (tenant_id, company_id, sale_id, decision, decided_by, decided_at, reason,
                                         posted_on, number, entry_id, cost_minor, change_minor, tenders)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          this.tenantId,
          decision.companyId,
          decision.saleId,
          decision.decision,
          decision.decidedBy,
          decision.decidedAt,
          decision.reason,
          decision.postedOn,
          decision.number,
          decision.entryId,
          decision.cost?.minor.toString() ?? null,
          decision.change.minor.toString(),
          JSON.stringify(decision.tenders.map(toTenderJson)),
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("CONFLICT", `Sale ${decision.saleId} has already been decided`);
      }
      throw error;
    }
  }

  async list(companyId: string, status?: SaleStatus): Promise<PosSale[]> {
    const { rows } = await this.db.query<SaleRow>(
      `${SALE_SELECT}
        WHERE s.tenant_id = $1 AND s.company_id = $2 AND ($3::text IS NULL OR s.status = $3)
        ORDER BY s.recorded_at, s.id`,
      [this.tenantId, companyId, status ?? null],
    );
    return rows.map((row) => toSale(row, companyId));
  }
}

function toLineJson(line: PricedLine): StoredLine {
  return {
    itemCode: line.itemCode,
    description: line.description,
    qty: line.qty.toString(),
    unitPrice: line.unitPrice.toJSON(),
    discount: line.discount.toJSON(),
    billDiscount: line.billDiscount.toJSON(),
    taxRateBps: line.taxRateBps.toString(),
    taxMode: line.taxMode,
    revenueAccount: line.revenueAccount,
    tracked: line.tracked,
    net: line.net.toJSON(),
    tax: line.tax.toJSON(),
    total: line.total.toJSON(),
  };
}

function toTenderJson(tender: Tender): StoredTender {
  return { method: tender.method, amount: tender.amount.toJSON() };
}

function money(json: MoneyJson): Money {
  return Money.fromDecimal(json.amount, json.currency);
}

function toLine(stored: StoredLine, currency: string): PricedLine {
  return {
    itemCode: stored.itemCode,
    description: stored.description,
    qty: BigInt(stored.qty),
    unitPrice: money(stored.unitPrice),
    discount: money(stored.discount),
    billDiscount: stored.billDiscount ? money(stored.billDiscount) : Money.zero(currency),
    taxRateBps: BigInt(stored.taxRateBps),
    taxMode: stored.taxMode,
    revenueAccount: stored.revenueAccount,
    tracked: stored.tracked,
    net: money(stored.net),
    tax: money(stored.tax),
    total: money(stored.total),
  };
}

function toDecision(row: SaleRow, companyId: string, currency: string): PosDecision | null {
  if (row.d_decision === null) return null;
  return {
    saleId: row.id,
    companyId,
    decision: row.d_decision,
    decidedBy: row.d_decided_by ?? "",
    decidedAt: (row.d_decided_at ?? new Date(0)).toISOString(),
    reason: row.d_reason ?? "",
    postedOn: row.d_posted_on,
    number: row.d_number,
    entryId: row.d_entry_id,
    cost: row.d_cost_minor === null ? null : Money.of(BigInt(row.d_cost_minor), currency),
    change: Money.of(BigInt(row.d_change_minor ?? "0"), currency),
    tenders: (row.d_tenders ?? []).map((tender) => ({ method: tender.method, amount: money(tender.amount) })),
  };
}

function toSale(row: SaleRow, companyId: string): PosSale {
  const currency = row.currency.trim();
  return {
    id: row.id,
    companyId,
    status: row.status,
    number: row.number,
    warehouse: row.warehouse,
    date: row.sale_date,
    currency,
    lines: row.lines.map((line) => toLine(line, currency)),
    tenders: row.tenders.map((tender) => ({ method: tender.method, amount: money(tender.amount) })),
    billDiscount: Money.of(BigInt(row.bill_discount_minor), currency),
    billDiscountReason: row.bill_discount_reason,
    billDiscountApprovedBy: row.bill_discount_approved_by,
    subtotal: Money.of(BigInt(row.subtotal_minor), currency),
    tax: Money.of(BigInt(row.tax_minor), currency),
    total: Money.of(BigInt(row.total_minor), currency),
    change: Money.of(BigInt(row.change_minor), currency),
    cost: row.cost_minor === null ? null : Money.of(BigInt(row.cost_minor), currency),
    entryId: row.entry_id,
    reasons: row.reasons,
    recordedAt: row.recorded_at.toISOString(),
    resolution: toDecision(row, companyId, currency),
  };
}
