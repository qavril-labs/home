import { describe, expect, it } from "vitest";
import { Money } from "@erp/money";
import { newId } from "@erp/kernel";
import { AuditLog, InMemoryAuditStore, diffRecords } from "../src";

describe("diffRecords", () => {
  it("lists only the fields that changed", () => {
    const changes = diffRecords({ status: "DRAFT", total: "10" }, { status: "POSTED", total: "10" });
    expect(changes).toEqual([{ field: "status", before: "DRAFT", after: "POSTED" }]);
  });

  it("treats a missing field and null as different", () => {
    const changes = diffRecords({}, { memo: null });
    expect(changes).toEqual([{ field: "memo", before: null, after: null }]);
  });

  it("compares money and bigint values by content", () => {
    const changes = diffRecords(
      { total: Money.fromDecimal("10.00", "USD"), count: 1n },
      { total: Money.fromDecimal("10.00", "USD"), count: 2n },
    );
    expect(changes).toEqual([{ field: "count", before: "1", after: "2" }]);
  });
});

describe("AuditLog", () => {
  it("records creates with every field and skips no-op updates", async () => {
    const store = new InMemoryAuditStore();
    const log = new AuditLog(store);
    const tenantId = newId();
    const entityId = newId();

    const created = await log.record({
      tenantId,
      actorId: null,
      action: "CREATE",
      entityType: "invoice",
      entityId,
      after: { number: "INV-1" },
    });
    expect(created?.changes).toEqual([{ field: "number", before: null, after: "INV-1" }]);

    const noop = await log.record({
      tenantId,
      actorId: null,
      action: "UPDATE",
      entityType: "invoice",
      entityId,
      before: { number: "INV-1" },
      after: { number: "INV-1" },
    });
    expect(noop).toBeNull();
    expect(await store.listForEntity(tenantId, "invoice", entityId)).toHaveLength(1);
  });
});
