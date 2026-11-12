import { describe, expect, it } from "vitest";
import { OutboxDispatcher, InMemoryOutbox, createEvent } from "@erp/events";
import { DEFAULT_JOB_OPTIONS, QueueEventSink, type JobQueue } from "../src/index";

class FakeQueue implements JobQueue {
  readonly jobs = new Map<string, { name: string; data: unknown }>();
  failNext = false;

  async add(name: string, data: unknown, options?: { jobId?: string }): Promise<unknown> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("redis unavailable");
    }
    const id = options?.jobId ?? String(this.jobs.size);
    // Like BullMQ: a job id that already exists is not added again.
    if (!this.jobs.has(id)) this.jobs.set(id, { name, data });
    return id;
  }
}

describe("QueueEventSink", () => {
  it("adds each event as a job named by its type, keyed by its id, with retries", async () => {
    const queue = new FakeQueue();
    const sink = new QueueEventSink(queue);
    const event = createEvent("sales.invoice.posted", "tenant-1", { total: "10.00" });
    await sink.dispatch(event);
    await sink.dispatch(event);
    expect(queue.jobs.size).toBe(1);
    expect(queue.jobs.get(event.id)).toEqual({ name: "sales.invoice.posted", data: event });
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(5);
  });

  it("leaves the event in the outbox when the queue is down, and relays it on the next run", async () => {
    const outbox = new InMemoryOutbox();
    const queue = new FakeQueue();
    const dispatcher = new OutboxDispatcher(outbox, new QueueEventSink(queue));
    await outbox.append([createEvent("tenancy.tenant.created", "tenant-1", {})]);

    queue.failNext = true;
    expect(await dispatcher.runOnce()).toEqual({ delivered: 0, failed: 1 });
    expect(queue.jobs.size).toBe(0);

    expect(await dispatcher.runOnce()).toEqual({ delivered: 1, failed: 0 });
    expect(queue.jobs.size).toBe(1);
  });
});
