-- 0002: public lead intake for the marketing site.
-- Leads are not tenant data, so there is no tenant_id and no row-level security.
-- Only the API inserts here. Production grants should be INSERT-only for the application role,
-- and reads should go through the operator's own tooling.

CREATE TABLE leads (
  id          uuid PRIMARY KEY,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email       text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  company     text,
  country     text,
  interest    text NOT NULL CHECK (interest IN ('early_access', 'demo', 'partner')),
  industry    text,
  message     text CHECK (char_length(message) <= 1000),
  source      text NOT NULL DEFAULT 'direct',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leads_email_idx ON leads (email);
