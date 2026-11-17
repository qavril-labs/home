import type { AuditEntry, AuditStore } from "./audit";
import { GENESIS_HASH, chainHash } from "./chain";

/** Audit store for unit tests. Production uses the append-only Postgres table in @erp/db. */
export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = [];

  async append(entry: AuditEntry): Promise<AuditEntry> {
    const previous = this.entries[this.entries.length - 1];
    const sequence = (previous?.sequence ?? 0) + 1;
    const prevHash = previous?.hash ?? GENESIS_HASH;
    const chained: AuditEntry = { ...entry, sequence, prevHash, hash: chainHash(entry, sequence, prevHash) };
    this.entries.push(chained);
    return chained;
  }

  async listForEntity(tenantId: string, entityType: string, entityId: string): Promise<AuditEntry[]> {
    return this.entries.filter(
      (entry) => entry.tenantId === tenantId && entry.entityType === entityType && entry.entityId === entityId,
    );
  }

  /** All entries of one tenant, in the order they were written. Used to verify the chain. */
  async listForTenant(tenantId: string): Promise<AuditEntry[]> {
    return this.entries.filter((entry) => entry.tenantId === tenantId);
  }
}
