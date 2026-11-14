-- 0003: general ledger (FIN-01) and exchange rates.
-- Tenant-owned tables use row-level security. Posted entries are append-only: a correction is
-- a reversal entry, never an edit.

CREATE TABLE fx_rates (
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  base            char(3) NOT NULL CHECK (base ~ '^[A-Z]{3}$'),
  quote           char(3) NOT NULL CHECK (quote ~ '^[A-Z]{3}$'),
  effective_date  date NOT NULL,
  rate            bigint NOT NULL CHECK (rate > 0),
  PRIMARY KEY (tenant_id, base, quote, effective_date)
);

CREATE TABLE ledger_accounts (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  company_id    uuid NOT NULL REFERENCES companies (id),
  code          text NOT NULL CHECK (code ~ '^[0-9A-Za-z.-]{1,20}$'),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  account_type  text NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  active        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, company_id, code)
);

CREATE TABLE ledger_periods (
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  company_id  uuid NOT NULL REFERENCES companies (id),
  period_id   text NOT NULL CHECK (period_id ~ '^[0-9]{4}-[0-9]{2}$'),
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      text NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  PRIMARY KEY (tenant_id, company_id, period_id)
);

CREATE TABLE ledger_entries (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  company_id    uuid NOT NULL REFERENCES companies (id),
  reference     text NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 100),
  entry_date    date NOT NULL,
  period_id     text NOT NULL,
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  base_currency char(3) NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  memo          text,
  reversal_of   uuid REFERENCES ledger_entries (id),
  lines         jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  posted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, reference)
);

CREATE INDEX ledger_entries_company_date_idx ON ledger_entries (company_id, entry_date);

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger entries are append-only; post a reversal instead';
END;
$$;

CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fx_rates
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ledger_accounts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE ledger_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ledger_periods
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ledger_entries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
