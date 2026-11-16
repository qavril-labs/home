-- 0006: sales invoices (SAL-04). Invoices are stored in the same transaction as their ledger entry
-- and document number, so a rollback leaves no posted entry and no gap in the numbering.
-- Tenant-owned, so protected by row-level security keyed on app.tenant_id.

CREATE TABLE sales_invoices (
  tenant_id      uuid NOT NULL REFERENCES tenants (id),
  company_id     uuid NOT NULL REFERENCES companies (id),
  number         text NOT NULL CHECK (char_length(number) BETWEEN 1 AND 60),
  customer       text NOT NULL CHECK (char_length(customer) BETWEEN 1 AND 160),
  invoice_date   date NOT NULL,
  currency       char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  total_minor    bigint NOT NULL CHECK (total_minor > 0),
  tax_minor      bigint NOT NULL CHECK (tax_minor >= 0),
  settled_minor  bigint NOT NULL DEFAULT 0 CHECK (settled_minor >= 0),
  status         text NOT NULL CHECK (status IN ('OPEN', 'PAID', 'VOID')),
  entry_id       uuid NOT NULL,
  payments       integer NOT NULL DEFAULT 0 CHECK (payments >= 0),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id, number)
);

ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_invoices
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
