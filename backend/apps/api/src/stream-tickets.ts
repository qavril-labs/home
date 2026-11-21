import type { Redis } from "ioredis";

/**
 * Single-use tickets for the live event stream. A ticket is issued to a signed-in user and can be
 * consumed once, within its lifetime. The Redis store works across several API instances; the memory
 * store is for one instance and for tests.
 */
export interface TicketStore {
  issue(ticket: string, tenantId: string, ttlSeconds: number): Promise<void>;
  /** Returns the tenant the ticket was issued for, and removes it. Null if unknown or expired. */
  consume(ticket: string): Promise<string | null>;
}

export class MemoryTicketStore implements TicketStore {
  private readonly tickets = new Map<string, { tenantId: string; expiresAt: number }>();

  async issue(ticket: string, tenantId: string, ttlSeconds: number): Promise<void> {
    this.prune();
    this.tickets.set(ticket, { tenantId, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async consume(ticket: string): Promise<string | null> {
    const entry = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.tenantId;
  }

  private prune(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.tickets) {
      if (entry.expiresAt <= now) this.tickets.delete(ticket);
    }
  }
}

const KEY_PREFIX = "stream-ticket:";

export class RedisTicketStore implements TicketStore {
  constructor(private readonly redis: Redis) {}

  async issue(ticket: string, tenantId: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(KEY_PREFIX + ticket, tenantId, "EX", ttlSeconds);
  }

  /** GETDEL is atomic: two instances racing on the same ticket cannot both succeed. */
  async consume(ticket: string): Promise<string | null> {
    return this.redis.getdel(KEY_PREFIX + ticket);
  }
}
