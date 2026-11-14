import { Queue, Worker, type ConnectionOptions, type Job, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import type { DomainEvent, EventSink } from "@erp/events";

/**
 * Every BullMQ queue the platform uses. One name per kind of work, so workers can be scaled
 * per queue. Add a queue here before using it anywhere.
 */
export const QUEUES = {
  /** Domain events relayed from the transactional outbox (PLT-06). */
  events: "events",
  /** Email, SMS and WhatsApp sends (PLT-10). */
  notifications: "notifications",
  /** Bot runs: signals in, findings and drafts out (AGT-01). */
  bots: "bots",
  /** CSV and file imports (PLT-14). */
  imports: "imports",
  /** Report builds and exports (PLT-13). */
  reports: "reports",
  /** Repeating jobs such as nightly checks and scheduled reports (AUT-02). */
  scheduled: "scheduled",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Retries with backoff, and keeps finished jobs only long enough to inspect them. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/** BullMQ needs `maxRetriesPerRequest: null` on the connection used by workers. */
export function redisConnection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

/** The minimum a sink needs from a queue, so it can be tested without Redis. */
export interface JobQueue {
  add(name: string, data: unknown, options?: JobsOptions): Promise<unknown>;
}

/**
 * Sends outbox events to the `events` queue. The event id is the job id, so a retried relay
 * after a crash does not create a second job: BullMQ ignores a job id it already holds.
 */
export class QueueEventSink implements EventSink {
  constructor(private readonly queue: JobQueue) {}

  async dispatch(event: DomainEvent): Promise<void> {
    await this.queue.add(event.type, event, { ...DEFAULT_JOB_OPTIONS, jobId: event.id });
  }
}

export function createQueue(name: QueueName, connection: ConnectionOptions): Queue {
  return new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
}

/** Handlers must be idempotent: a job can run more than once after a crash or a retry. */
export function createWorker<T = unknown>(
  name: QueueName,
  connection: ConnectionOptions,
  handler: (job: Job<T>) => Promise<unknown>,
  concurrency = 5,
): Worker<T> {
  return new Worker<T>(name, handler, { connection, concurrency });
}
