import { DomainError } from "@erp/kernel";
import type { PosSale, PosStore, PricedLine, SaleStatus, Tender, TaxMode, TenderMethod } from "@erp/pos";
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
  subtotal_minor: string;
  tax_minor: string;
  total_minor: string;
  change_minor: string;
  cost_minor: string | null;
  entry_id: string | null;
  reasons: string[];
  recorded_at: Date;
}

const SALE_COLUMNS = `id, company_id, status, number, warehouse, sale_date::text AS sale_date, currency, lines, tenders,
  subtotal_minor::text AS subtotal_minor, tax_minor::text AS tax_minor, total_minor::text AS total_minor,
  change_minor::text AS change_minor, cost_minor::text AS cost_minor, entry_id, reasons, recorded_at`;

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
    const { rows } = await this.db.query<SaleRow>(
      `SELECT ${SALE_COLUMNS} FROM pos_sales WHERE tenant_id = $1 AND company_id = $2 AND id = $3`,
      [this.tenantId, companyId, saleId],
    );
    return rows[0] ? toSale(rows[0], companyId) : undefined;
  }

  async save(sale: PosSale): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO pos_sales (tenant_id, company_id, id, status, number, warehouse, sale_date, currency, lines, tenders,
                                subtotal_minor, tax_minor, total_minor, change_minor, cost_minor, entry_id, reasons, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
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

  async list(companyId: string, status?: SaleStatus): Promise<PosSale[]> {
    const { rows } = await this.db.query<SaleRow>(
      `SELECT ${SALE_COLUMNS} FROM pos_sales
        WHERE tenant_id = $1 AND company_id = $2 AND ($3::text IS NULL OR status = $3)
        ORDER BY recorded_at, id`,
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

function toLine(stored: StoredLine): PricedLine {
  return {
    itemCode: stored.itemCode,
    description: stored.description,
    qty: BigInt(stored.qty),
    unitPrice: money(stored.unitPrice),
    discount: money(stored.discount),
    taxRateBps: BigInt(stored.taxRateBps),
    taxMode: stored.taxMode,
    revenueAccount: stored.revenueAccount,
    tracked: stored.tracked,
    net: money(stored.net),
    tax: money(stored.tax),
    total: money(stored.total),
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
    lines: row.lines.map(toLine),
    tenders: row.tenders.map((tender) => ({ method: tender.method, amount: money(tender.amount) })),
    subtotal: Money.of(BigInt(row.subtotal_minor), currency),
    tax: Money.of(BigInt(row.tax_minor), currency),
    total: Money.of(BigInt(row.total_minor), currency),
    change: Money.of(BigInt(row.change_minor), currency),
    cost: row.cost_minor === null ? null : Money.of(BigInt(row.cost_minor), currency),
    entryId: row.entry_id,
    reasons: row.reasons,
    recordedAt: row.recorded_at.toISOString(),
  };
}
