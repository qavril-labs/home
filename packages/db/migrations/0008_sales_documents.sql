-- 0008: credit notes (SAL-04), quotes (SAL-04) and the credited amount on invoices.
-- Tenant-owned, so each table is protected by row-level security keyed on app.tenant_id.

ALTER TABLE sales_invoices ADD COLUMN credited_minor bigint NOT NULL DEFAULT 0 CHECK (credited_minor >= 0);

CREATE TABLE sales_credit_notes (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  company_id    uuid NOT NULL REFERENCES companies (id),
  number        text NOT NULL CHECK (char_length(number) BETWEEN 1 AND 60),
  invoice       text NOT NULL,
  note_date     date NOT NULL,
  currency      char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  total_minor   bigint NOT NULL CHECK (total_minor > 0),
  tax_minor     bigint NOT NULL CHECK (tax_minor >= 0),
  entry_id      uuid NOT NULL,
  PRIMARY KEY (tenant_id, company_id, number)
);

CREATE TABLE sales_quotes (
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  company_id   uuid NOT NULL REFERENCES companies (id),
  number       text NOT NULL CHECK (char_length(number) BETWEEN 1 AND 60),
  customer_id  uuid NOT NULL,
  customer     text NOT NULL CHECK (char_length(customer) BETWEEN 1 AND 160),
  quote_date   date NOT NULL,
  currency     char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  lines        jsonb NOT NULL,
  total_minor  bigint NOT NULL CHECK (total_minor > 0),
  tax_minor    bigint NOT NULL CHECK (tax_minor >= 0),
  status       text NOT NULL CHECK (status IN ('OPEN', 'ACCEPTED', 'CANCELLED')),
  invoice      text,
  PRIMARY KEY (tenant_id, company_id, number)
);

ALTER TABLE sales_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_credit_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_credit_notes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE sales_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_quotes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
