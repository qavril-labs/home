import type { DomainEvent, ProcessedStore } from "./types";

export type EventHandler = (event: DomainEvent) => Promise<void>;

interface Subscription {
  readonly consumer: string;
  readonly type: string;
  readonly handler: EventHandler;
}

/**
 * In-process delivery of events to subscribers. Delivery is at-least-once: if a handler
 * fails, the event is retried later, and subscribers that already succeeded are skipped.
 * Handlers must still be idempotent, because a crash between the handler and the
 * processed-mark can cause one repeat.
 */
export class EventBus {
  private readonly subscriptions: Subscription[] = [];

  constructor(private readonly processed: ProcessedStore) {}

  subscribe(consumer: string, type: string, handler: EventHandler): void {
    this.subscriptions.push({ consumer, type, handler });
  }

  async dispatch(event: DomainEvent): Promise<void> {
    for (const subscription of this.subscriptions) {
      if (subscription.type !== event.type) continue;
      if (await this.processed.has(subscription.consumer, event.id)) continue;
      await subscription.handler(event);
      await this.processed.mark(subscription.consumer, event.id);
    }
  }
}
