import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  mockAttendanceDays,
  mockEmployees,
  mockLeaveBalances,
  mockPayslips,
} from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type { AttendanceDay, Payslip } from "../../modules/hrms/types";

export interface SelfServicePageProps {
  onNavigate?: (tab: string) => void;
}

export const SelfServicePage: React.FC<SelfServicePageProps> = () => {
  const { showToast } = useToast();
  const me = mockEmployees[0]!;
  const myPayslips = mockPayslips.filter((p) => p.employeeId === me.id);
  const myAttendance = mockAttendanceDays.filter((a) => a.employeeId === me.id);
  const myBalances = mockLeaveBalances;

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankNumber, setBankNumber] = useState("");
  const [profileNote, setProfileNote] = useState("");

  const payslipCols: Column<Payslip>[] = [
    { header: "Period", cell: (r) => <span className="font-bold">{r.periodLabel}</span> },
    { header: "Pay Date", cell: (r) => <span className="font-mono text-xs">{r.payDate}</span> },
    { header: "Net Pay", align: "right", cell: (r) => <span className="font-mono font-bold">{formatMoney(r.netPay)}</span> },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.runState);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
  ];

  const attCols: Column<AttendanceDay>[] = [
    { header: "Date", cell: (r) => <span className="font-mono text-xs">{r.date}</span> },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.status);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
    { header: "Worked (min)", align: "right", cell: (r) => <span className="font-mono">{r.workedMinutes}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">HRM-07</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            My Self-Service
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setIsProfileModalOpen(true)}>
            Request profile change
          </Button>
          <Button variant="lime" onClick={() => setIsBankModalOpen(true)}>
            Request bank change
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Annual Leave" value={`${myBalances[0]?.balanceDays ?? "0.0"} d`} variant="lime" />
        <KpiTile label="Sick Leave" value={`${myBalances[1]?.balanceDays ?? "0.0"} d`} variant="panel" />
        <KpiTile label="Latest Net Pay" value={formatMoney(myPayslips[0]?.netPay ?? "0.00")} variant="yellow" />
        <KpiTile label="Documents" value={String(me.documents.length)} variant="panel" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <Card title="My Payslips (Posted Only)">
            <DataTable columns={payslipCols} data={myPayslips} />
          </Card>
        </div>
        <div className="lg:col-span-6">
          <Card title="My Attendance">
            <DataTable columns={attCols} data={myAttendance} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <Card title="My Documents">
            <div className="space-y-2">
              {me.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 bg-page border-2 border-border text-xs">
                  <span className="font-bold">{d.name}</span>
                  <StatusChip status={mapHrmStatus(d.status).status} label={mapHrmStatus(d.status).label} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="lg:col-span-6">
          <Card title="Expense Claims & Exit Tasks">
            <div className="space-y-3 text-sm">
              <p className="text-text-muted">
                Submit and track your expense reimbursements in Finance.
              </p>
              <a
                href="#/payables"
                className="inline-block font-bold underline"
              >
                Open Expense Claims →
              </a>
              {me.status === "notice" && (
                <div className="p-3 bg-cream border-2 border-border text-xs">
                  <strong>Exit Tasks:</strong> Complete your clearance checklist before your last working day.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Request profile change"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showToast("Profile change request submitted", "success");
            setProfileNote("");
            setIsProfileModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Details</label>
            <textarea
              value={profileNote}
              onChange={(e) => setProfileNote(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
              placeholder="Address or emergency contact update..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsProfileModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime">
              Submit request
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title="Request bank change"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showToast("Bank change sent for verification", "success");
            setBankNumber("");
            setIsBankModalOpen(false);
          }}
          className="space-y-4"
        >
          <p className="text-xs text-text-muted">
            New bank accounts are sent to Finance/HR for verification before payroll use.
          </p>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Account Number</label>
            <input
              type="text"
              value={bankNumber}
              onChange={(e) => setBankNumber(e.target.value)}
              required
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsBankModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime">
              Submit for verification
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
