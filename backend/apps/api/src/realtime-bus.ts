import type { Redis } from "ioredis";

/** A live tenant event as sent to subscribers. */
export interface RealtimeMessage {
  readonly type: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly payload: unknown;
}

/**
 * Carries live events between API instances. Each instance publishes what its own writes produced and
 * delivers what the others publish to its own connected clients.
 */
export interface RealtimeBus {
  publish(tenantId: string, message: RealtimeMessage): void;
  /** Registers the handler that receives messages from this bus, including this instance's own. */
  onMessage(handler: (tenantId: string, message: RealtimeMessage) => void): void;
}

const CHANNEL = "erp:realtime";

export class RedisRealtimeBus implements RealtimeBus {
  private readonly handlers: Array<(tenantId: string, message: RealtimeMessage) => void> = [];

  /** `publisher` and `subscriber` must be separate connections: a subscribed connection cannot publish. */
  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
  ) {
    subscriber.subscribe(CHANNEL).catch(() => undefined);
    subscriber.on("message", (channel: string, raw: string) => {
      if (channel !== CHANNEL) return;
      let parsed: { tenantId: string; message: RealtimeMessage };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      for (const handler of this.handlers) handler(parsed.tenantId, parsed.message);
    });
  }

  publish(tenantId: string, message: RealtimeMessage): void {
    this.publisher.publish(CHANNEL, JSON.stringify({ tenantId, message })).catch(() => undefined);
  }

  onMessage(handler: (tenantId: string, message: RealtimeMessage) => void): void {
    this.handlers.push(handler);
  }
}
