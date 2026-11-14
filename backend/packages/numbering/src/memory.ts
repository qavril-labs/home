import type { CounterStore } from "./numbering";

/**
 * Counter store for unit tests. It cannot model rollback, so it is not gap-free across
 * failures. Production uses the Postgres store in @erp/db, which is.
 */
export class InMemoryCounterStore implements CounterStore {
  private readonly counters = new Map<string, bigint>();

  async nextValue(tenantId: string, counterKey: string): Promise<bigint> {
    const key = `${tenantId}|${counterKey}`;
    const current = this.counters.get(key) ?? 1n;
    this.counters.set(key, current + 1n);
    return current;
  }
}
