/** Idempotency keys, one per notification. Format: bot:{bot_type}:{tenant_id}:{entity_id}:{window_or_event_key}. */
export const keys = {
  deadline: (tenantId: string, taskId: string, threshold: string, dueIso: string) =>
    `bot:deadline:${tenantId}:${taskId}:${threshold}:${dueIso}`,
  blocker: (tenantId: string, incidentId: string, event: string) => `bot:blocker:${tenantId}:${incidentId}:${event}`,
  triage: (tenantId: string, taskId: string) => `bot:triage:${tenantId}:${taskId}:created`,
  standupPrompt: (tenantId: string, projectId: string, userId: string, date: string) =>
    `bot:standup_prompt:${tenantId}:${projectId}:${userId}:${date}`,
  standupDigest: (tenantId: string, projectId: string, date: string) =>
    `bot:standup_digest:${tenantId}:${projectId}:${date}`,
  weeklyReport: (tenantId: string, projectId: string, weekStartIso: string) =>
    `bot:weekly_report:${tenantId}:${projectId}:${weekStartIso}`,
};

/** Delivery log port. claim() is true exactly once per key; Postgres backs it with UNIQUE (tenant_id, idempotency_key). */
export interface DeliveryLog {
  claim(tenantId: string, key: string): boolean | Promise<boolean>;
}

export class InMemoryDeliveryLog implements DeliveryLog {
  private readonly seen = new Set<string>();
  claim(tenantId: string, key: string): boolean {
    const k = `${tenantId}|${key}`;
    if (this.seen.has(k)) return false;
    this.seen.add(k);
    return true;
  }
}

/** Retry schedule from the spec: 30s, 2m, 10m, 1h, then dead-letter after 4 failed attempts. */
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 3_600_000] as const;
export function nextRetryDelayMs(failedAttempts: number): number | "dead_letter" {
  return failedAttempts >= RETRY_DELAYS_MS.length ? "dead_letter" : RETRY_DELAYS_MS[failedAttempts]!;
}
