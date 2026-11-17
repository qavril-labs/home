import { describe, expect, it } from "vitest";
import { newId } from "@erp/kernel";
import { InMemoryAuditStore, GENESIS_HASH, AuditLog, stableStringify, verifyChain, type AuditEntry } from "../src";

const TENANT = "11111111-1111-7111-8111-111111111111";

async function writeChain(count: number): Promise<AuditEntry[]> {
  const store = new InMemoryAuditStore();
  const log = new AuditLog(store);
  for (let i = 1; i <= count; i += 1) {
    await log.record({
      tenantId: TENANT,
      actorId: null,
      action: "UPDATE",
      entityType: "invoice",
      entityId: `INV-${i}`,
      before: { status: "OPEN", amount: "10.00" },
      after: { status: "PAID", amount: "10.00" },
    });
  }
  return store.listForTenant(TENANT);
}

describe("stableStringify", () => {
  it("writes object keys in sorted order, so equal values give equal text", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(stableStringify({ n: 5n })).toBe('{"n":"5"}');
  });
});

describe("audit chain", () => {
  it("links each entry to the one before and starts from the genesis hash", async () => {
    const chain = await writeChain(3);
    expect(chain.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(chain[0]?.prevHash).toBe(GENESIS_HASH);
    expect(chain[1]?.prevHash).toBe(chain[0]?.hash);
    expect(chain[2]?.prevHash).toBe(chain[1]?.hash);
  });

  it("verifies an untouched chain", async () => {
    const verdict = verifyChain(await writeChain(4));
    expect(verdict).toEqual({ ok: true, checked: 4, unchained: 0 });
  });

  it("detects an edited entry at the edited position", async () => {
    const chain = await writeChain(3);
    const edited = chain.map((entry) =>
      entry.sequence === 2 ? { ...entry, changes: [{ field: "status", before: "OPEN", after: "VOID" }] } : entry,
    );
    expect(verifyChain(edited)).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it("detects a removed entry as a gap", async () => {
    const chain = await writeChain(3);
    const withGap = chain.filter((entry) => entry.sequence !== 2);
    expect(verifyChain(withGap)).toMatchObject({ ok: false, brokenAt: 3, reason: "a sequence number is missing" });
  });

  it("detects a rewritten link even when the entry hash is recomputed by someone else", async () => {
    const chain = await writeChain(2);
    const forged = { ...chain[1]!, prevHash: "f".repeat(64) };
    expect(verifyChain([chain[0]!, forged])).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it("counts entries written before the chain without checking them", async () => {
    const legacy: AuditEntry = {
      id: newId(),
      tenantId: TENANT,
      actorId: null,
      action: "CREATE",
      entityType: "tenant",
      entityId: TENANT,
      changes: [],
      occurredAt: "2026-01-01T00:00:00.000Z",
      requestId: null,
    };
    const chain = await writeChain(2);
    expect(verifyChain([legacy, ...chain])).toEqual({ ok: true, checked: 2, unchained: 1 });
  });

  it("an empty tenant verifies with nothing checked", () => {
    expect(verifyChain([])).toEqual({ ok: true, checked: 0, unchained: 0 });
  });
});
