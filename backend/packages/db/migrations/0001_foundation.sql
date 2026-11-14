-- 0001: platform foundation.
-- Tenants, companies, branches, entitlements, identity, numbering, outbox, audit.
-- Tenant-owned tables are protected by row-level security keyed on app.tenant_id.

CREATE TABLE tenants (
  id          uuid PRIMARY KEY,
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  region      text NOT NULL,
  status      text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE companies (
  id                       uuid PRIMARY KEY,
  tenant_id                uuid NOT NULL REFERENCES tenants (id),
  legal_name               text NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 200),
  country_code             char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  base_currency            char(3) NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  fiscal_year_start_month  smallint NOT NULL CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  company_id  uuid NOT NULL REFERENCES companies (id),
  code        text NOT NULL CHECK (code ~ '^[A-Z0-9]{1,10}$'),
  name        text NOT NULL,
  timezone    text NOT NULL,
  UNIQUE (company_id, code)
);

CREATE TABLE tenant_products (
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  product_id  text NOT NULL,
  PRIMARY KEY (tenant_id, product_id)
);

CREATE TABLE users (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES tenants (id),
  email          text NOT NULL,
  password_hash  text NOT NULL,
  roles          text[] NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- Sessions are looked up by token hash after the tenant is known, so the tenant is
-- part of the token and RLS applies here too.
CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  user_id     uuid NOT NULL REFERENCES users (id),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per (tenant, sequence, scope, period). The row lock taken by the increment
-- is held until the transaction ends, which keeps numbers gap-free.
CREATE TABLE number_counters (
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  counter_key  text NOT NULL,
  next_value   bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, counter_key)
);

-- System-level: read by the dispatcher across tenants, so no RLS here.
CREATE TABLE outbox_events (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  occurred_at   timestamptz NOT NULL,
  attempts      integer NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  delivered_at  timestamptz,
  failed_at     timestamptz,
  last_error    text
);

CREATE INDEX outbox_events_pending_idx
  ON outbox_events (occurred_at)
  WHERE delivered_at IS NULL AND failed_at IS NULL;

CREATE TABLE processed_events (
  consumer      text NOT NULL,
  event_id      uuid NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  actor_id     uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  changes      jsonb NOT NULL,
  request_id   text,
  occurred_at  timestamptz NOT NULL
);

CREATE INDEX audit_log_entity_idx ON audit_log (tenant_id, entity_type, entity_id, occurred_at);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- Row-level security. FORCE makes the policy apply to the table owner as well.
-- Without a tenant set, current_setting() yields no value and the policy matches nothing.

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON companies
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON branches
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE tenant_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_products
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE number_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON number_counters
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
