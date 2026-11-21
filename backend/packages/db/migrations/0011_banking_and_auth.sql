-- 0011: Bank Feeds, Reconciliation & Password Reset (FIN-04, PLT-01)
-- Tenant-isolated tables protected by PostgreSQL Row-Level Security.

-- Password Reset Tokens (PLT-01)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash  text PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  user_id     text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_tenant_idx ON password_reset_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_password_reset_tokens ON password_reset_tokens
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Bank Feed Lines & Reconciliation Engine (FIN-04)
CREATE TABLE IF NOT EXISTS bank_lines (
  id            text PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  company_id    uuid NOT NULL REFERENCES companies (id),
  posted_date   date NOT NULL,
  reference     text NOT NULL,
  description   text NOT NULL,
  amount        numeric(15, 2) NOT NULL,
  direction     text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  status        text NOT NULL DEFAULT 'Unmatched' CHECK (status IN ('Unmatched', 'Suggested', 'Reconciled')),
  matched_ref   text,
  matched_label text,
  confidence    numeric(5, 2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_lines_tenant_company_idx ON bank_lines (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS bank_lines_status_idx ON bank_lines (status);
CREATE INDEX IF NOT EXISTS bank_lines_posted_date_idx ON bank_lines (posted_date);

ALTER TABLE bank_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_bank_lines ON bank_lines
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
