import { describe, expect, it } from "vitest";
import { FixedClock, newId } from "@erp/kernel";
import {
  EventBus,
  InMemoryOutbox,
  InMemoryProcessedStore,
  OutboxDispatcher,
  createEvent,
  type DomainEvent,
} from "../src";

const TENANT = newId();

function setup() {
  const clock = new FixedClock(new Date("2026-03-01T10:00:00Z"));
  const outbox = new InMemoryOutbox(clock);
  const processed = new InMemoryProcessedStore();
  const bus = new EventBus(processed);
  const dispatcher = new OutboxDispatcher(outbox, bus, { maxAttempts: 3, leaseMs: 1000 });
  return { clock, outbox, bus, dispatcher };
}

describe("createEvent", () => {
  it("stamps id, tenant, and time", () => {
    const clock = new FixedClock(new Date("2026-03-01T10:00:00Z"));
    const event = createEvent("sales.invoice.posted", TENANT, { total: "10.00" }, clock);
    expect(event.occurredAt).toBe("2026-03-01T10:00:00.000Z");
    expect(event.tenantId).toBe(TENANT);
    expect(event.id).toHaveLength(36);
  });
});

describe("OutboxDispatcher", () => {
  it("delivers appended events and marks them delivered", async () => {
    const { outbox, bus, dispatcher } = setup();
    const received: DomainEvent[] = [];
    bus.subscribe("ledger", "sales.invoice.posted", async (event) => {
      received.push(event);
    });

    const event = createEvent("sales.invoice.posted", TENANT, { total: "10.00" });
    await outbox.append([event]);

    expect(await dispatcher.runOnce()).toEqual({ delivered: 1, failed: 0 });
    expect(received.map((e) => e.id)).toEqual([event.id]);
    expect(outbox.inspect(event.id).delivered).toBe(true);
    expect(await dispatcher.runOnce()).toEqual({ delivered: 0, failed: 0 });
  });

  it("does not deliver events of other types", async () => {
    const { outbox, bus, dispatcher } = setup();
    let calls = 0;
    bus.subscribe("ledger", "sales.invoice.posted", async () => {
      calls += 1;
    });
    await outbox.append([createEvent("purchasing.bill.posted", TENANT, {})]);
    await dispatcher.runOnce();
    expect(calls).toBe(0);
  });

  it("retries a failing consumer without repeating the ones that succeeded", async () => {
    const { clock, outbox, bus, dispatcher } = setup();
    let aCalls = 0;
    let bCalls = 0;
    bus.subscribe("a", "sales.invoice.posted", async () => {
      aCalls += 1;
    });
    bus.subscribe("b", "sales.invoice.posted", async () => {
      bCalls += 1;
      if (bCalls === 1) throw new Error("ledger is locked");
    });

    const event = createEvent("sales.invoice.posted", TENANT, {});
    await outbox.append([event]);

    expect(await dispatcher.runOnce()).toEqual({ delivered: 0, failed: 1 });
    expect(outbox.inspect(event.id).lastError).toBe("ledger is locked");

    clock.advance(1);
    expect(await dispatcher.runOnce()).toEqual({ delivered: 1, failed: 0 });
    expect(aCalls).toBe(1);
    expect(bCalls).toBe(2);
  });

  it("dead-letters an event after the maximum number of attempts", async () => {
    const { outbox, bus, dispatcher } = setup();
    bus.subscribe("always-fails", "sales.invoice.posted", async () => {
      throw new Error("boom");
    });
    const event = createEvent("sales.invoice.posted", TENANT, {});
    await outbox.append([event]);

    for (let attempt = 0; attempt < 3; attempt++) {
      await dispatcher.runOnce();
    }
    expect(outbox.inspect(event.id)).toMatchObject({ dead: true, attempts: 3 });
    expect(await dispatcher.runOnce()).toEqual({ delivered: 0, failed: 0 });
  });

  it("leases claimed events so a second dispatcher skips them", async () => {
    const { outbox } = setup();
    await outbox.append([createEvent("sales.invoice.posted", TENANT, {})]);
    expect(await outbox.claim(10, 1000)).toHaveLength(1);
    expect(await outbox.claim(10, 1000)).toHaveLength(0);
  });
});
