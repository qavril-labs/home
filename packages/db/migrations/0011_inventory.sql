-- 0011: stock by batch with expiry (INV-01, INV-02, INV-03). Stock on hand is the sum of a batch's
-- movements; no balance is stored. Batches and movements cannot be changed or removed (INV-001), and a
-- batch can never go below zero (INV-003). The domain enforces both; these constraints are the backstop,
-- so a bug cannot write negative stock. Tenant-owned, so protected by row-level security keyed on app.tenant_id.

CREATE TABLE inventory_batches (
  tenant_id          uuid NOT NULL REFERENCES tenants (id),
  id                 uuid NOT NULL,
  company_id         uuid NOT NULL REFERENCES companies (id),
  warehouse          text NOT NULL CHECK (char_length(warehouse) BETWEEN 1 AND 60),
  item               text NOT NULL CHECK (char_length(item) BETWEEN 1 AND 60),
  batch_no           text NOT NULL CHECK (char_length(batch_no) BETWEEN 1 AND 60),
  expires_on         date NULL,
  received_on        date NOT NULL,
  received_qty       bigint NOT NULL CHECK (received_qty > 0),
  unit_cost_minor    bigint NOT NULL CHECK (unit_cost_minor >= 0),
  currency           char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  receipt_reference  text NOT NULL CHECK (char_length(receipt_reference) BETWEEN 1 AND 100),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, company_id, id),
  UNIQUE (tenant_id, company_id, receipt_reference),
  CHECK (expires_on IS NULL OR expires_on >= received_on)
);

CREATE TABLE inventory_movements (
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  id              uuid NOT NULL,
  company_id      uuid NOT NULL REFERENCES companies (id),
  batch_id        uuid NOT NULL,
  movement_type   text NOT NULL CHECK (movement_type IN ('RECEIPT', 'ISSUE', 'WRITE_OFF')),
  qty             bigint NOT NULL CHECK (qty <> 0),
  movement_date   date NOT NULL,
  reference       text NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 100),
  posted_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, company_id, batch_id) REFERENCES inventory_batches (tenant_id, company_id, id),
  CHECK ((movement_type = 'RECEIPT') = (qty > 0))
);

CREATE INDEX inventory_movements_reference_idx ON inventory_movements (tenant_id, company_id, reference, movement_type);
CREATE INDEX inventory_movements_batch_idx ON inventory_movements (tenant_id, batch_id);

CREATE FUNCTION reject_inventory_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'inventory is append-only; post a reversing movement instead';
END;
$$;

CREATE TRIGGER inventory_batches_append_only
  BEFORE UPDATE OR DELETE ON inventory_batches
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_mutation();

CREATE TRIGGER inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_mutation();

-- Checked at commit, after every movement of the transaction is in place, so a multi-row issue is judged as a whole.
CREATE FUNCTION inventory_batch_not_negative() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  remaining bigint;
BEGIN
  SELECT COALESCE(SUM(qty), 0) INTO remaining
    FROM inventory_movements
   WHERE tenant_id = NEW.tenant_id AND batch_id = NEW.batch_id;
  IF remaining < 0 THEN
    RAISE EXCEPTION 'batch % would go below zero (INV-003)', NEW.batch_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER inventory_batch_not_negative
  AFTER INSERT ON inventory_movements
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION inventory_batch_not_negative();

ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_batches
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_movements
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
