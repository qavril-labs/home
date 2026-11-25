-- HRMS Module (HRM-01 to HRM-19)
CREATE TABLE IF NOT EXISTS hrm_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  cost_center TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id UUID REFERENCES hrm_departments(id),
  grade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  approved_headcount INT NOT NULL DEFAULT 1,
  filled_headcount INT NOT NULL DEFAULT 0,
  reports_to_position_id UUID
);

CREATE TABLE IF NOT EXISTS hrm_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  requisition_number TEXT NOT NULL,
  position_id UUID REFERENCES hrm_positions(id),
  reason TEXT NOT NULL,
  leaving_separation_date DATE,
  target_start_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  budgeted_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'submitted',
  requester_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  department_id UUID REFERENCES hrm_departments(id),
  branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  national_id_masked TEXT,
  tax_id_masked TEXT,
  dob_masked TEXT,
  joining_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_pii_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES hrm_employees(id),
  actor_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES hrm_employees(id),
  leave_type TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_requested NUMERIC(5,1) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_pay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period_label TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  total_earnings NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net NUMERIC(14,2) NOT NULL DEFAULT 0,
  preparer_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_exit_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES hrm_employees(id),
  exit_type TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'initiated',
  last_working_day DATE NOT NULL,
  fnf_net_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
  fnf_status TEXT NOT NULL DEFAULT 'BLOCKED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hrm_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES hrm_employees(id),
  loan_type TEXT NOT NULL,
  principal NUMERIC(14,2) NOT NULL,
  outstanding_balance NUMERIC(14,2) NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
