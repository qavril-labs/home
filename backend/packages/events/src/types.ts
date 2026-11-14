import { newId, systemClock, type Clock } from "@erp/kernel";

/**
 * A fact that happened in a tenant. Events are published through the transactional outbox,
 * so a business write and its event commit or roll back together.
 */
export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  /** Dotted name such as "sales.invoice.posted". */
  readonly type: string;
  readonly tenantId: string;
  /** ISO 8601 timestamp in UTC. */
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface OutboxEntry extends DomainEvent {
  /** Failed delivery attempts so far. */
  readonly attempts: number;
}

export interface OutboxStore {
  /** Must run inside the same transaction as the business write that caused the event. */
  append(events: readonly DomainEvent[]): Promise<void>;
  /** Leases up to `limit` undelivered events so concurrent dispatchers do not take the same ones. */
  claim(limit: number, leaseMs: number): Promise<OutboxEntry[]>;
  markDelivered(eventId: string): Promise<void>;
  /** Releases the lease. After `maxAttempts` failures the event is dead-lettered and not retried. */
  recordFailure(eventId: string, error: string, maxAttempts: number): Promise<void>;
}

/** Remembers which consumers have handled which events, so retries do not repeat side effects. */
export interface ProcessedStore {
  has(consumer: string, eventId: string): Promise<boolean>;
  mark(consumer: string, eventId: string): Promise<void>;
}

export function createEvent<TPayload>(
  type: string,
  tenantId: string,
  payload: TPayload,
  clock: Clock = systemClock,
): DomainEvent<TPayload> {
  const now = clock.now();
  return { id: newId(now.getTime()), type, tenantId, occurredAt: now.toISOString(), payload };
}
