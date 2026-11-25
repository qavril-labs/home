-- 0007: Invoicing, Receivables & Payables (SAL-04, FIN-02, FIN-03, FIN-14)
-- Tenant-owned tables protected by PostgreSQL row-level security.

-- Invoices (Accounts Receivable)
CREATE TABLE invoices (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  party_id        uuid NOT NULL REFERENCES parties (id),
  invoice_number  text NOT NULL CHECK (char_length(invoice_number) BETWEEN 1 AND 64),
  issue_date      date NOT NULL,
  due_date        date NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  subtotal        numeric(15, 2) NOT NULL DEFAULT 0.00,
  tax_total       numeric(15, 2) NOT NULL DEFAULT 0.00,
  total           numeric(15, 2) NOT NULL DEFAULT 0.00,
  amount_paid     numeric(15, 2) NOT NULL DEFAULT 0.00,
  balance_due     numeric(15, 2) NOT NULL DEFAULT 0.00,
  payment_terms   text,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, invoice_number)
);

CREATE INDEX invoices_tenant_company_idx ON invoices (tenant_id, company_id);
CREATE INDEX invoices_party_id_idx ON invoices (party_id);
CREATE INDEX invoices_status_idx ON invoices (status);
CREATE INDEX invoices_due_date_idx ON invoices (due_date);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoices ON invoices
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Invoice Line Items
CREATE TABLE invoice_lines (
  id              uuid PRIMARY KEY,
  invoice_id      uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  item_id         uuid REFERENCES items (id),
  sku             text NOT NULL CHECK (char_length(sku) BETWEEN 1 AND 64),
  description     text NOT NULL,
  quantity        numeric(15, 4) NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'ea',
  unit_price      numeric(15, 2) NOT NULL DEFAULT 0.00,
  tax_rate        numeric(5, 4) NOT NULL DEFAULT 0.0000,
  tax_code        text,
  line_total      numeric(15, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX invoice_lines_invoice_id_idx ON invoice_lines (invoice_id);

-- Vendor Bills (Accounts Payable)
CREATE TABLE bills (
  id                     uuid PRIMARY KEY,
  tenant_id              uuid NOT NULL REFERENCES tenants (id),
  company_id             uuid NOT NULL REFERENCES companies (id),
  supplier_id            uuid NOT NULL REFERENCES parties (id),
  bill_number            text NOT NULL CHECK (char_length(bill_number) BETWEEN 1 AND 64),
  vendor_invoice_number  text,
  issue_date             date NOT NULL,
  due_date               date NOT NULL,
  currency               text NOT NULL DEFAULT 'USD',
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid', 'overdue', 'disputed')),
  subtotal               numeric(15, 2) NOT NULL DEFAULT 0.00,
  tax_total              numeric(15, 2) NOT NULL DEFAULT 0.00,
  total                  numeric(15, 2) NOT NULL DEFAULT 0.00,
  amount_paid            numeric(15, 2) NOT NULL DEFAULT 0.00,
  balance_due            numeric(15, 2) NOT NULL DEFAULT 0.00,
  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, bill_number)
);

CREATE INDEX bills_tenant_company_idx ON bills (tenant_id, company_id);
CREATE INDEX bills_supplier_id_idx ON bills (supplier_id);
CREATE INDEX bills_status_idx ON bills (status);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_bills ON bills
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Bill Line Items
CREATE TABLE bill_lines (
  id              uuid PRIMARY KEY,
  bill_id         uuid NOT NULL REFERENCES bills (id) ON DELETE CASCADE,
  item_id         uuid REFERENCES items (id),
  sku             text NOT NULL CHECK (char_length(sku) BETWEEN 1 AND 64),
  description     text NOT NULL,
  quantity        numeric(15, 4) NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'ea',
  unit_cost       numeric(15, 2) NOT NULL DEFAULT 0.00,
  account_code    text,
  line_total      numeric(15, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX bill_lines_bill_id_idx ON bill_lines (bill_id);

-- Payment Reminders (Chase Chloe FIN-14 audit records)
CREATE TABLE payment_reminders (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  invoice_id      uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient       text NOT NULL,
  recipient_name  text NOT NULL,
  subject         text,
  message         text NOT NULL,
  tone            text NOT NULL CHECK (tone IN ('friendly', 'firm', 'urgent')),
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'approved', 'sent')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_reminders_tenant_company_idx ON payment_reminders (tenant_id, company_id);
CREATE INDEX payment_reminders_invoice_id_idx ON payment_reminders (invoice_id);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_payment_reminders ON payment_reminders
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
