-- 0007: master data (MDM-01 party master, MDM-02 item master) and the link from invoices to a customer.
-- Tenant-owned, so each table is protected by row-level security keyed on app.tenant_id.

CREATE TABLE parties (
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  company_id  uuid NOT NULL REFERENCES companies (id),
  id          uuid NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('CUSTOMER', 'SUPPLIER', 'BOTH')),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  tax_id      text CHECK (tax_id IS NULL OR char_length(tax_id) BETWEEN 1 AND 40),
  email       text CHECK (email IS NULL OR char_length(email) <= 254),
  currency    char(3) CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  active      boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, company_id, tax_id)
);

CREATE TABLE items (
  tenant_id        uuid NOT NULL REFERENCES tenants (id),
  company_id       uuid NOT NULL REFERENCES companies (id),
  code             text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 40),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  unit             text NOT NULL CHECK (unit ~ '^[A-Z]{1,10}$'),
  revenue_account  text CHECK (revenue_account IS NULL OR char_length(revenue_account) BETWEEN 1 AND 20),
  active           boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, company_id, code)
);

ALTER TABLE sales_invoices ADD COLUMN customer_id uuid;

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON parties
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON items
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
