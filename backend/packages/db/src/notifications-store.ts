import type { NewNotification, NotificationRecord, NotificationStore } from "@erp/notifications";
import type { Pool } from "./pool";
import { withTenantTransaction } from "./transactions";

interface Row {
  id: string;
  tenant_id: string;
  channel: "email";
  template_key: string;
  to_address: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  status: NotificationRecord["status"];
  attempts: number;
  provider_message_id: string | null;
  error: string | null;
  created_at: Date;
  sent_at: Date | null;
}

const COLUMNS =
  "id, tenant_id, channel, template_key, to_address, subject, body_text, body_html, status, attempts, provider_message_id, error, created_at, sent_at";

function toRecord(row: Row): NotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channel: row.channel,
    templateKey: row.template_key,
    toAddress: row.to_address,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    status: row.status,
    attempts: row.attempts,
    providerMessageId: row.provider_message_id,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
  };
}

/** Postgres adapter for @erp/notifications. Every call runs in a tenant transaction (row-level security). */
export class PgNotificationStore implements NotificationStore {
  constructor(private readonly pool: Pool) {}

  insert(tenantId: string, input: NewNotification): Promise<NotificationRecord> {
    return withTenantTransaction(this.pool, tenantId, async (tx) => {
      const { rows } = await tx.query<Row>(
        `INSERT INTO notifications (id, tenant_id, template_key, to_address, subject, body_text, body_html)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [input.id, tenantId, input.templateKey, input.toAddress, input.email.subject, input.email.text, input.email.html ?? null],
      );
      return toRecord(rows[0]!);
    });
  }

  find(tenantId: string, id: string): Promise<NotificationRecord | null> {
    return withTenantTransaction(this.pool, tenantId, async (tx) => {
      const { rows } = await tx.query<Row>(`SELECT ${COLUMNS} FROM notifications WHERE id = $1`, [id]);
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  markSent(tenantId: string, id: string, providerMessageId: string, at: Date): Promise<NotificationRecord> {
    return withTenantTransaction(this.pool, tenantId, async (tx) => {
      const { rows } = await tx.query<Row>(
        `UPDATE notifications
            SET status = 'sent', attempts = attempts + 1, provider_message_id = $2, sent_at = $3, error = NULL
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, providerMessageId, at],
      );
      return toRecord(rows[0]!);
    });
  }

  markFailed(tenantId: string, id: string, error: string): Promise<NotificationRecord> {
    return withTenantTransaction(this.pool, tenantId, async (tx) => {
      const { rows } = await tx.query<Row>(
        `UPDATE notifications SET status = 'failed', attempts = attempts + 1, error = $2
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, error],
      );
      return toRecord(rows[0]!);
    });
  }
}
