-- 0004: free-trial requests are stored as leads with interest 'trial'.
ALTER TABLE leads DROP CONSTRAINT leads_interest_check;
ALTER TABLE leads ADD CONSTRAINT leads_interest_check
  CHECK (interest IN ('early_access', 'demo', 'partner', 'trial'));
