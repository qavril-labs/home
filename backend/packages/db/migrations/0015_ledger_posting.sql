-- 0015: Invoices and bills post to the ledger through the outbox (SAL-04, FIN-03, FIN-01)
-- See docs/ledger-posting-design.md. Existing rows stay NOT_POSTED until a reviewed backfill.

-- Per item and per party accounts (decision 3). Unset falls back to the starter chart.
ALTER TABLE items   ADD COLUMN revenue_account    text CHECK (revenue_account IS NULL OR char_length(revenue_account) BETWEEN 1 AND 20);
ALTER TABLE items   ADD COLUMN expense_account    text CHECK (expense_account IS NULL OR char_length(expense_account) BETWEEN 1 AND 20);
ALTER TABLE parties ADD COLUMN receivable_account text CHECK (receivable_account IS NULL OR char_length(receivable_account) BETWEEN 1 AND 20);
ALTER TABLE parties ADD COLUMN payable_account    text CHECK (payable_account IS NULL OR char_length(payable_account) BETWEEN 1 AND 20);

-- Posting state of each document. PENDING means an event is queued; FAILED carries the reason and is
-- visible to the user, never silent.
ALTER TABLE invoices ADD COLUMN posting_status  text NOT NULL DEFAULT 'NOT_POSTED' CHECK (posting_status IN ('NOT_POSTED', 'PENDING', 'POSTED', 'FAILED'));
ALTER TABLE invoices ADD COLUMN ledger_entry_id text;
ALTER TABLE invoices ADD COLUMN posting_error   text;
ALTER TABLE invoices ADD COLUMN posting_version integer NOT NULL DEFAULT 0 CHECK (posting_version >= 0);
ALTER TABLE invoices ADD COLUMN posted_at       timestamptz;

ALTER TABLE bills ADD COLUMN posting_status  text NOT NULL DEFAULT 'NOT_POSTED' CHECK (posting_status IN ('NOT_POSTED', 'PENDING', 'POSTED', 'FAILED'));
ALTER TABLE bills ADD COLUMN ledger_entry_id text;
ALTER TABLE bills ADD COLUMN posting_error   text;
ALTER TABLE bills ADD COLUMN posting_version integer NOT NULL DEFAULT 0 CHECK (posting_version >= 0);
ALTER TABLE bills ADD COLUMN posted_at       timestamptz;

CREATE INDEX invoices_posting_status_idx ON invoices (tenant_id, posting_status) WHERE posting_status IN ('PENDING', 'FAILED');
CREATE INDEX bills_posting_status_idx    ON bills    (tenant_id, posting_status) WHERE posting_status IN ('PENDING', 'FAILED');
