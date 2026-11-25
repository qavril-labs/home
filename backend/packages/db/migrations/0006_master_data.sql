-- 0006: Master data - Customers & Suppliers (MDM-01) and Items & Catalog (MDM-02)
-- Tenant-owned tables protected by PostgreSQL row-level security.

CREATE TABLE parties (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  company_id  uuid NOT NULL REFERENCES companies (id),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  party_type  text NOT NULL CHECK (party_type IN ('customer', 'supplier', 'both')),
  email       text,
  phone       text,
  tax_id      text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hold', 'archived', 'inactive')),
  balance     numeric(15, 2) NOT NULL DEFAULT 0.00,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX parties_tenant_company_idx ON parties (tenant_id, company_id);
CREATE INDEX parties_name_idx ON parties (name);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_parties ON parties
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE TABLE items (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  sku             text NOT NULL CHECK (char_length(sku) BETWEEN 1 AND 64),
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  item_type       text NOT NULL DEFAULT 'goods' CHECK (item_type IN ('goods', 'service', 'bundle')),
  category        text,
  unit            text NOT NULL DEFAULT 'pcs',
  unit_price      numeric(15, 2) NOT NULL DEFAULT 0.00,
  stock_quantity  integer NOT NULL DEFAULT 0,
  reorder_point   integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, sku)
);

CREATE INDEX items_tenant_company_idx ON items (tenant_id, company_id);
CREATE INDEX items_sku_idx ON items (sku);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_items ON items
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
