-- 0013: Notifications (PLT-10), email slice
-- Tenant-owned, protected by row-level security. Rows are the delivery record: a message is
-- queued first, then sent by a worker, so a failed send can be retried without losing it.

CREATE TABLE IF NOT EXISTS notifications (
  id                   text PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES tenants (id),
  channel              text NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  template_key         text NOT NULL,
  to_address           text NOT NULL,
  subject              text NOT NULL,
  body_text            text NOT NULL,
  body_html            text,
  status               text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts             integer NOT NULL DEFAULT 0,
  provider_message_id  text,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_tenant_status_idx ON notifications (tenant_id, status, created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notifications ON notifications
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
