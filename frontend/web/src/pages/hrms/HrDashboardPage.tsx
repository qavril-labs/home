import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import {
  mockComplianceExpiries,
  mockDashboardKpis,
  mockOnboardingTasks,
} from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type { ComplianceExpiry, OnboardingTask } from "../../modules/hrms/types";

export interface HrDashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const HrDashboardPage: React.FC<HrDashboardPageProps> = ({ onNavigate }) => {
  const kpis = mockDashboardKpis;
  const [tasks, setTasks] = useState<OnboardingTask[]>(mockOnboardingTasks);
  const [expiries] = useState<ComplianceExpiry[]>(mockComplianceExpiries);

  const taskCols: Column<OnboardingTask>[] = [
    { header: "Joiner", cell: (r) => <span className="font-bold">{r.joinerName}</span> },
    { header: "Task", cell: (r) => r.taskTitle },
    { header: "Owner", cell: (r) => r.ownerName },
    { header: "Due Date", cell: (r) => <span className="font-mono text-xs">{r.dueDate}</span> },
    {
      header: "Status",
      cell: (r) => {
        const mapped = mapHrmStatus(r.status);
        return <StatusChip status={mapped.status} label={mapped.label} />;
      },
    },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.status !== "completed" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setTasks((prev) =>
                prev.map((t) => (t.id === r.id ? { ...t, status: "completed" } : t))
              )
            }
          >
            Complete
          </Button>
        ) : null,
    },
  ];

  const expiryCols: Column<ComplianceExpiry>[] = [
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Document", cell: (r) => r.documentType },
    { header: "Expiry Date", cell: (r) => <span className="font-mono text-xs">{r.expiryDate}</span> },
    { header: "Owner", cell: (r) => r.ownerName },
    {
      header: "Window",
      cell: (r) => {
        const mapped = mapHrmStatus(r.bucket === "expired" ? "expired" : "expiring_soon");
        const label =
          r.bucket === "expired"
            ? `Expired (${r.ownerName})`
            : r.bucket.replace("_", " ");
        return <StatusChip status={mapped.status} label={label} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">HRMS Overview</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            People & Payroll Dashboard
          </h1>
        </div>
        <Button variant="lime" onClick={() => onNavigate("hrm-org")}>
          Open Org & Requisitions
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => onNavigate("hrm-employees")} className="cursor-pointer">
          <KpiTile label="Active Headcount" value={String(kpis.headcount)} variant="lime" />
        </div>
        <div onClick={() => onNavigate("hrm-org")} className="cursor-pointer">
          <KpiTile label="Open Requisitions" value={String(kpis.openRequisitions)} variant="yellow" />
        </div>
        <div onClick={() => onNavigate("hrm-recruitment")} className="cursor-pointer">
          <KpiTile label="Time to Hire (Days)" value={String(kpis.timeToHireDays)} variant="panel" />
        </div>
        <div onClick={() => onNavigate("hrm-recruitment")} className="cursor-pointer">
          <KpiTile label="Offer Acceptance" value={kpis.offerAcceptanceRate} variant="panel" />
        </div>
        <div onClick={() => onNavigate("hrm-employees")} className="cursor-pointer">
          <KpiTile label="Attrition Rate" value={kpis.attritionRate} variant="panel" />
        </div>
        <div onClick={() => onNavigate("hrm-employees")} className="cursor-pointer">
          <KpiTile label="Overdue Probation Reviews" value={String(kpis.overdueProbationReviews)} variant="yellow" />
        </div>
        <div onClick={() => onNavigate("hrm-attendance")} className="cursor-pointer">
          <KpiTile label="Leave Awaiting Approval" value={String(kpis.leaveAwaitingApproval)} variant="panel" />
        </div>
        <div onClick={() => onNavigate("hrm-payroll")} className="cursor-pointer">
          <KpiTile label="Pay Runs Awaiting Approval" value={String(kpis.payRunsAwaitingApproval)} variant="lime" />
        </div>
        <div onClick={() => onNavigate("hrm-separations")} className="cursor-pointer">
          <KpiTile label="F&F Awaiting Payment" value={String(kpis.fnfAwaitingPayment)} variant="panel" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <Card title="Onboarding Checklist (HRM-10)">
            <DataTable
              columns={taskCols}
              data={tasks}
             
              emptyTitle="No onboarding tasks"
              emptyDescription="New joiner tasks appear here."
            />
          </Card>
        </div>

        <div className="lg:col-span-6">
          <Card title="Compliance Expiries: 30 / 60 / 90 Days (HRM-14)">
            <DataTable
              columns={expiryCols}
              data={expiries}
             
              emptyTitle="No upcoming expiries"
              emptyDescription="Work permits, licences and certificates due within 90 days appear here."
            />
          </Card>
        </div>
      </div>
    </div>
  );
};
