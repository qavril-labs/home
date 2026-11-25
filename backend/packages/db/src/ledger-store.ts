import { DomainError } from "@erp/kernel";
import {
  type Account,
  type AccountType,
  type FiscalPeriod,
  type LedgerStore,
  type PeriodStatus,
  type PostedEntry,
  type PostedLine,
  type Side,
} from "@erp/ledger";
import { Money, type FxRate } from "@erp/money";
import type { Queryable } from "./pool";

interface StoredLine {
  account: string;
  side: Side;
  amount: string;
  baseAmount: string;
  memo: string | null;
}

interface EntryRow {
  id: string;
  company_id: string;
  reference: string;
  entry_date: string;
  period_id: string;
  currency: string;
  base_currency: string;
  memo: string | null;
  reversal_of: string | null;
  lines: StoredLine[];
  posted_at: Date;
}

const ENTRY_COLUMNS =
  "id, company_id, reference, entry_date::text AS entry_date, period_id, currency, base_currency, memo, reversal_of, lines, posted_at";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";

function entryFromRow(row: EntryRow): PostedEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    reference: row.reference,
    date: row.entry_date,
    periodId: row.period_id,
    currency: row.currency,
    baseCurrency: row.base_currency,
    memo: row.memo,
    reversalOf: row.reversal_of,
    lines: row.lines.map(
      (line): PostedLine => ({
        account: line.account,
        side: line.side,
        amount: Money.fromDecimal(line.amount, row.currency),
        baseAmount: Money.fromDecimal(line.baseAmount, row.base_currency),
        memo: line.memo,
      }),
    ),
    postedAt: row.posted_at.toISOString(),
  };
}

/**
 * Ledger storage in Postgres. Every query runs inside a tenant transaction, so row-level
 * security limits it to that tenant. `tenantId` is written on inserts.
 */
export class PgLedgerStore implements LedgerStore {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
  ) {}

  async saveAccount(companyId: string, account: Account): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO ledger_accounts (tenant_id, company_id, code, name, account_type, active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [this.tenantId, companyId, account.code, account.name, account.type, account.active],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("CONFLICT", `Account ${account.code} already exists`);
      throw error;
    }
  }

  async listAccounts(companyId: string): Promise<Account[]> {
    const { rows } = await this.db.query<{ code: string; name: string; account_type: AccountType; active: boolean }>(
      "SELECT code, name, account_type, active FROM ledger_accounts WHERE company_id = $1 ORDER BY code",
      [companyId],
    );
    return rows.map((row) => ({ code: row.code, name: row.name, type: row.account_type, active: row.active }));
  }

  async saveFiscalPeriods(companyId: string, periods: readonly FiscalPeriod[]): Promise<void> {
    for (const period of periods) {
      await this.db.query(
        `INSERT INTO ledger_periods (tenant_id, company_id, period_id, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [this.tenantId, companyId, period.id, period.startDate, period.endDate, period.status],
      );
    }
  }

  async listFiscalPeriods(companyId: string): Promise<FiscalPeriod[]> {
    const { rows } = await this.db.query<{ period_id: string; start_date: string; end_date: string; status: PeriodStatus }>(
      `SELECT period_id, start_date::text AS start_date, end_date::text AS end_date, status
         FROM ledger_periods WHERE company_id = $1 ORDER BY period_id`,
      [companyId],
    );
    return rows.map((row) => ({ id: row.period_id, startDate: row.start_date, endDate: row.end_date, status: row.status }));
  }

  async setPeriodStatus(companyId: string, periodId: string, status: PeriodStatus): Promise<void> {
    await this.db.query("UPDATE ledger_periods SET status = $3 WHERE company_id = $1 AND period_id = $2", [
      companyId,
      periodId,
      status,
    ]);
  }

  async saveRate(rate: FxRate): Promise<void> {
    try {
      await this.db.query(
        "INSERT INTO fx_rates (tenant_id, base, quote, effective_date, rate) VALUES ($1, $2, $3, $4, $5)",
        [this.tenantId, rate.base, rate.quote, rate.effectiveDate, rate.rate.toString()],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("CONFLICT", `A ${rate.base}/${rate.quote} rate on ${rate.effectiveDate} already exists`);
      }
      throw error;
    }
  }

  async listRates(): Promise<FxRate[]> {
    const { rows } = await this.db.query<{ base: string; quote: string; effective_date: string; rate: string }>(
      "SELECT base, quote, effective_date::text AS effective_date, rate::text AS rate FROM fx_rates",
    );
    return rows.map((row) => ({
      base: row.base,
      quote: row.quote,
      effectiveDate: row.effective_date,
      rate: BigInt(row.rate),
    }));
  }

  async findEntryByReference(companyId: string, reference: string): Promise<PostedEntry | null> {
    const { rows } = await this.db.query<EntryRow>(
      `SELECT ${ENTRY_COLUMNS} FROM ledger_entries WHERE company_id = $1 AND reference = $2`,
      [companyId, reference],
    );
    return rows[0] ? entryFromRow(rows[0]) : null;
  }

  async findEntry(companyId: string, entryId: string): Promise<PostedEntry | null> {
    const { rows } = await this.db.query<EntryRow>(
      `SELECT ${ENTRY_COLUMNS} FROM ledger_entries WHERE company_id = $1 AND id = $2`,
      [companyId, entryId],
    );
    return rows[0] ? entryFromRow(rows[0]) : null;
  }

  async listEntries(companyId: string): Promise<PostedEntry[]> {
    const { rows } = await this.db.query<EntryRow>(
      `SELECT ${ENTRY_COLUMNS} FROM ledger_entries WHERE company_id = $1 ORDER BY entry_date, posted_at, id`,
      [companyId],
    );
    return rows.map(entryFromRow);
  }

  async appendEntry(entry: PostedEntry): Promise<void> {
    const lines: StoredLine[] = entry.lines.map((line) => ({
      account: line.account,
      side: line.side,
      amount: line.amount.toDecimal(),
      baseAmount: line.baseAmount.toDecimal(),
      memo: line.memo,
    }));
    try {
      await this.db.query(
        `INSERT INTO ledger_entries
           (id, tenant_id, company_id, reference, entry_date, period_id, currency, base_currency, memo, reversal_of, lines, posted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)`,
        [
          entry.id,
          this.tenantId,
          entry.companyId,
          entry.reference,
          entry.date,
          entry.periodId,
          entry.currency,
          entry.baseCurrency,
          entry.memo,
          entry.reversalOf,
          JSON.stringify(lines),
          entry.postedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("CONFLICT", `Reference ${entry.reference} was already used for a different entry`);
      }
      throw error;
    }
  }
}
