-- 0016: Follow-up drafts for marketing leads (B8 Lead Nurturing).
-- Leads are platform data with no tenant. A draft is written by a person or bot in the platform
-- workspace, so the draft belongs to that workspace's tenant and is isolated by row-level security.
-- A draft is only text to review; nothing here sends a message (sending needs PLT-10).

CREATE TABLE lead_followup_drafts (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  lead_id     uuid NOT NULL REFERENCES leads (id),
  subject     text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_followup_drafts_lead_idx ON lead_followup_drafts (tenant_id, lead_id, created_at DESC);

ALTER TABLE lead_followup_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_lead_followup_drafts ON lead_followup_drafts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
