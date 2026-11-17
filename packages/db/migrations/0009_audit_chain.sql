-- 0009: tamper-evident audit chain. Each entry stores its position in the tenant's chain, the hash of the
-- entry before it, and its own hash. Entries written before this migration have no sequence and are not chained.
-- The table stays append-only: the existing trigger still rejects every UPDATE and DELETE.

ALTER TABLE audit_log
  ADD COLUMN sequence  bigint,
  ADD COLUMN prev_hash text CHECK (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN hash      text CHECK (hash IS NULL OR hash ~ '^[0-9a-f]{64}$');

-- One chain per tenant: no two entries can claim the same position.
CREATE UNIQUE INDEX audit_log_chain_idx ON audit_log (tenant_id, sequence);
