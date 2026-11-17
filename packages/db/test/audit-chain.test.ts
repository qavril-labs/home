import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyChain, type AuditEntry } from "@erp/audit";
import { FixedClock, newId } from "@erp/kernel";
import { TenantService } from "@erp/tenancy";
import { PgAuditStore, PgTenantRepository, withTenantTransaction } from "../src";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

const clock = new FixedClock(new Date("2026-11-17T09:00:00Z"));

function entry(tenantId: string, index: number): AuditEntry {
  return {
    id: newId(clock.now().getTime() + index),
    tenantId,
    actorId: null,
    action: "UPDATE",
    entityType: "invoice",
    entityId: `INV-${index}`,
    changes: [{ field: "status", before: "OPEN", after: "PAID" }],
    occurredAt: clock.now().toISOString(),
    requestId: `req-${index}`,
  };
}

describe("audit chain in Postgres", () => {
  let db: TestDatabase;
  let tenantId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    tenantId = newId();
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const tenants = new TenantService(new PgTenantRepository(tx));
      await tenants.createTenant({ slug: "chain-co", name: "Chain Co", region: "EU" }, tenantId);
    });
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("keeps one unbroken chain when many writers append at the same time", async () => {
    const writes = Array.from({ length: 10 }, (_, index) =>
      withTenantTransaction(db.appPool, tenantId, (tx) => new PgAuditStore(tx).append(entry(tenantId, index + 1))),
    );
    const written = await Promise.all(writes);
    expect(new Set(written.map((item) => item.sequence)).size).toBe(10);

    const chain = await withTenantTransaction(db.appPool, tenantId, (tx) => new PgAuditStore(tx).listForTenant(tenantId));
    expect(chain.map((item) => item.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(verifyChain(chain)).toEqual({ ok: true, checked: 10, unchained: 0 });
  });

  it("keeps the chain going past nine entries, where a text sort would reuse a position", async () => {
    // Sequence 10 is the first with two digits. Sorting it as text puts "9" after "10", so the next
    // append would claim a position that is already taken.
    for (let index = 11; index <= 14; index++) {
      await withTenantTransaction(db.appPool, tenantId, (tx) => new PgAuditStore(tx).append(entry(tenantId, index)));
    }
    const chain = await withTenantTransaction(db.appPool, tenantId, (tx) => new PgAuditStore(tx).listForTenant(tenantId));
    expect(chain.map((item) => item.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(verifyChain(chain)).toEqual({ ok: true, checked: 14, unchained: 0 });
  });

  it("refuses to change a stored entry, because the table rejects updates", async () => {
    await expect(
      db.adminPool.query("UPDATE audit_log SET action = 'FORGED' WHERE tenant_id = $1 AND sequence = 1", [tenantId]),
    ).rejects.toThrow(/append-only/);
  });
});
