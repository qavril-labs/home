import type { FxRate } from "@erp/money";
import type { Account } from "./accounts";
import type { FiscalPeriod, PeriodStatus } from "./periods";
import type { PostedEntry } from "./posting";
import type { LedgerStore } from "./store";

/** Store for unit tests. Production uses the Postgres store in @erp/db. */
export class InMemoryLedgerStore implements LedgerStore {
  private readonly accounts = new Map<string, Account[]>();
  private readonly periods = new Map<string, FiscalPeriod[]>();
  private readonly rates: FxRate[] = [];
  private readonly entries = new Map<string, PostedEntry[]>();

  async saveAccount(companyId: string, account: Account): Promise<void> {
    this.accounts.set(companyId, [...(this.accounts.get(companyId) ?? []), account]);
  }

  async listAccounts(companyId: string): Promise<Account[]> {
    return [...(this.accounts.get(companyId) ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  }

  async saveFiscalPeriods(companyId: string, periods: readonly FiscalPeriod[]): Promise<void> {
    this.periods.set(companyId, [...(this.periods.get(companyId) ?? []), ...periods]);
  }

  async listFiscalPeriods(companyId: string): Promise<FiscalPeriod[]> {
    return [...(this.periods.get(companyId) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  }

  async setPeriodStatus(companyId: string, periodId: string, status: PeriodStatus): Promise<void> {
    this.periods.set(
      companyId,
      (this.periods.get(companyId) ?? []).map((period) => (period.id === periodId ? { ...period, status } : period)),
    );
  }

  async saveRate(rate: FxRate): Promise<void> {
    this.rates.push(rate);
  }

  async listRates(): Promise<FxRate[]> {
    return [...this.rates];
  }

  async findEntryByReference(companyId: string, reference: string): Promise<PostedEntry | null> {
    return (this.entries.get(companyId) ?? []).find((entry) => entry.reference === reference) ?? null;
  }

  async findEntry(companyId: string, entryId: string): Promise<PostedEntry | null> {
    return (this.entries.get(companyId) ?? []).find((entry) => entry.id === entryId) ?? null;
  }

  async listEntries(companyId: string): Promise<PostedEntry[]> {
    return [...(this.entries.get(companyId) ?? [])];
  }

  async appendEntry(entry: PostedEntry): Promise<void> {
    this.entries.set(entry.companyId, [...(this.entries.get(entry.companyId) ?? []), entry]);
  }
}
