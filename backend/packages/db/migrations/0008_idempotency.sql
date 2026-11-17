-- 0008: idempotency keys for money-moving requests. A client that retries a request with the same
-- Idempotency-Key gets the stored response instead of posting twice. The key is claimed in the same
-- transaction as the write, so a failed write also releases its key. Tenant-owned, with row-level security.

CREATE TABLE idempotency_keys (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  scope         text NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 80),
  key           text NOT NULL CHECK (char_length(key) BETWEEN 8 AND 128),
  request_hash  text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status_code   integer CHECK (status_code BETWEEN 200 AND 599),
  response      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scope, key)
);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
