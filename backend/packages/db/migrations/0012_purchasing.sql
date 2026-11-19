-- 0012: Purchasing & 3-Way Matching (PRC-01 to PRC-04)
-- Tenant-owned tables protected by PostgreSQL row-level security.

-- Purchase Orders (PRC-01)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                      text PRIMARY KEY,
  tenant_id               uuid NOT NULL REFERENCES tenants (id),
  company_id              uuid NOT NULL REFERENCES companies (id),
  supplier_id             text NOT NULL,
  supplier_name           text NOT NULL,
  order_date              date NOT NULL,
  expected_delivery_date  date NOT NULL,
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_received', 'received', 'billed', 'closed', 'cancelled')),
  currency                text NOT NULL DEFAULT 'USD',
  total                   numeric(15, 2) NOT NULL DEFAULT 0.00,
  notes                   text,
  approved_by             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_tenant_company_idx ON purchase_orders (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS purchase_orders_order_date_idx ON purchase_orders (order_date);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_purchase_orders ON purchase_orders
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Purchase Order Line Items
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                text PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants (id),
  po_id             text NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  item_id           text NOT NULL,
  sku               text NOT NULL,
  description       text NOT NULL,
  quantity_ordered  numeric(12, 4) NOT NULL DEFAULT 1,
  quantity_received numeric(12, 4) NOT NULL DEFAULT 0,
  quantity_billed   numeric(12, 4) NOT NULL DEFAULT 0,
  unit_price        numeric(15, 2) NOT NULL DEFAULT 0.00,
  line_total        numeric(15, 2) NOT NULL DEFAULT 0.00,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS po_lines_po_id_idx ON purchase_order_lines (po_id);
CREATE INDEX IF NOT EXISTS po_lines_sku_idx ON purchase_order_lines (sku);

ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_purchase_order_lines ON purchase_order_lines
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Goods Receipt Notes (PRC-02)
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id              text PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  po_id           text NOT NULL REFERENCES purchase_orders (id),
  po_ref          text NOT NULL,
  supplier_id     text NOT NULL,
  supplier_name   text NOT NULL,
  receipt_date    date NOT NULL,
  received_by     text NOT NULL,
  status          text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'inspected', 'quarantined')),
  carrier         text,
  tracking_number text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grn_tenant_company_idx ON goods_receipt_notes (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS grn_po_id_idx ON goods_receipt_notes (po_id);
CREATE INDEX IF NOT EXISTS grn_supplier_id_idx ON goods_receipt_notes (supplier_id);
CREATE INDEX IF NOT EXISTS grn_status_idx ON goods_receipt_notes (status);

ALTER TABLE goods_receipt_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_goods_receipt_notes ON goods_receipt_notes
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Goods Receipt Line Items
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id                text PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants (id),
  grn_id            text NOT NULL REFERENCES goods_receipt_notes (id) ON DELETE CASCADE,
  po_line_id        text,
  sku               text NOT NULL,
  description       text NOT NULL,
  quantity_received numeric(12, 4) NOT NULL DEFAULT 1,
  quantity_rejected numeric(12, 4) NOT NULL DEFAULT 0,
  batch_lot_number  text,
  warehouse_id      text NOT NULL,
  warehouse_name    text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grn_lines_grn_id_idx ON goods_receipt_lines (grn_id);
CREATE INDEX IF NOT EXISTS grn_lines_sku_idx ON goods_receipt_lines (sku);

ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_goods_receipt_lines ON goods_receipt_lines
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 3-Way Matches (PRC-03 & PRC-04)
CREATE TABLE IF NOT EXISTS three_way_matches (
  id                text PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants (id),
  company_id        uuid NOT NULL REFERENCES companies (id),
  po_id             text NOT NULL,
  po_ref            text NOT NULL,
  grn_id            text NOT NULL,
  grn_ref           text NOT NULL,
  bill_id           text NOT NULL,
  bill_ref          text NOT NULL,
  supplier_name     text NOT NULL,
  sku               text NOT NULL,
  description       text NOT NULL,
  ordered_qty       numeric(12, 4) NOT NULL DEFAULT 0,
  received_qty      numeric(12, 4) NOT NULL DEFAULT 0,
  billed_qty        numeric(12, 4) NOT NULL DEFAULT 0,
  agreed_unit_price numeric(15, 2) NOT NULL DEFAULT 0.00,
  billed_unit_price numeric(15, 2) NOT NULL DEFAULT 0.00,
  po_total          numeric(15, 2) NOT NULL DEFAULT 0.00,
  bill_total        numeric(15, 2) NOT NULL DEFAULT 0.00,
  qty_variance      numeric(12, 4) NOT NULL DEFAULT 0,
  price_variance    numeric(15, 2) NOT NULL DEFAULT 0.00,
  status            text NOT NULL DEFAULT 'MATCHED' CHECK (status IN ('MATCHED', 'PRICE_VARIANCE', 'QUANTITY_VARIANCE', 'UNMATCHED_GRN', 'UNMATCHED_BILL')),
  tolerance_ok      boolean NOT NULL DEFAULT true,
  override_approved boolean NOT NULL DEFAULT false,
  override_note     text,
  override_by       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS three_way_matches_tenant_company_idx ON three_way_matches (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS three_way_matches_status_idx ON three_way_matches (status);
CREATE INDEX IF NOT EXISTS three_way_matches_po_id_idx ON three_way_matches (po_id);

ALTER TABLE three_way_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_three_way_matches ON three_way_matches
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
