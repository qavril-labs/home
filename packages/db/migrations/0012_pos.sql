-- 0012: point-of-sale sales (POS-01). A sale is stored once per company under the UUID its device gave it, so an
-- offline device that syncs the same sale twice does not post it twice. A sale is POSTED (numbered, stock taken,
-- in the ledger) or NEEDS_REVIEW (kept with its reasons, nothing posted). Stored sales are never changed.
-- Tenant-owned, so protected by row-level security keyed on app.tenant_id.

CREATE TABLE pos_sales (
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  id              uuid NOT NULL,
  status          text NOT NULL CHECK (status IN ('POSTED', 'NEEDS_REVIEW')),
  number          text NULL CHECK (number IS NULL OR char_length(number) BETWEEN 1 AND 60),
  warehouse       text NOT NULL CHECK (char_length(warehouse) BETWEEN 1 AND 60),
  sale_date       date NOT NULL,
  currency        char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  lines           jsonb NOT NULL,
  tenders         jsonb NOT NULL,
  subtotal_minor  bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor       bigint NOT NULL CHECK (tax_minor >= 0),
  total_minor     bigint NOT NULL CHECK (total_minor > 0),
  change_minor    bigint NOT NULL CHECK (change_minor >= 0),
  cost_minor      bigint NULL CHECK (cost_minor IS NULL OR cost_minor >= 0),
  entry_id        uuid NULL,
  reasons         jsonb NOT NULL,
  recorded_at     timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, company_id, id),
  UNIQUE (tenant_id, company_id, number),
  CHECK ((status = 'POSTED') = (number IS NOT NULL AND entry_id IS NOT NULL)),
  CHECK ((status = 'POSTED') = (jsonb_array_length(reasons) = 0))
);

CREATE INDEX pos_sales_status_idx ON pos_sales (tenant_id, company_id, status, recorded_at);

CREATE TRIGGER pos_sales_append_only
  BEFORE UPDATE OR DELETE ON pos_sales
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_mutation();

ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pos_sales
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
