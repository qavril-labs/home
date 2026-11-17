-- 0013: stock counts (INV-09), transfers between warehouses (INV-02), and CSV receipt import (INV-01).
-- Movements gain three types: TRANSFER_OUT and TRANSFER_IN move stock between warehouses, and ADJUSTMENT
-- records a stock count's difference (positive or negative). The movement rules are restated here, so the
-- database still refuses a movement whose type and sign disagree.
-- Counts are working documents, so they are updated while open. Each one is still tenant-owned and protected
-- by row-level security.

-- Drop every check constraint on inventory_movements. Their names are generated, so they are found by catalogue
-- rather than by name. The primary key, foreign keys and not-null constraints are not checks, so they stay.
DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'inventory_movements'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE inventory_movements DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END;
$$;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_type_check
    CHECK (movement_type IN ('RECEIPT', 'ISSUE', 'WRITE_OFF', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT')),
  ADD CONSTRAINT inventory_movements_sign_check
    CHECK (
      (movement_type IN ('RECEIPT', 'TRANSFER_IN') AND qty > 0)
      OR (movement_type IN ('ISSUE', 'WRITE_OFF', 'TRANSFER_OUT') AND qty < 0)
      OR movement_type = 'ADJUSTMENT'
    ),
  ADD CONSTRAINT inventory_movements_qty_check CHECK (qty <> 0);

CREATE TABLE inventory_counts (
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  id            uuid NOT NULL,
  company_id    uuid NOT NULL REFERENCES companies (id),
  warehouse     text NOT NULL CHECK (char_length(warehouse) BETWEEN 1 AND 60),
  count_date    date NOT NULL,
  status        text NOT NULL CHECK (status IN ('OPEN', 'SUBMITTED', 'APPLIED', 'CANCELLED')),
  lines         jsonb NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, company_id, id)
);

CREATE INDEX inventory_counts_company_idx ON inventory_counts (tenant_id, company_id, warehouse, status);

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_counts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
