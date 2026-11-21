import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { RealtimeEventManager } from "../src/invoicing-routes";
import { RedisRealtimeBus } from "../src/realtime-bus";

describe("realtime delivery without a bus", () => {
  it("delivers to listeners in the same process", () => {
    const manager = new RealtimeEventManager();
    const seen: string[] = [];
    manager.subscribe("tenant-local", (evt) => seen.push(evt.type));
    manager.broadcast("tenant-local", "sales.invoice.created", {});
    manager.broadcast("tenant-other", "sales.invoice.created", {});
    expect(seen).toEqual(["sales.invoice.created"]);
  });
});

const redisUrl = process.env.REDIS_TEST_URL;
(redisUrl ? describe : describe.skip)("realtime delivery through Redis", () => {
  const connections: Redis[] = [];
  const connect = () => {
    const c = new Redis(redisUrl ?? "", { maxRetriesPerRequest: 1 });
    connections.push(c);
    return c;
  };
  afterAll(async () => {
    await Promise.all(connections.map((c) => c.quit()));
  });

  it("delivers an event published by one instance to listeners on another", async () => {
    // Two instances, each with its own publish and subscribe connections.
    const instanceA = new RealtimeEventManager();
    instanceA.attachBus(new RedisRealtimeBus(connect(), connect()));
    const instanceB = new RealtimeEventManager();
    instanceB.attachBus(new RedisRealtimeBus(connect(), connect()));

    const tenant = `tenant-${Date.now()}`;
    const received = new Promise<{ type: string; tenantId: string }>((resolve) => {
      instanceB.subscribe(tenant, (evt) => resolve({ type: evt.type, tenantId: evt.tenantId }));
    });
    // Give both subscriptions a moment to register before publishing.
    await new Promise((r) => setTimeout(r, 300));
    instanceA.broadcast(tenant, "sales.invoice.paid", { id: "x" });

    await expect(received).resolves.toEqual({ type: "sales.invoice.paid", tenantId: tenant });
  });
});
