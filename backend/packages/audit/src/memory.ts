import type { AuditEntry, AuditStore } from "./audit";

/** Audit store for unit tests. Production uses the append-only Postgres table in @erp/db. */
export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = [];

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listForEntity(tenantId: string, entityType: string, entityId: string): Promise<AuditEntry[]> {
    return this.entries.filter(
      (entry) => entry.tenantId === tenantId && entry.entityType === entityType && entry.entityId === entityId,
    );
  }
}
