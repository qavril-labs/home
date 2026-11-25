-- 0005: consent is recorded with each lead, and demo slots and the visitor's time zone are structured.
-- Status lets the operator track a lead from new to booked. Existing rows get consent_given = false,
-- because they were stored before consent was recorded; they are not contacted until confirmed.

ALTER TABLE leads
  ADD COLUMN consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN consent_at    timestamptz,
  ADD COLUMN slot          text CHECK (slot IS NULL OR char_length(slot) <= 40),
  ADD COLUMN timezone      text CHECK (timezone IS NULL OR char_length(timezone) <= 64),
  ADD COLUMN status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  ADD COLUMN notified_at   timestamptz;

-- Used to spot a repeat submission (for example a retry after a timeout) without blocking a real second request later.
CREATE INDEX leads_email_interest_created_idx ON leads (lower(email), interest, created_at);
