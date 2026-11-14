import { systemClock, type Clock } from "@erp/kernel";
import type { DomainEvent, OutboxEntry, OutboxStore, ProcessedStore } from "./types";

interface OutboxRow {
  readonly event: DomainEvent;
  attempts: number;
  delivered: boolean;
  dead: boolean;
  leaseUntil: number;
  lastError: string | null;
}

/** Outbox for unit tests and local experiments. Production uses the Postgres store in @erp/db. */
export class InMemoryOutbox implements OutboxStore {
  private readonly rows: OutboxRow[] = [];

  constructor(private readonly clock: Clock = systemClock) {}

  async append(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.rows.push({ event, attempts: 0, delivered: false, dead: false, leaseUntil: 0, lastError: null });
    }
  }

  async claim(limit: number, leaseMs: number): Promise<OutboxEntry[]> {
    const now = this.clock.now().getTime();
    const claimed: OutboxEntry[] = [];
    for (const row of this.rows) {
      if (claimed.length >= limit) break;
      if (row.delivered || row.dead || row.leaseUntil > now) continue;
      row.leaseUntil = now + leaseMs;
      claimed.push({ ...row.event, attempts: row.attempts });
    }
    return claimed;
  }

  async markDelivered(eventId: string): Promise<void> {
    const row = this.find(eventId);
    row.delivered = true;
    row.leaseUntil = 0;
  }

  async recordFailure(eventId: string, error: string, maxAttempts: number): Promise<void> {
    const row = this.find(eventId);
    row.attempts += 1;
    row.leaseUntil = 0;
    row.lastError = error;
    if (row.attempts >= maxAttempts) {
      row.dead = true;
    }
  }

  /** Test helper: current state of one event. */
  inspect(eventId: string): { delivered: boolean; dead: boolean; attempts: number; lastError: string | null } {
    const { delivered, dead, attempts, lastError } = this.find(eventId);
    return { delivered, dead, attempts, lastError };
  }

  private find(eventId: string): OutboxRow {
    const row = this.rows.find((candidate) => candidate.event.id === eventId);
    if (!row) {
      throw new Error(`Unknown outbox event ${eventId}`);
    }
    return row;
  }
}

export class InMemoryProcessedStore implements ProcessedStore {
  private readonly seen = new Set<string>();

  async has(consumer: string, eventId: string): Promise<boolean> {
    return this.seen.has(`${consumer}:${eventId}`);
  }

  async mark(consumer: string, eventId: string): Promise<void> {
    this.seen.add(`${consumer}:${eventId}`);
  }
}
