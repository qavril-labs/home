import { DomainError } from "@erp/kernel";

export type ResetPolicy = "NEVER" | "YEARLY" | "MONTHLY";

export interface SequenceDefinition {
  /** Stable key, e.g. "SALES_INVOICE". */
  readonly key: string;
  /** Printed before the number, e.g. "INV-". */
  readonly prefix: string;
  /** Minimum digits for the counter, e.g. 6 gives 000001. */
  readonly padding: number;
  /** When the counter restarts. */
  readonly reset: ResetPolicy;
}

/**
 * Atomically returns the next counter value and advances it.
 * The Postgres implementation runs inside the caller's transaction, so a rolled-back
 * document also rolls back its number. That is what keeps sequences gap-free.
 */
export interface CounterStore {
  nextValue(tenantId: string, counterKey: string): Promise<bigint>;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function periodKey(reset: ResetPolicy, isoDate: string): string {
  if (!DATE_PATTERN.test(isoDate)) {
    throw new DomainError("VALIDATION", `Expected a YYYY-MM-DD date, got ${isoDate}`);
  }
  switch (reset) {
    case "NEVER":
      return "";
    case "YEARLY":
      return isoDate.slice(0, 4);
    case "MONTHLY":
      return isoDate.slice(0, 7);
  }
}

export function formatNumber(definition: SequenceDefinition, period: string, value: bigint): string {
  const periodPart = period === "" ? "" : `${period}-`;
  return `${definition.prefix}${periodPart}${value.toString().padStart(definition.padding, "0")}`;
}

export class NumberingService {
  private readonly definitions = new Map<string, SequenceDefinition>();

  constructor(
    private readonly counters: CounterStore,
    definitions: readonly SequenceDefinition[],
  ) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.key)) {
        throw new DomainError("CONFLICT", `Duplicate sequence ${definition.key}`);
      }
      if (!Number.isInteger(definition.padding) || definition.padding < 1 || definition.padding > 12) {
        throw new DomainError("VALIDATION", `Padding for ${definition.key} must be between 1 and 12`);
      }
      this.definitions.set(definition.key, definition);
    }
  }

  /**
   * Returns the next document number. `scope` gives an independent counter, for example
   * a branch code, when numbering must restart per branch.
   */
  async next(tenantId: string, key: string, isoDate: string, scope = ""): Promise<string> {
    const definition = this.definitions.get(key);
    if (!definition) {
      throw new DomainError("VALIDATION", `Unknown sequence ${key}`);
    }
    const period = periodKey(definition.reset, isoDate);
    const value = await this.counters.nextValue(tenantId, `${definition.key}|${scope}|${period}`);
    return formatNumber(definition, period, value);
  }
}
