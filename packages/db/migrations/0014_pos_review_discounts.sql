-- 0014: bill-level discounts (DISC-001 to DISC-004) and review of sales that needed it. A sale keeps its bill
-- discount, the reason for it and the approver who signed it off. A decision on a sale that needed review is
-- stored beside the sale, in its own append-only table, so the sale row itself is never changed.
-- Tenant-owned, so both tables are protected by row-level security keyed on app.tenant_id.

ALTER TABLE pos_sales
  ADD COLUMN bill_discount_minor       bigint NOT NULL DEFAULT 0 CHECK (bill_discount_minor >= 0),
  ADD COLUMN bill_discount_reason      text NULL CHECK (bill_discount_reason IS NULL OR char_length(bill_discount_reason) BETWEEN 1 AND 500),
  ADD COLUMN bill_discount_approved_by text NULL CHECK (bill_discount_approved_by IS NULL OR char_length(bill_discount_approved_by) BETWEEN 1 AND 100);

CREATE TABLE pos_sale_decisions (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  company_id    uuid NOT NULL REFERENCES companies (id),
  sale_id       uuid NOT NULL,
  decision      text NOT NULL CHECK (decision IN ('POSTED', 'VOIDED')),
  decided_by    text NOT NULL CHECK (char_length(decided_by) BETWEEN 1 AND 100),
  decided_at    timestamptz NOT NULL,
  reason        text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  posted_on     date NULL,
  number        text NULL CHECK (number IS NULL OR char_length(number) BETWEEN 1 AND 60),
  entry_id      uuid NULL,
  cost_minor    bigint NULL CHECK (cost_minor IS NULL OR cost_minor >= 0),
  change_minor  bigint NOT NULL DEFAULT 0 CHECK (change_minor >= 0),
  tenders       jsonb NOT NULL,
  PRIMARY KEY (tenant_id, company_id, sale_id),
  UNIQUE (tenant_id, company_id, number),
  FOREIGN KEY (tenant_id, company_id, sale_id) REFERENCES pos_sales (tenant_id, company_id, id),
  CHECK ((decision = 'POSTED') = (number IS NOT NULL AND entry_id IS NOT NULL AND posted_on IS NOT NULL)),
  CHECK (decision = 'POSTED' OR (number IS NULL AND entry_id IS NULL AND posted_on IS NULL))
);

CREATE TRIGGER pos_sale_decisions_append_only
  BEFORE UPDATE OR DELETE ON pos_sale_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_mutation();

ALTER TABLE pos_sale_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pos_sale_decisions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
