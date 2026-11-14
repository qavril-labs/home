import type { DomainEvent, OutboxStore } from "./types";

/**
 * Where the dispatcher sends events: the in-process EventBus, or a queue such as the BullMQ
 * sink in @erp/queue. Throwing means "not delivered"; the outbox retries it later.
 */
export interface EventSink {
  dispatch(event: DomainEvent): Promise<void>;
}

export interface DispatcherOptions {
  readonly batchSize?: number;
  readonly leaseMs?: number;
  readonly maxAttempts?: number;
}

export interface DispatchReport {
  readonly delivered: number;
  readonly failed: number;
}

/** Moves committed events from the outbox to the bus. Run it on a timer or as a worker. */
export class OutboxDispatcher {
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly outbox: OutboxStore,
    private readonly bus: EventSink,
    options: DispatcherOptions = {},
  ) {
    this.batchSize = options.batchSize ?? 100;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.maxAttempts = options.maxAttempts ?? 5;
  }

  async runOnce(): Promise<DispatchReport> {
    const batch = await this.outbox.claim(this.batchSize, this.leaseMs);
    let delivered = 0;
    let failed = 0;
    for (const entry of batch) {
      try {
        await this.bus.dispatch(entry);
        await this.outbox.markDelivered(entry.id);
        delivered += 1;
      } catch (error) {
        failed += 1;
        await this.outbox.recordFailure(entry.id, errorMessage(error), this.maxAttempts);
      }
    }
    return { delivered, failed };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
