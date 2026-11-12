import { describe, expect, it } from "vitest";
import { DomainError, newId } from "@erp/kernel";
import { InMemoryCounterStore, NumberingService, formatNumber, periodKey, type SequenceDefinition } from "../src";

const INVOICES: SequenceDefinition = { key: "SALES_INVOICE", prefix: "INV-", padding: 6, reset: "YEARLY" };
const RECEIPTS: SequenceDefinition = { key: "RECEIPT", prefix: "RCT", padding: 4, reset: "NEVER" };

describe("periodKey", () => {
  it("resets by year, month, or never", () => {
    expect(periodKey("YEARLY", "2026-10-31")).toBe("2026");
    expect(periodKey("MONTHLY", "2026-10-31")).toBe("2026-10");
    expect(periodKey("NEVER", "2026-10-31")).toBe("");
  });

  it("rejects malformed dates", () => {
    expect(() => periodKey("YEARLY", "31/10/2026")).toThrow(DomainError);
  });
});

describe("formatNumber", () => {
  it("includes the period only when the sequence resets", () => {
    expect(formatNumber(INVOICES, "2026", 42n)).toBe("INV-2026-000042");
    expect(formatNumber(RECEIPTS, "", 7n)).toBe("RCT0007");
  });
});

describe("NumberingService", () => {
  it("issues consecutive numbers per tenant and sequence", async () => {
    const service = new NumberingService(new InMemoryCounterStore(), [INVOICES, RECEIPTS]);
    const tenant = newId();
    expect(await service.next(tenant, "SALES_INVOICE", "2026-03-01")).toBe("INV-2026-000001");
    expect(await service.next(tenant, "SALES_INVOICE", "2026-03-02")).toBe("INV-2026-000002");
    expect(await service.next(tenant, "RECEIPT", "2026-03-02")).toBe("RCT0001");
  });

  it("keeps tenants independent", async () => {
    const service = new NumberingService(new InMemoryCounterStore(), [INVOICES]);
    expect(await service.next(newId(), "SALES_INVOICE", "2026-01-01")).toBe("INV-2026-000001");
    expect(await service.next(newId(), "SALES_INVOICE", "2026-01-01")).toBe("INV-2026-000001");
  });

  it("restarts yearly sequences in a new year", async () => {
    const service = new NumberingService(new InMemoryCounterStore(), [INVOICES]);
    const tenant = newId();
    await service.next(tenant, "SALES_INVOICE", "2026-12-31");
    expect(await service.next(tenant, "SALES_INVOICE", "2027-01-01")).toBe("INV-2027-000001");
  });

  it("gives scoped counters their own numbering", async () => {
    const service = new NumberingService(new InMemoryCounterStore(), [INVOICES]);
    const tenant = newId();
    expect(await service.next(tenant, "SALES_INVOICE", "2026-01-01", "BR1")).toBe("INV-2026-000001");
    expect(await service.next(tenant, "SALES_INVOICE", "2026-01-01", "BR2")).toBe("INV-2026-000001");
  });

  it("issues unique numbers under concurrency", async () => {
    const service = new NumberingService(new InMemoryCounterStore(), [RECEIPTS]);
    const tenant = newId();
    const numbers = await Promise.all(
      Array.from({ length: 200 }, () => service.next(tenant, "RECEIPT", "2026-01-01")),
    );
    expect(new Set(numbers).size).toBe(200);
  });

  it("rejects unknown sequences and duplicate definitions", async () => {
    const service = new NumberingService(new InMemoryCounterStore(), [INVOICES]);
    await expect(service.next(newId(), "NOPE", "2026-01-01")).rejects.toThrow(DomainError);
    expect(() => new NumberingService(new InMemoryCounterStore(), [INVOICES, INVOICES])).toThrow(/Duplicate/);
  });
});
