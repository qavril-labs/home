import type { FxRate } from "@erp/money";
import type { Account } from "./accounts";
import type { FiscalPeriod, PeriodStatus } from "./periods";
import type { PostedEntry } from "./posting";

/**
 * Storage port for the ledger. Implementations are tenant-bound: they see only the tenant
 * in context. Posted entries are append-only.
 */
export interface LedgerStore {
  saveAccount(companyId: string, account: Account): Promise<void>;
  listAccounts(companyId: string): Promise<Account[]>;
  saveFiscalPeriods(companyId: string, periods: readonly FiscalPeriod[]): Promise<void>;
  listFiscalPeriods(companyId: string): Promise<FiscalPeriod[]>;
  setPeriodStatus(companyId: string, periodId: string, status: PeriodStatus): Promise<void>;
  saveRate(rate: FxRate): Promise<void>;
  listRates(): Promise<FxRate[]>;
  findEntryByReference(companyId: string, reference: string): Promise<PostedEntry | null>;
  findEntry(companyId: string, entryId: string): Promise<PostedEntry | null>;
  listEntries(companyId: string): Promise<PostedEntry[]>;
  appendEntry(entry: PostedEntry): Promise<void>;
}
