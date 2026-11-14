import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@erp/kernel";
import { createEvent } from "@erp/events";
import { NumberingService, type SequenceDefinition } from "@erp/numbering";
import { TenantService } from "@erp/tenancy";
import {
  PgAuditStore,
  PgCounterStore,
  PgOutboxStore,
  PgTenantRepository,
  runMigrations,
  withTenantTransaction,
} from "../src";
import { MIGRATIONS_DIR } from "../src/paths";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

const INVOICES: SequenceDefinition = { key: "INV", prefix: "INV-", padding: 4, reset: "YEARLY" };

async function createTenant(db: TestDatabase, slug: string): Promise<string> {
  const id = newId();
  await withTenantTransaction(db.appPool, id, async (tx) => {
    const tenants = new TenantService(new PgTenantRepository(tx));
    const tenant = await tenants.createTenant({ slug, name: slug, region: "EU" }, id);
    await tenants.createCompany(tenant.id, {
      legalName: `${slug} GmbH`,
      countryCode: "DE",
      baseCurrency: "EUR",
      fiscalYearStartMonth: 1,
    });
  });
  return id;
}

const nextInvoice = (db: TestDatabase, tenantId: string, date: string) =>
  withTenantTransaction(db.appPool, tenantId, (tx) =>
    new NumberingService(new PgCounterStore(tx), [INVOICES]).next(tenantId, "INV", date),
  );

describe("Postgres foundation", () => {
  let db: TestDatabase;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    tenantA = await createTenant(db, "tenant-a");
    tenantB = await createTenant(db, "tenant-b");
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("finds no pending migrations after the first run", async () => {
    expect(await runMigrations(db.adminPool, MIGRATIONS_DIR)).toEqual([]);
  });

  it("shows each tenant only its own companies", async () => {
    const rows = await withTenantTransaction(db.appPool, tenantA, async (tx) => {
      const result = await tx.query<{ tenant_id: string }>("SELECT tenant_id FROM companies");
      return result.rows;
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.tenant_id === tenantA)).toBe(true);
  });

  it("refuses to write a row for another tenant", async () => {
    await expect(
      withTenantTransaction(db.appPool, tenantA, (tx) =>
        new TenantService(new PgTenantRepository(tx)).createCompany(tenantB, {
          legalName: "Intruder Ltd",
          countryCode: "DE",
          baseCurrency: "EUR",
          fiscalYearStartMonth: 1,
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("fails closed when no tenant is set", async () => {
    const outcome = await db.appPool
      .query<{ n: number }>("SELECT count(*)::int AS n FROM users")
      .then((result) => result.rows[0]?.n ?? -1)
      .catch(() => "error");
    expect(outcome === 0 || outcome === "error").toBe(true);
  });

  it("issues gap-free, unique numbers under concurrency", async () => {
    const numbers = await Promise.all(Array.from({ length: 20 }, () => nextInvoice(db, tenantA, "2026-05-01")));
    const expected = Array.from({ length: 20 }, (_, index) => `INV-2026-${String(index + 1).padStart(4, "0")}`);
    expect([...numbers].sort()).toEqual(expected);
  });

  it("returns a rolled-back number to the pool", async () => {
    await expect(
      withTenantTransaction(db.appPool, tenantA, async (tx) => {
        await new NumberingService(new PgCounterStore(tx), [INVOICES]).next(tenantA, "INV", "2026-05-01");
        throw new Error("save failed");
      }),
    ).rejects.toThrow("save failed");
    expect(await nextInvoice(db, tenantA, "2026-05-01")).toBe("INV-2026-0021");
  });

  it("publishes events only when the business write commits", async () => {
    const committed = createEvent("sales.invoice.posted", tenantA, { total: "10.00" });
    const rolledBack = createEvent("sales.invoice.posted", tenantA, { total: "99.00" });

    await withTenantTransaction(db.appPool, tenantA, (tx) => new PgOutboxStore(tx).append([committed]));
    await expect(
      withTenantTransaction(db.appPool, tenantA, async (tx) => {
        await new PgOutboxStore(tx).append([rolledBack]);
        throw new Error("invoice rejected");
      }),
    ).rejects.toThrow("invoice rejected");

    const outbox = new PgOutboxStore(db.appPool);
    const claimed = await outbox.claim(1000, 60_000);
    const delivered = claimed.find((event) => event.id === committed.id);
    expect(delivered?.payload).toEqual({ total: "10.00" });
    expect(claimed.map((event) => event.id)).not.toContain(rolledBack.id);

    // Leased events are not handed out twice.
    expect((await outbox.claim(1000, 60_000)).map((event) => event.id)).not.toContain(committed.id);
    await outbox.markDelivered(committed.id);
  });

  it("treats the audit log as append-only", async () => {
    const id = newId();
    await withTenantTransaction(db.appPool, tenantA, (tx) =>
      new PgAuditStore(tx).append({
        id,
        tenantId: tenantA,
        actorId: null,
        action: "CREATE",
        entityType: "test",
        entityId: "1",
        changes: [],
        occurredAt: new Date().toISOString(),
        requestId: null,
      }),
    );
    await expect(
      withTenantTransaction(db.appPool, tenantA, (tx) =>
        tx.query("UPDATE audit_log SET action = 'TAMPERED' WHERE id = $1", [id]),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      withTenantTransaction(db.appPool, tenantA, (tx) => tx.query("DELETE FROM audit_log WHERE id = $1", [id])),
    ).rejects.toThrow(/append-only/);
  });

  it("keeps ledger entries append-only at the database level", async () => {
    const entryId = newId();
    const companyId = await withTenantTransaction(db.appPool, tenantA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("SELECT id FROM companies WHERE tenant_id = $1 LIMIT 1", [tenantA]);
      return rows[0]!.id;
    });
    await withTenantTransaction(db.appPool, tenantA, (tx) =>
      tx.query(
        `INSERT INTO ledger_entries (id, tenant_id, company_id, reference, entry_date, period_id, currency, base_currency, lines)
         VALUES ($1, $2, $3, 'IMMUTABLE-1', '2026-01-15', '2026-01', 'EUR', 'EUR', '[]'::jsonb)`,
        [entryId, tenantA, companyId],
      ),
    );
    await expect(
      withTenantTransaction(db.appPool, tenantA, (tx) =>
        tx.query("UPDATE ledger_entries SET memo = 'edited' WHERE id = $1", [entryId]),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      withTenantTransaction(db.appPool, tenantA, (tx) => tx.query("DELETE FROM ledger_entries WHERE id = $1", [entryId])),
    ).rejects.toThrow(/append-only/);
  });
});
