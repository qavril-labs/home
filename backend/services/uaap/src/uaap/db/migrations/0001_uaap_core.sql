-- UAAP core schema (ADR-003: UAAP owns schema `uaap` and never writes ERP tables).
-- Run by the owner role through `python -m uaap.db.migrate`. The service connects as `uaap_app`,
-- which owns nothing and is subject to row-level security.

CREATE SCHEMA IF NOT EXISTS uaap;

-- Append-only audit trail (security spec section 5). Raw prompts, arguments and tokens are never stored.
CREATE TABLE uaap.audit_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            timestamptz NOT NULL,
  request_id    text NOT NULL,
  tenant_id     text,
  actor_id      text,
  action        text NOT NULL,
  outcome       text NOT NULL,
  model         text,
  prompt_hash   text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  error_code    text,
  agent_id      text,
  run_id        text,
  tool_name     text,
  tier          smallint,
  payload_hash  text,
  approval_id   text,
  latency_ms    integer
);
CREATE INDEX audit_events_tenant_at ON uaap.audit_events (tenant_id, at DESC);
CREATE INDEX audit_events_run ON uaap.audit_events (run_id) WHERE run_id IS NOT NULL;

CREATE FUNCTION uaap.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'uaap.audit_events is append-only';
END;
$$;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON uaap.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION uaap.reject_audit_mutation();

-- Approvals inbox history: who proposed what, who decided, and the outcome. No tokens.
CREATE TABLE uaap.approvals (
  tenant_id     text NOT NULL,
  approval_id   text NOT NULL,
  run_id        text NOT NULL,
  agent_id      text NOT NULL,
  initiator_id  text NOT NULL,
  action        text NOT NULL,
  summary       text NOT NULL,
  payload       jsonb NOT NULL,
  payload_hash  text NOT NULL,
  created_at    timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','FAILED','EXPIRED')),
  decided_by    text,
  decided_at    timestamptz,
  outcome       text,
  PRIMARY KEY (tenant_id, approval_id),
  CHECK (decided_by IS NULL OR decided_by <> initiator_id)
);
CREATE INDEX approvals_tenant_status ON uaap.approvals (tenant_id, status, created_at DESC);

-- Row-level security, same pattern as core 0001_foundation.sql (app.tenant_id set per transaction).
ALTER TABLE uaap.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE uaap.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON uaap.audit_events FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true));
-- System and admin events (no tenant) may be written but are never readable by a tenant.
CREATE POLICY audit_write ON uaap.audit_events FOR INSERT
  WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE uaap.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE uaap.approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY approvals_tenant ON uaap.approvals
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Least privilege for the service role: no DDL, no UPDATE/DELETE on audit.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uaap_app') THEN
    CREATE ROLE uaap_app NOLOGIN;
  END IF;
END;
$$;
GRANT USAGE ON SCHEMA uaap TO uaap_app;
GRANT INSERT ON uaap.audit_events TO uaap_app;
GRANT SELECT ON uaap.audit_events TO uaap_app;
GRANT SELECT, INSERT, UPDATE ON uaap.approvals TO uaap_app;
GRANT SELECT ON uaap.schema_migrations TO uaap_app;
