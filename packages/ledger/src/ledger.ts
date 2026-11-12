import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";
import { FxRateTable, Money, getCurrency, parseRate } from "@erp/money";
import { createAccount, type Account } from "./accounts";
import { assertIsoDate, monthlyPeriods, periodContaining, type FiscalPeriod } from "./periods";
import {
  describeEntry,
  type EntryLineInput,
  type PostEntryInput,
  type PostedEntry,
  type PostedLine,
  type Side,
} from "./posting";
import type { LedgerStore } from "./store";

export interface TrialBalanceRow {
  readonly account: string;
  readonly name: string;
  /** Sum of debit lines in the base currency, up to the as-of date. */
  readonly debit: Money;
  /** Sum of credit lines in the base currency, up to the as-of date. */
  readonly credit: Money;
}

export interface TrialBalance {
  readonly asOf: string;
  readonly baseCurrency: string;
  readonly rows: readonly TrialBalanceRow[];
  readonly totalDebit: Money;
  readonly totalCredit: Money;
}

export interface RateInput {
  readonly base: string;
  readonly quote: string;
  readonly effectiveDate: string;
  /** Decimal, for example "130.25". */
  readonly rate: string;
}

function assertReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw new DomainError("VALIDATION", "Reference must be 1 to 100 characters");
  }
  return trimmed;
}

function sumLines(lines: readonly EntryLineInput[], side: Side, currency: string): Money {
  return lines
    .filter((line) => line.side === side)
    .reduce((total, line) => total.add(line.amount), Money.zero(currency));
}

function sumPostedLines(lines: readonly PostedLine[], side: Side, currency: string): Money {
  return lines
    .filter((line) => line.side === side)
    .reduce((total, line) => total.add(line.baseAmount), Money.zero(currency));
}

/**
 * General ledger for one company. Every entry balances in its own currency and again in the
 * base currency after conversion. Closed periods reject postings, and corrections are reversals.
 */
export class Ledger {
  constructor(
    private readonly store: LedgerStore,
    private readonly companyId: string,
    private readonly baseCurrency: string,
    private readonly clock: Clock = systemClock,
  ) {
    getCurrency(baseCurrency);
  }

  async createAccount(input: { code: string; name: string; type: string }): Promise<Account> {
    const account = createAccount(input);
    const existing = (await this.store.listAccounts(this.companyId)).find((item) => item.code === account.code);
    if (existing) {
      throw new DomainError("CONFLICT", `Account ${account.code} already exists`);
    }
    await this.store.saveAccount(this.companyId, account);
    return account;
  }

  /** Creates the twelve monthly periods of a fiscal year. */
  async createFiscalYear(startYear: number, startMonth: number): Promise<FiscalPeriod[]> {
    const periods = monthlyPeriods(startYear, startMonth);
    const existing = new Set((await this.store.listFiscalPeriods(this.companyId)).map((period) => period.id));
    const clash = periods.find((period) => existing.has(period.id));
    if (clash) {
      throw new DomainError("CONFLICT", `Fiscal period ${clash.id} already exists`);
    }
    await this.store.saveFiscalPeriods(this.companyId, periods);
    return periods;
  }

  async closePeriod(periodId: string): Promise<void> {
    const periods = await this.store.listFiscalPeriods(this.companyId);
    if (!periods.some((period) => period.id === periodId)) {
      throw new DomainError("NOT_FOUND", `Fiscal period ${periodId} does not exist`);
    }
    await this.store.setPeriodStatus(this.companyId, periodId, "CLOSED");
  }

  /** Records an exchange rate. Rates are tenant-wide and effective from a date. */
  async setRate(input: RateInput): Promise<void> {
    assertIsoDate(input.effectiveDate);
    const rate = {
      base: input.base,
      quote: input.quote,
      effectiveDate: input.effectiveDate,
      rate: parseRate(input.rate),
    };
    const table = new FxRateTable();
    for (const existing of await this.store.listRates()) table.add(existing);
    table.add(rate);
    await this.store.saveRate(rate);
  }

  async post(input: PostEntryInput): Promise<PostedEntry> {
    return this.postEntry(input, null, null);
  }

  /**
   * Posts the opposite of an entry. The reversal uses the original base-currency amounts,
   * so a later change in exchange rates cannot leave residue in the books.
   */
  async reverse(entryId: string, input: { reference: string; date: string }): Promise<PostedEntry> {
    const original = await this.store.findEntry(this.companyId, entryId);
    if (!original) {
      throw new DomainError("NOT_FOUND", "Journal entry not found");
    }
    if (original.reversalOf !== null) {
      throw new DomainError("VALIDATION", "A reversal cannot be reversed");
    }
    const entries = await this.store.listEntries(this.companyId);
    if (entries.some((entry) => entry.reversalOf === original.id)) {
      throw new DomainError("CONFLICT", "This entry has already been reversed");
    }
    const flipped: PostEntryInput = {
      reference: input.reference,
      date: input.date,
      currency: original.currency,
      memo: `Reversal of ${original.reference}`,
      lines: original.lines.map((line) => ({
        account: line.account,
        side: line.side === "DEBIT" ? "CREDIT" : "DEBIT",
        amount: line.amount,
        memo: line.memo,
      })),
    };
    return this.postEntry(
      flipped,
      original.id,
      original.lines.map((line) => line.baseAmount),
    );
  }

  async trialBalance(asOf: string): Promise<TrialBalance> {
    assertIsoDate(asOf);
    const names = new Map((await this.store.listAccounts(this.companyId)).map((account) => [account.code, account.name]));
    const zero = Money.zero(this.baseCurrency);
    const sums = new Map<string, { debit: Money; credit: Money }>();
    for (const entry of await this.store.listEntries(this.companyId)) {
      if (entry.date > asOf) continue;
      for (const line of entry.lines) {
        const current = sums.get(line.account) ?? { debit: zero, credit: zero };
        sums.set(
          line.account,
          line.side === "DEBIT"
            ? { ...current, debit: current.debit.add(line.baseAmount) }
            : { ...current, credit: current.credit.add(line.baseAmount) },
        );
      }
    }
    const rows: TrialBalanceRow[] = [...sums.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([account, sum]) => ({ account, name: names.get(account) ?? account, debit: sum.debit, credit: sum.credit }));
    const totalDebit = rows.reduce((total, row) => total.add(row.debit), zero);
    const totalCredit = rows.reduce((total, row) => total.add(row.credit), zero);
    if (!totalDebit.equals(totalCredit)) {
      throw new Error("Trial balance is out of balance; the ledger is corrupt");
    }
    return { asOf, baseCurrency: this.baseCurrency, rows, totalDebit, totalCredit };
  }

  private async postEntry(
    input: PostEntryInput,
    reversalOf: string | null,
    fixedBase: readonly Money[] | null,
  ): Promise<PostedEntry> {
    const reference = assertReference(input.reference);
    assertIsoDate(input.date);
    getCurrency(input.currency);
    if (input.lines.length < 2) {
      throw new DomainError("VALIDATION", "A journal entry needs at least two lines");
    }
    const memo = input.memo?.trim() ? input.memo.trim() : null;

    const existing = await this.store.findEntryByReference(this.companyId, reference);
    if (existing) {
      const same =
        describeEntry(existing.date, existing.currency, existing.memo, existing.lines) ===
        describeEntry(input.date, input.currency, memo, input.lines);
      if (same) return existing;
      throw new DomainError("CONFLICT", `Reference ${reference} was already used for a different entry`);
    }

    const accounts = new Map((await this.store.listAccounts(this.companyId)).map((account) => [account.code, account]));
    for (const line of input.lines) {
      const account = accounts.get(line.account);
      if (!account) {
        throw new DomainError("VALIDATION", `Unknown account ${line.account}`);
      }
      if (!account.active) {
        throw new DomainError("VALIDATION", `Account ${line.account} is inactive`);
      }
      if (line.amount.currency !== input.currency) {
        throw new DomainError(
          "VALIDATION",
          `A ${line.amount.currency} line cannot sit in a ${input.currency} entry`,
        );
      }
      if (line.amount.minor <= 0n) {
        throw new DomainError("VALIDATION", "Line amounts must be positive; use the other side to reduce a balance");
      }
    }

    const period = periodContaining(await this.store.listFiscalPeriods(this.companyId), input.date);
    if (period.status === "CLOSED") {
      throw new DomainError("UNPROCESSABLE", `Period ${period.id} is closed`);
    }

    const debits = sumLines(input.lines, "DEBIT", input.currency);
    const credits = sumLines(input.lines, "CREDIT", input.currency);
    if (!debits.equals(credits)) {
      throw new DomainError("UNPROCESSABLE", `Entry does not balance: debits ${debits.toDecimal()} vs credits ${credits.toDecimal()} ${input.currency}`);
    }

    const rates = new FxRateTable();
    for (const rate of await this.store.listRates()) rates.add(rate);
    const lines: PostedLine[] = input.lines.map((line, index) => ({
      account: line.account,
      side: line.side,
      amount: line.amount,
      baseAmount: fixedBase ? fixedBase[index]! : rates.convert(line.amount, this.baseCurrency, input.date),
      memo: line.memo ?? null,
    }));

    const baseDebits = sumPostedLines(lines, "DEBIT", this.baseCurrency);
    const baseCredits = sumPostedLines(lines, "CREDIT", this.baseCurrency);
    if (!baseDebits.equals(baseCredits)) {
      throw new DomainError(
        "UNPROCESSABLE",
        `Converted to ${this.baseCurrency}, debits (${baseDebits.toDecimal()}) and credits (${baseCredits.toDecimal()}) differ. Use the exact rate or adjust the lines.`,
      );
    }

    const now = this.clock.now();
    const entry: PostedEntry = {
      id: newId(now.getTime()),
      companyId: this.companyId,
      reference,
      date: input.date,
      periodId: period.id,
      currency: input.currency,
      baseCurrency: this.baseCurrency,
      memo,
      reversalOf,
      lines,
      postedAt: now.toISOString(),
    };
    await this.store.appendEntry(entry);
    return entry;
  }
}
