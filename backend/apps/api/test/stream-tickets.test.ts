import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { MemoryTicketStore, RedisTicketStore } from "../src/stream-tickets";

const suite = (name: string, make: () => Promise<{ store: import("../src/stream-tickets").TicketStore; close: () => Promise<void> }>) =>
  describe(name, () => {
    it("consumes a ticket exactly once", async () => {
      const { store, close } = await make();
      await store.issue("ticket-once-0000000000000000000001", "tenant-a", 60);
      expect(await store.consume("ticket-once-0000000000000000000001")).toBe("tenant-a");
      expect(await store.consume("ticket-once-0000000000000000000001")).toBeNull();
      await close();
    });

    it("refuses a ticket that was never issued", async () => {
      const { store, close } = await make();
      expect(await store.consume("never-issued-ticket-000000000000000")).toBeNull();
      await close();
    });

    it("refuses an expired ticket", async () => {
      const { store, close } = await make();
      await store.issue("short-lived-ticket-00000000000000001", "tenant-b", 1);
      await new Promise((r) => setTimeout(r, 1500));
      expect(await store.consume("short-lived-ticket-00000000000000001")).toBeNull();
      await close();
    });
  });

suite("MemoryTicketStore", async () => ({ store: new MemoryTicketStore(), close: async () => {} }) as never);

const redisUrl = process.env.REDIS_TEST_URL;
(redisUrl ? describe : describe.skip)("RedisTicketStore", () => {
  const redis = new Redis(redisUrl ?? "redis://127.0.0.1:6379", { maxRetriesPerRequest: 1 });
  afterAll(() => redis.quit());
  suite("RedisTicketStore (live)", async () => ({
    store: new RedisTicketStore(redis),
    close: async () => {},
  }) as never);
});
