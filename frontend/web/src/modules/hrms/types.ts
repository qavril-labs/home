// HRMS Types (HRM-01 to HRM-19)
// MOCK: Shaped after docs/hrms-end-to-end-design.md until contracts/openapi.yaml publishes /v1/hrms/* paths.

export type HrDashboardKpis = {
  headcount: number;
  openRequisitions: number;
  timeToHireDays: number;
  offerAcceptanceRate: string;
  attritionRate: string;
  overdueProbationReviews: number;
  leaveAwaitingApproval: number;
  payRunsAwaitingApproval: number;
  fnfAwaitingPayment: number;
};

export interface Department {
  id: string;
  code: string;
  name: string;
  headEmployeeName: string;
  costCenter: string;
  activeHeadcount: number;
}

export type PositionStatus = "open" | "filled" | "frozen" | "closed";

export interface Position {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName: string;
  grade: string;
  status: PositionStatus;
  approvedHeadcount: number;
  filledHeadcount: number;
  reportsToPositionId: string | null;
}

export interface OrgTreeNode {
  employeeId: string;
  name: string;
  title: string;
  department: string;
  children: OrgTreeNode[];
}

export interface HeadcountPlanRow {
  id: string;
  departmentId: string;
  departmentName: string;
  period: string;
  planned: number;
  approved: number;
  filled: number;
}

export type RequisitionState =
  | "draft"
  | "submitted"
  | "approved"
  | "open"
  | "on_hold"
  | "filled"
  | "closed"
  | "rejected"
  | "cancelled";

export type RequisitionReason = "new" | "backfill" | "replacement" | "conversion";

export interface RequisitionApprovalStep {
  stepOrder: number;
  approverName: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  comment?: string;
}

export interface Requisition {
  id: string;
  requisitionNumber: string;
  positionId: string;
  positionTitle: string;
  departmentName: string;
  reason: RequisitionReason;
  leavingEmployeeName?: string;
  leavingSeparationDate?: string;
  targetStartDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  budgetedCost: string;
  state: RequisitionState;
  requesterId: string;
  requesterName: string;
  canApprove: boolean;
  approvalTrail: RequisitionApprovalStep[];
}

export type CandidateStage =
  | "applied"
  | "screened"
  | "shortlisted"
  | "interviewing"
  | "selected"
  | "offer_stage"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface RejectionReasonCode {
  code: string;
  label: string;
}

export interface ScorecardEntry {
  id: string;
  panelistId: string;
  panelistName: string;
  submitted: boolean;
  technicalScore?: number;
  communicationScore?: number;
  cultureScore?: number;
  recommendation?: "strong_hire" | "hire" | "no_hire";
  notes?: string;
}

export interface CandidateApplication {
  id: string;
  candidateName: string;
  email: string;
  phoneMasked: string;
  nationalIdMasked: string;
  requisitionNumber: string;
  positionTitle: string;
  stage: CandidateStage;
  appliedDate: string;
  duplicateFlag: boolean;
  duplicateReason?: string;
  stageHistory: { stage: CandidateStage; changedAt: string; by: string }[];
  scorecards: ScorecardEntry[];
  currentUserSubmittedScorecard: boolean;
}

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";

export interface OfferPayLine {
  label: string;
  amount: string;
}

export interface Offer {
  id: string;
  applicationId: string;
  candidateName: string;
  positionTitle: string;
  grade: string;
  payLines: OfferPayLine[];
  totalAnnualCtc: string;
  bandStatus: "within_band" | "outside_band";
  bandMessage: string;
  joiningDate: string;
  expiryDate: string;
  status: OfferStatus;
  isExpired: boolean;
}

export type EmployeeStatus =
  | "pre_boarding"
  | "active"
  | "on_leave"
  | "suspended"
  | "notice"
  | "separated"
  | "no_show";

export interface EmploymentHistoryItem {
  id: string;
  title: string;
  department: string;
  branch: string;
  valid_from: string;
  valid_to: string | null;
}

export interface EmployeeDocument {
  id: string;
  name: string;
  category: string;
  expiryDate: string | null;
  status: "valid" | "expiring_soon" | "expired";
}

export interface EmployeeBankAccount {
  id: string;
  bankName: string;
  accountNumberMasked: string;
  routingMasked: string;
  effectiveFrom: string;
  verified: boolean;
  requestedByCurrentUser: boolean;
  canVerify: boolean;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  department: string;
  branch: string;
  status: EmployeeStatus;
  nationalIdMasked: string;
  taxIdMasked: string;
  dobMasked: string;
  bankAccountMasked: string;
  joiningDate: string;
  employmentHistory: EmploymentHistoryItem[];
  documents: EmployeeDocument[];
  bankAccounts: EmployeeBankAccount[];
}

export type LifecycleEventType =
  | "probation_review"
  | "confirmation"
  | "transfer"
  | "promotion"
  | "status_change";

export interface LifecycleEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  eventType: LifecycleEventType;
  effectiveDate: string;
  reasonCode: string;
  status: "pending" | "approved" | "completed";
  dueInDays?: number;
  overdue?: boolean;
  approvals: { step: string; status: "pending" | "approved" }[];
}

export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "on_leave"
  | "holiday"
  | "weekly_off"
  | "exception";

export interface AttendanceDay {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: AttendanceStatus;
  workedMinutes: number;
  overtimeMinutes: number;
  locked: boolean;
  exceptionReason?: string;
}

export interface LeaveBalance {
  leaveType: string;
  balanceDays: string;
  usedDays: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  halfDayFrom: boolean;
  halfDayTo: boolean;
  daysRequested: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  attachmentName?: string;
}

export type PayRunState =
  | "draft"
  | "calculated"
  | "verified"
  | "approved"
  | "posted"
  | "paid"
  | "closed"
  | "cancelled";

export interface PayRunVerificationCheck {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  overridden: boolean;
  overrideReason?: string;
}

export interface PayRunEmployeeLine {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  earnings: string;
  deductions: string;
  netPay: string;
}

export interface PayRun {
  id: string;
  periodLabel: string;
  state: PayRunState;
  totalEarnings: string;
  totalDeductions: string;
  totalNet: string;
  preparerId: string;
  preparerName: string;
  canApprove: boolean;
  verificationChecks: PayRunVerificationCheck[];
  employeeLines: PayRunEmployeeLine[];
}

export interface Payslip {
  id: string;
  employeeId: string;
  periodLabel: string;
  payDate: string;
  grossPay: string;
  deductions: string;
  netPay: string;
  runState: "posted" | "paid";
}

export interface StatutoryFiling {
  id: string;
  filingName: string;
  authority: string;
  dueDate: string;
  status: "due" | "filed" | "late";
  reference?: string;
  packVersion: string;
  packEffectiveFrom: string;
}

export interface OnboardingTask {
  id: string;
  joinerName: string;
  taskTitle: string;
  ownerName: string;
  dueDate: string;
  status: "pending" | "completed" | "overdue";
}

export interface ComplianceExpiry {
  id: string;
  employeeName: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
  bucket: "expired" | "30_days" | "60_days" | "90_days";
  ownerName: string;
}

export type ExitCaseState =
  | "initiated"
  | "approved"
  | "notice"
  | "last_day"
  | "clearance"
  | "fnf_calculated"
  | "fnf_approved"
  | "fnf_paid"
  | "closed"
  | "cancelled";

export interface ClearanceItem {
  id: string;
  department: string;
  itemName: string;
  status: "pending" | "cleared" | "waived";
  waiverReason?: string;
}

export interface FnfLine {
  id: string;
  label: string;
  amount: string;
  source: string;
  calculationId: string;
}

export interface ExitCase {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  exitType: "resignation" | "termination" | "retirement";
  reasonCode: string;
  state: ExitCaseState;
  noticeShortfallDays: number;
  noticeBuyoutAmount: string;
  lastWorkingDay: string;
  accessRemovalDate: string;
  clearanceCompletedCount: number;
  clearanceTotalCount: number;
  clearanceItems: ClearanceItem[];
  fnfRuleVersion: string;
  fnfLines: FnfLine[];
  fnfNetPayable: string;
  fnfStatus: "READY" | "BLOCKED" | "PARTIAL";
  fnfMissingInputs: string[];
}

export interface LoanInstallment {
  installmentNumber: number;
  duePeriod: string;
  principal: string;
  interest: string;
  status: "pending" | "paid";
  roundingAbsorbed?: boolean;
}

export interface LoanRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  loanType: "salary_advance" | "personal_loan" | "emergency_loan";
  principal: string;
  outstandingBalance: string;
  state: "pending_approval" | "active" | "closed" | "rejected";
  overLimitApproverName?: string;
  installments: LoanInstallment[];
}
