import { DomainError, newId, type Clock } from "@erp/kernel";
import type { RenderedEmail } from "./templates";

export type NotificationStatus = "queued" | "sent" | "failed";

export interface NotificationRecord {
  id: string;
  tenantId: string;
  channel: "email";
  templateKey: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  status: NotificationStatus;
  attempts: number;
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface NewNotification {
  id: string;
  templateKey: string;
  toAddress: string;
  email: RenderedEmail;
}

/** Storage the delivery logic needs. The Postgres adapter lives in @erp/db. */
export interface NotificationStore {
  insert(tenantId: string, input: NewNotification): Promise<NotificationRecord>;
  find(tenantId: string, id: string): Promise<NotificationRecord | null>;
  markSent(tenantId: string, id: string, providerMessageId: string, at: Date): Promise<NotificationRecord>;
  markFailed(tenantId: string, id: string, error: string): Promise<NotificationRecord>;
}

export interface EmailProvider {
  send(message: { to: string; email: RenderedEmail }): Promise<{ messageId: string }>;
}

const ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export function assertEmailAddress(address: string): void {
  if (address.length > 254 || !ADDRESS.test(address)) {
    throw new DomainError("VALIDATION", "Invalid email address");
  }
}

export interface QueueEmailInput {
  tenantId: string;
  templateKey: string;
  to: string;
  email: RenderedEmail;
}

/** Records the message as queued. Nothing is sent until deliver() runs, so a worker can retry. */
export async function queueEmail(store: NotificationStore, input: QueueEmailInput): Promise<NotificationRecord> {
  assertEmailAddress(input.to);
  return store.insert(input.tenantId, {
    id: newId(),
    templateKey: input.templateKey,
    toAddress: input.to,
    email: input.email,
  });
}

/**
 * Sends one queued message. A sent message is never sent twice: a second call returns it as is.
 * A provider failure is recorded on the row and returned as 'failed', so the worker can retry.
 */
export async function deliver(
  store: NotificationStore,
  provider: EmailProvider,
  tenantId: string,
  id: string,
  clock: Clock = { now: () => new Date() },
): Promise<NotificationRecord> {
  const record = await store.find(tenantId, id);
  if (!record) {
    throw new DomainError("NOT_FOUND", `Notification not found: ${id}`);
  }
  if (record.status === "sent") {
    return record;
  }
  try {
    const { messageId } = await provider.send({
      to: record.toAddress,
      email: {
        subject: record.subject,
        text: record.bodyText,
        ...(record.bodyHtml === null ? {} : { html: record.bodyHtml }),
      },
    });
    return await store.markSent(tenantId, id, messageId, clock.now());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return store.markFailed(tenantId, id, message.slice(0, 500));
  }
}
