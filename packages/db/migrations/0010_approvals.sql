-- 0010: the approval queue (PLT-07). Tenant-owned, so row-level security applies. Requests are kept after
-- they are decided; the decision fields are written once, by the queue, never edited by hand.

CREATE TABLE approval_requests (
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  id              uuid NOT NULL,
  kind            text NOT NULL CHECK (kind ~ '^[A-Z][A-Z_]{1,39}$'),
  reason          text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  payload         jsonb NOT NULL,
  requested_by    uuid NOT NULL,
  status          text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  requested_at    timestamptz NOT NULL,
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  PRIMARY KEY (tenant_id, id),
  CHECK ((status = 'PENDING') = (decided_at IS NULL))
);

CREATE INDEX approval_requests_status_idx ON approval_requests (tenant_id, company_id, status, requested_at);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON approval_requests
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
