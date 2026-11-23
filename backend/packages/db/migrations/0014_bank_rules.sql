-- 0014: Bank reconciliation rules (FIN-04)
-- Tenant-defined rules that decide when a bank line is suggested against an open invoice or bill.
-- Rules only suggest; confirming a match stays a separate step.

CREATE TABLE bank_rules (
  id                     uuid PRIMARY KEY,
  tenant_id              uuid NOT NULL REFERENCES tenants (id),
  name                   text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  priority               integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 10000),
  active                 boolean NOT NULL DEFAULT true,
  direction              text NOT NULL DEFAULT 'ANY' CHECK (direction IN ('IN', 'OUT', 'ANY')),
  description_contains   text CHECK (description_contains IS NULL OR char_length(description_contains) BETWEEN 1 AND 120),
  amount_min             numeric(15, 2) CHECK (amount_min IS NULL OR amount_min >= 0),
  amount_max             numeric(15, 2) CHECK (amount_max IS NULL OR amount_max >= 0),
  match_on               text NOT NULL DEFAULT 'amount' CHECK (match_on IN ('amount', 'reference', 'amount_and_reference')),
  amount_tolerance       numeric(15, 2) NOT NULL DEFAULT 0 CHECK (amount_tolerance >= 0),
  confidence             integer NOT NULL DEFAULT 90 CHECK (confidence BETWEEN 1 AND 100),
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name),
  CHECK (amount_min IS NULL OR amount_max IS NULL OR amount_min <= amount_max)
);

CREATE INDEX bank_rules_tenant_priority_idx ON bank_rules (tenant_id, priority, id);

ALTER TABLE bank_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_bank_rules ON bank_rules
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Which rule produced a suggestion. Kept as text so deleting a rule never rewrites history.
ALTER TABLE bank_lines ADD COLUMN rule_id text;
ALTER TABLE bank_lines ADD COLUMN rule_name text;
