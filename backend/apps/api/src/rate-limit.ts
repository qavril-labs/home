export interface RateLimitOptions {
  /** Requests allowed per key inside one window. */
  readonly max: number;
  readonly windowMs: number;
}

/**
 * Sliding-window limiter kept in process memory. Good enough for one API instance.
 * Run several instances behind a load balancer and this needs a shared store such as Redis.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly options: RateLimitOptions) {}

  allow(key: string, now: number): boolean {
    const allowed = !this.blocked(key, now);
    if (allowed) {
      this.hit(key, now);
    }
    return allowed;
  }

  /** True when the key has used up its allowance in the current window. Does not record anything. */
  blocked(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.options.max;
  }

  /** Records one accepted use of the key. Call this only once a request has succeeded. */
  hit(key: string, now: number): void {
    const recent = this.recent(key, now);
    recent.push(now);
    this.hits.set(key, recent);
  }

  private recent(key: string, now: number): number[] {
    const windowStart = now - this.options.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > windowStart);
    this.hits.set(key, recent);
    return recent;
  }
}
