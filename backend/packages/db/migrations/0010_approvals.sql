-- 0010: Approvals Inbox, Agent Governance & Audit Logs (PLT-07, AGT-01, AGT-06)
-- Tenant-owned tables protected by PostgreSQL row-level security.

-- Approvals Inbox (Agent Action Authorization)
CREATE TABLE approval_requests (
  id                text PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants (id),
  company_id        uuid NOT NULL REFERENCES companies (id),
  bot_id            text NOT NULL,
  bot_name          text NOT NULL,
  action_type       text NOT NULL,
  title             text NOT NULL,
  summary           text NOT NULL,
  amount            numeric(15, 2),
  currency          text NOT NULL DEFAULT 'USD',
  risk_level        text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'cancelled')),
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score  numeric(5, 2) NOT NULL DEFAULT 95.0,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  decided_at        timestamptz,
  decided_by        text,
  decision_reason   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX approval_requests_tenant_company_idx ON approval_requests (tenant_id, company_id);
CREATE INDEX approval_requests_status_idx ON approval_requests (status);
CREATE INDEX approval_requests_bot_id_idx ON approval_requests (bot_id);
CREATE INDEX approval_requests_requested_at_idx ON approval_requests (requested_at);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_approval_requests ON approval_requests
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Agent Audit Log & Cryptographic Ledger Trail (AGT-06, SEC-01)
CREATE TABLE agent_audit_logs (
  id              text PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  company_id      uuid NOT NULL REFERENCES companies (id),
  bot_id          text NOT NULL,
  event_type      text NOT NULL,
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       text NOT NULL,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_chain      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_audit_logs_tenant_company_idx ON agent_audit_logs (tenant_id, company_id);
CREATE INDEX agent_audit_logs_bot_id_idx ON agent_audit_logs (bot_id);
CREATE INDEX agent_audit_logs_created_at_idx ON agent_audit_logs (created_at);

ALTER TABLE agent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agent_audit_logs ON agent_audit_logs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
