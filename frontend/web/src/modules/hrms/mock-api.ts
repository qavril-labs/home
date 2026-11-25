// MOCK: HRMS API client and stateful in-memory store.
// Shaped after docs/hrms-end-to-end-design.md until contracts/openapi.yaml publishes /v1/hrms/* paths.

import type {
  AttendanceDay,
  CandidateApplication,
  ComplianceExpiry,
  Department,
  Employee,
  ExitCase,
  HeadcountPlanRow,
  HrDashboardKpis,
  LeaveBalance,
  LeaveRequest,
  LifecycleEvent,
  LoanRecord,
  Offer,
  OnboardingTask,
  OrgTreeNode,
  PayRun,
  Payslip,
  Position,
  RejectionReasonCode,
  Requisition,
  StatutoryFiling,
} from "./types";

export const mockDashboardKpis: HrDashboardKpis = {
  headcount: 142,
  openRequisitions: 6,
  timeToHireDays: 24,
  offerAcceptanceRate: "88.0%",
  attritionRate: "4.2%",
  overdueProbationReviews: 2,
  leaveAwaitingApproval: 4,
  payRunsAwaitingApproval: 1,
  fnfAwaitingPayment: 1,
};

export const mockDepartments: Department[] = [
  { id: "dept-eng", code: "ENG", name: "Engineering", headEmployeeName: "Maya Lin", costCenter: "CC-100", activeHeadcount: 58 },
  { id: "dept-ops", code: "OPS", name: "Operations", headEmployeeName: "Devon Brooks", costCenter: "CC-200", activeHeadcount: 42 },
  { id: "dept-fin", code: "FIN", name: "Finance", headEmployeeName: "Elena Vance", costCenter: "CC-300", activeHeadcount: 18 },
  { id: "dept-hr", code: "HR", name: "People & HR", headEmployeeName: "Nadia Patel", costCenter: "CC-400", activeHeadcount: 10 },
];

export const mockPositions: Position[] = [
  { id: "pos-1", code: "ENG-SR-01", title: "Senior Backend Engineer", departmentId: "dept-eng", departmentName: "Engineering", grade: "L5", status: "open", approvedHeadcount: 5, filledHeadcount: 3, reportsToPositionId: "pos-0" },
  { id: "pos-2", code: "OPS-LD-02", title: "Warehouse Shift Lead", departmentId: "dept-ops", departmentName: "Operations", grade: "L4", status: "filled", approvedHeadcount: 4, filledHeadcount: 4, reportsToPositionId: "pos-0" },
  { id: "pos-3", code: "FIN-AN-01", title: "Payroll Analyst", departmentId: "dept-fin", departmentName: "Finance", grade: "L3", status: "frozen", approvedHeadcount: 2, filledHeadcount: 1, reportsToPositionId: "pos-0" },
  { id: "pos-4", code: "HR-BP-01", title: "HR Business Partner", departmentId: "dept-hr", departmentName: "People & HR", grade: "L4", status: "closed", approvedHeadcount: 1, filledHeadcount: 1, reportsToPositionId: "pos-0" },
];

export const mockOrgTree: OrgTreeNode = {
  employeeId: "emp-001",
  name: "Marcus Sterling",
  title: "Chief Executive Officer",
  department: "Executive",
  children: [
    {
      employeeId: "emp-002",
      name: "Maya Lin",
      title: "VP of Engineering",
      department: "Engineering",
      children: [
        { employeeId: "emp-005", name: "Tariq Al-Mansoor", title: "Senior Backend Engineer", department: "Engineering", children: [] },
        { employeeId: "emp-006", name: "Chloe Kim", title: "Frontend Lead", department: "Engineering", children: [] },
      ],
    },
    {
      employeeId: "emp-003",
      name: "Devon Brooks",
      title: "Director of Operations",
      department: "Operations",
      children: [
        { employeeId: "emp-007", name: "Samir Rao", title: "Warehouse Shift Lead", department: "Operations", children: [] },
      ],
    },
    {
      employeeId: "emp-004",
      name: "Elena Vance",
      title: "VP of Finance",
      department: "Finance",
      children: [],
    },
  ],
};

export const mockHeadcountPlan: HeadcountPlanRow[] = [
  { id: "hc-1", departmentId: "dept-eng", departmentName: "Engineering", period: "2026-Q4", planned: 62, approved: 60, filled: 58 },
  { id: "hc-2", departmentId: "dept-ops", departmentName: "Operations", period: "2026-Q4", planned: 45, approved: 44, filled: 42 },
  { id: "hc-3", departmentId: "dept-fin", departmentName: "Finance", period: "2026-Q4", planned: 20, approved: 19, filled: 18 },
  { id: "hc-4", departmentId: "dept-hr", departmentName: "People & HR", period: "2026-Q4", planned: 10, approved: 10, filled: 10 },
];

export const mockRequisitions: Requisition[] = [
  {
    id: "req-101",
    requisitionNumber: "REQ-2026-0101",
    positionId: "pos-1",
    positionTitle: "Senior Backend Engineer",
    departmentName: "Engineering",
    reason: "new",
    targetStartDate: "2026-12-15",
    priority: "high",
    budgetedCost: "145000.00",
    state: "submitted",
    requesterId: "user-other",
    requesterName: "Maya Lin",
    canApprove: true,
    approvalTrail: [
      { stepOrder: 1, approverName: "Elena Vance", role: "Finance", status: "pending" },
      { stepOrder: 2, approverName: "Nadia Patel", role: "HR", status: "pending" },
    ],
  },
  {
    id: "req-102",
    requisitionNumber: "REQ-2026-0102",
    positionId: "pos-2",
    positionTitle: "Warehouse Shift Lead",
    departmentName: "Operations",
    reason: "backfill",
    leavingEmployeeName: "Jordan Lee",
    leavingSeparationDate: "2026-11-30",
    targetStartDate: "2026-12-01",
    priority: "urgent",
    budgetedCost: "78000.00",
    state: "submitted",
    requesterId: "user-current",
    requesterName: "Current User",
    canApprove: false,
    approvalTrail: [
      { stepOrder: 1, approverName: "Devon Brooks", role: "Department Head", status: "pending" },
    ],
  },
  {
    id: "req-103",
    requisitionNumber: "REQ-2026-0103",
    positionId: "pos-3",
    positionTitle: "Payroll Analyst",
    departmentName: "Finance",
    reason: "replacement",
    targetStartDate: "2027-01-10",
    priority: "medium",
    budgetedCost: "82000.00",
    state: "open",
    requesterId: "user-other",
    requesterName: "Elena Vance",
    canApprove: false,
    approvalTrail: [
      { stepOrder: 1, approverName: "Nadia Patel", role: "HR", status: "approved", decidedAt: "2026-11-10" },
    ],
  },
];

export const mockRejectionReasons: RejectionReasonCode[] = [
  { code: "SKILL_GAP", label: "Technical skills below bar" },
  { code: "COMP_MISMATCH", label: "Compensation expectations outside band" },
  { code: "ROLE_FILLED", label: "Position filled by another candidate" },
  { code: "WITHDREW", label: "Candidate withdrew application" },
];

export const mockApplications: CandidateApplication[] = [
  {
    id: "app-1",
    candidateName: "Amina Yusuf",
    email: "amina.y@example.com",
    phoneMasked: "+1 (***) ***-4821",
    nationalIdMasked: "***-**-8812",
    requisitionNumber: "REQ-2026-0101",
    positionTitle: "Senior Backend Engineer",
    stage: "interviewing",
    appliedDate: "2026-11-04",
    duplicateFlag: true,
    duplicateReason: "Matches email/phone of previous applicant #APP-2025-091",
    stageHistory: [
      { stage: "applied", changedAt: "2026-11-04", by: "Portal" },
      { stage: "screened", changedAt: "2026-11-06", by: "Nadia Patel" },
      { stage: "interviewing", changedAt: "2026-11-12", by: "Maya Lin" },
    ],
    currentUserSubmittedScorecard: false,
    scorecards: [
      {
        id: "sc-1",
        panelistId: "user-other",
        panelistName: "Maya Lin",
        submitted: true,
        technicalScore: 5,
        communicationScore: 4,
        cultureScore: 5,
        recommendation: "strong_hire",
        notes: "Strong distributed systems background.",
      },
      {
        id: "sc-2",
        panelistId: "user-current",
        panelistName: "You",
        submitted: false,
      },
    ],
  },
  {
    id: "app-2",
    candidateName: "Liam O'Connor",
    email: "liam.oc@example.com",
    phoneMasked: "+1 (***) ***-1190",
    nationalIdMasked: "***-**-3304",
    requisitionNumber: "REQ-2026-0101",
    positionTitle: "Senior Backend Engineer",
    stage: "offer_stage",
    appliedDate: "2026-10-28",
    duplicateFlag: false,
    stageHistory: [
      { stage: "applied", changedAt: "2026-10-28", by: "Portal" },
      { stage: "selected", changedAt: "2026-11-14", by: "Maya Lin" },
      { stage: "offer_stage", changedAt: "2026-11-15", by: "Nadia Patel" },
    ],
    currentUserSubmittedScorecard: true,
    scorecards: [
      {
        id: "sc-3",
        panelistId: "user-other",
        panelistName: "Maya Lin",
        submitted: true,
        technicalScore: 4,
        communicationScore: 5,
        cultureScore: 4,
        recommendation: "hire",
        notes: "Great team fit.",
      },
    ],
  },
  {
    id: "app-3",
    candidateName: "Priya Nair",
    email: "priya.n@example.com",
    phoneMasked: "+1 (***) ***-7743",
    nationalIdMasked: "***-**-5520",
    requisitionNumber: "REQ-2026-0103",
    positionTitle: "Payroll Analyst",
    stage: "shortlisted",
    appliedDate: "2026-11-16",
    duplicateFlag: false,
    stageHistory: [
      { stage: "applied", changedAt: "2026-11-16", by: "Portal" },
      { stage: "shortlisted", changedAt: "2026-11-18", by: "Elena Vance" },
    ],
    currentUserSubmittedScorecard: false,
    scorecards: [],
  },
];

export const mockOffers: Offer[] = [
  {
    id: "off-1",
    applicationId: "app-2",
    candidateName: "Liam O'Connor",
    positionTitle: "Senior Backend Engineer",
    grade: "L5",
    payLines: [
      { label: "Base Salary", amount: "130000.00" },
      { label: "Target Bonus", amount: "15000.00" },
    ],
    totalAnnualCtc: "145000.00",
    bandStatus: "within_band",
    bandMessage: "Within band",
    joiningDate: "2026-12-15",
    expiryDate: "2026-12-01",
    status: "sent",
    isExpired: false,
  },
  {
    id: "off-2",
    applicationId: "app-1",
    candidateName: "Amina Yusuf",
    positionTitle: "Senior Backend Engineer",
    grade: "L5",
    payLines: [
      { label: "Base Salary", amount: "155000.00" },
      { label: "Target Bonus", amount: "20000.00" },
    ],
    totalAnnualCtc: "175000.00",
    bandStatus: "outside_band",
    bandMessage: "Outside band, needs HR and finance",
    joiningDate: "2026-12-20",
    expiryDate: "2026-11-10",
    status: "expired",
    isExpired: true,
  },
];

export const mockEmployees: Employee[] = [
  {
    id: "emp-005",
    code: "EMP-005",
    name: "Tariq Al-Mansoor",
    department: "Engineering",
    branch: "HQ - New York",
    status: "active",
    nationalIdMasked: "***-**-4419",
    taxIdMasked: "**-***9912",
    dobMasked: "****-**-14",
    bankAccountMasked: "****6789",
    joiningDate: "2024-03-01",
    employmentHistory: [
      { id: "eh-1", title: "Backend Engineer", department: "Engineering", branch: "HQ - New York", valid_from: "2024-03-01", valid_to: "2025-06-30" },
      { id: "eh-2", title: "Senior Backend Engineer", department: "Engineering", branch: "HQ - New York", valid_from: "2025-07-01", valid_to: null },
    ],
    documents: [
      { id: "doc-1", name: "Work Permit", category: "Compliance", expiryDate: "2026-12-15", status: "expiring_soon" },
      { id: "doc-2", name: "Signed NDA", category: "Legal", expiryDate: null, status: "valid" },
    ],
    bankAccounts: [
      {
        id: "ba-1",
        bankName: "Mercury Business",
        accountNumberMasked: "****6789",
        routingMasked: "****0021",
        effectiveFrom: "2024-03-01",
        verified: true,
        requestedByCurrentUser: false,
        canVerify: false,
      },
      {
        id: "ba-2",
        bankName: "Chase Checking",
        accountNumberMasked: "****4321",
        routingMasked: "****1104",
        effectiveFrom: "2026-12-01",
        verified: false,
        requestedByCurrentUser: false,
        canVerify: true,
      },
    ],
  },
  {
    id: "emp-007",
    code: "EMP-007",
    name: "Samir Rao",
    department: "Operations",
    branch: "West Warehouse",
    status: "notice",
    nationalIdMasked: "***-**-7721",
    taxIdMasked: "**-***3301",
    dobMasked: "****-**-09",
    bankAccountMasked: "****1122",
    joiningDate: "2023-08-15",
    employmentHistory: [
      { id: "eh-3", title: "Warehouse Shift Lead", department: "Operations", branch: "West Warehouse", valid_from: "2023-08-15", valid_to: null },
    ],
    documents: [
      { id: "doc-3", name: "Forklift Safety License", category: "Safety", expiryDate: "2026-11-01", status: "expired" },
    ],
    bankAccounts: [
      {
        id: "ba-3",
        bankName: "Bank of America",
        accountNumberMasked: "****1122",
        routingMasked: "****0098",
        effectiveFrom: "2023-08-15",
        verified: true,
        requestedByCurrentUser: true,
        canVerify: false,
      },
    ],
  },
  {
    id: "emp-008",
    code: "EMP-008",
    name: "Elena Rostova",
    department: "Finance",
    branch: "HQ - New York",
    status: "pre_boarding",
    nationalIdMasked: "***-**-9011",
    taxIdMasked: "**-***5502",
    dobMasked: "****-**-22",
    bankAccountMasked: "****9988",
    joiningDate: "2026-12-01",
    employmentHistory: [
      { id: "eh-4", title: "Payroll Analyst", department: "Finance", branch: "HQ - New York", valid_from: "2026-12-01", valid_to: null },
    ],
    documents: [],
    bankAccounts: [],
  },
];

export const mockLifecycleEvents: LifecycleEvent[] = [
  {
    id: "le-1",
    employeeId: "emp-008",
    employeeName: "Elena Rostova",
    eventType: "probation_review",
    effectiveDate: "2026-11-28",
    reasonCode: "PROBATION_90D",
    status: "pending",
    dueInDays: 4,
    overdue: false,
    approvals: [{ step: "Manager Review", status: "pending" }],
  },
  {
    id: "le-2",
    employeeId: "emp-005",
    employeeName: "Tariq Al-Mansoor",
    eventType: "probation_review",
    effectiveDate: "2026-11-18",
    reasonCode: "PROBATION_ANNUAL",
    status: "pending",
    dueInDays: -6,
    overdue: true,
    approvals: [{ step: "HR Review", status: "pending" }],
  },
];

export const mockAttendanceDays: AttendanceDay[] = [
  { id: "att-1", employeeId: "emp-005", employeeName: "Tariq Al-Mansoor", date: "2026-11-20", status: "present", workedMinutes: 485, overtimeMinutes: 5, locked: true },
  { id: "att-2", employeeId: "emp-005", employeeName: "Tariq Al-Mansoor", date: "2026-11-21", status: "exception", workedMinutes: 210, overtimeMinutes: 0, locked: false, exceptionReason: "Missing clock-out punch" },
  { id: "att-3", employeeId: "emp-007", employeeName: "Samir Rao", date: "2026-11-21", status: "on_leave", workedMinutes: 0, overtimeMinutes: 0, locked: false },
];

export const mockLeaveBalances: LeaveBalance[] = [
  { leaveType: "Annual Leave", balanceDays: "12.5", usedDays: "5.5" },
  { leaveType: "Sick Leave", balanceDays: "4.0", usedDays: "2.0" },
  { leaveType: "Personal Leave", balanceDays: "1.5", usedDays: "0.5" },
];

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: "lr-1",
    employeeId: "emp-005",
    employeeName: "Tariq Al-Mansoor",
    leaveType: "Annual Leave",
    fromDate: "2026-12-22",
    toDate: "2026-12-24",
    halfDayFrom: false,
    halfDayTo: true,
    daysRequested: "2.5",
    reason: "Family travel",
    status: "pending",
  },
];

export const mockPayRuns: PayRun[] = [
  {
    id: "pr-nov-2026",
    periodLabel: "November 2026",
    state: "verified",
    totalEarnings: "62400.00",
    totalDeductions: "14150.00",
    totalNet: "48250.00",
    preparerId: "user-other",
    preparerName: "Elena Vance",
    canApprove: true,
    verificationChecks: [
      { id: "chk-1", name: "All attendance periods locked", passed: true, message: "All 142 employees locked", overridden: false },
      { id: "chk-2", name: "Bank account verification", passed: false, message: "1 employee has unverified bank account", overridden: false },
    ],
    employeeLines: [
      { employeeId: "emp-005", employeeCode: "EMP-005", employeeName: "Tariq Al-Mansoor", earnings: "12000.00", deductions: "2800.00", netPay: "9200.00" },
      { employeeId: "emp-007", employeeCode: "EMP-007", employeeName: "Samir Rao", earnings: "6500.00", deductions: "1450.00", netPay: "5050.00" },
    ],
  },
  {
    id: "pr-oct-2026",
    periodLabel: "October 2026",
    state: "posted",
    totalEarnings: "61000.00",
    totalDeductions: "13800.00",
    totalNet: "47200.00",
    preparerId: "user-current",
    preparerName: "Current User",
    canApprove: false,
    verificationChecks: [
      { id: "chk-3", name: "All attendance periods locked", passed: true, message: "Passed", overridden: false },
    ],
    employeeLines: [
      { employeeId: "emp-005", employeeCode: "EMP-005", employeeName: "Tariq Al-Mansoor", earnings: "12000.00", deductions: "2800.00", netPay: "9200.00" },
    ],
  },
];

export const mockPayslips: Payslip[] = [
  { id: "ps-1", employeeId: "emp-005", periodLabel: "October 2026", payDate: "2026-10-31", grossPay: "12000.00", deductions: "2800.00", netPay: "9200.00", runState: "posted" },
  { id: "ps-2", employeeId: "emp-005", periodLabel: "September 2026", payDate: "2026-09-30", grossPay: "12000.00", deductions: "2800.00", netPay: "9200.00", runState: "paid" },
];

export const mockStatutoryFilings: StatutoryFiling[] = [
  { id: "sf-1", filingName: "Federal Withholding (941)", authority: "IRS", dueDate: "2026-11-30", status: "due", packVersion: "US-FED-2026.4", packEffectiveFrom: "2026-10-01" },
  { id: "sf-2", filingName: "State Unemployment (SUTA)", authority: "NY DOL", dueDate: "2026-10-31", status: "filed", reference: "NY-SUTA-99812", packVersion: "US-NY-2026.3", packEffectiveFrom: "2026-07-01" },
];

export const mockOnboardingTasks: OnboardingTask[] = [
  { id: "ob-1", joinerName: "Elena Rostova", taskTitle: "Laptop & badge provisioning", ownerName: "IT Desk", dueDate: "2026-11-20", status: "overdue" },
  { id: "ob-2", joinerName: "Elena Rostova", taskTitle: "I-9 & Tax form collection", ownerName: "Nadia Patel", dueDate: "2026-11-29", status: "pending" },
];

export const mockComplianceExpiries: ComplianceExpiry[] = [
  { id: "ce-1", employeeName: "Samir Rao", documentType: "Forklift Safety License", expiryDate: "2026-11-01", daysRemaining: -23, bucket: "expired", ownerName: "Devon Brooks" },
  { id: "ce-2", employeeName: "Tariq Al-Mansoor", documentType: "Work Permit", expiryDate: "2026-12-15", daysRemaining: 21, bucket: "30_days", ownerName: "Nadia Patel" },
];

export const mockExitCases: ExitCase[] = [
  {
    id: "exit-1",
    employeeId: "emp-007",
    employeeName: "Samir Rao",
    employeeInitials: "S.R.",
    exitType: "resignation",
    reasonCode: "BETTER_OPPORTUNITY",
    state: "clearance",
    noticeShortfallDays: 5,
    noticeBuyoutAmount: "1250.00",
    lastWorkingDay: "2026-11-30",
    accessRemovalDate: "2026-11-30",
    clearanceCompletedCount: 1,
    clearanceTotalCount: 2,
    clearanceItems: [
      { id: "cl-1", department: "IT", itemName: "Return warehouse tablet & badge", status: "cleared" },
      { id: "cl-2", department: "Finance", itemName: "Settle petty cash advance", status: "pending" },
    ],
    fnfRuleVersion: "FNF-2026.2",
    fnfLines: [
      { id: "fl-1", label: "November Prorated Salary", amount: "5200.00", source: "Payroll Engine", calculationId: "CALC-8812" },
      { id: "fl-2", label: "Notice Period Buyout", amount: "-1250.00", source: "Exit Policy", calculationId: "CALC-8813" },
    ],
    fnfNetPayable: "3950.00",
    fnfStatus: "BLOCKED",
    fnfMissingInputs: ["Finance clearance: Settle petty cash advance"],
  },
];

export const mockLoans: LoanRecord[] = [
  {
    id: "ln-1",
    employeeId: "emp-005",
    employeeName: "Tariq Al-Mansoor",
    loanType: "personal_loan",
    principal: "3000.00",
    outstandingBalance: "1000.00",
    state: "active",
    installments: [
      { installmentNumber: 1, duePeriod: "2026-10", principal: "1000.00", interest: "0.00", status: "paid" },
      { installmentNumber: 2, duePeriod: "2026-11", principal: "1000.00", interest: "0.00", status: "paid" },
      { installmentNumber: 3, duePeriod: "2026-12", principal: "1000.00", interest: "0.00", status: "pending", roundingAbsorbed: true },
    ],
  },
];
