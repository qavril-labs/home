import { DomainError, type Clock } from "@erp/kernel";
import {
  deliver,
  queueEmail,
  type EmailProvider,
  type NotificationRecord,
  type NotificationStore,
  type QueueEmailInput,
} from "./deliver";

/** Job name on the `notifications` queue. The payload carries ids only, never message content. */
export const EMAIL_SEND_JOB = "email.send";

export interface EmailSendJob {
  tenantId: string;
  notificationId: string;
}

/** The minimum of a BullMQ queue this needs, so it can be tested without Redis. */
export interface EmailJobQueue {
  add(name: string, data: EmailSendJob, options: { jobId: string }): Promise<unknown>;
}

/**
 * Stores the message as queued, then adds the send job. The notification id is the job id, so a
 * repeat add after a crash does not create a second job. If adding the job fails, the row stays
 * queued and can be picked up again by requeueing it.
 */
export async function enqueueEmail(
  store: NotificationStore,
  queue: EmailJobQueue,
  input: QueueEmailInput,
): Promise<NotificationRecord> {
  const record = await queueEmail(store, input);
  await queue.add(EMAIL_SEND_JOB, { tenantId: record.tenantId, notificationId: record.id }, { jobId: record.id });
  return record;
}

/**
 * The handler for an `email.send` job. It throws when the send failed so the queue retries with
 * backoff; the failure is already recorded on the row. A sent message is not sent again.
 */
export function createEmailSendHandler(
  store: NotificationStore,
  provider: EmailProvider,
  clock?: Clock,
): (job: { data: EmailSendJob }) => Promise<NotificationRecord> {
  return async (job) => {
    const { tenantId, notificationId } = job.data;
    if (!tenantId || !notificationId) {
      throw new DomainError("VALIDATION", "email.send job needs tenantId and notificationId");
    }
    const record = await deliver(store, provider, tenantId, notificationId, clock);
    if (record.status === "failed") {
      throw new Error(`email ${notificationId} failed (attempt ${record.attempts}): ${record.error ?? "unknown error"}`);
    }
    return record;
  };
}
