import React, { useState } from "react";
import { Lock } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { useToast } from "../../context/ToastContext";
import {
  mockAttendanceDays,
  mockLeaveBalances,
  mockLeaveRequests,
} from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type { AttendanceDay, LeaveRequest } from "../../modules/hrms/types";

export const AttendanceAndLeavePage: React.FC = () => {
  const { showToast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceDay[]>(mockAttendanceDays);
  const [balances] = useState(mockLeaveBalances);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests);

  const [regTarget, setRegTarget] = useState<AttendanceDay | null>(null);
  const [regStatus, setRegStatus] = useState<"present" | "half_day">("present");
  const [regReason, setRegReason] = useState("");

  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Annual Leave");
  const [fromDate, setFromDate] = useState("2026-12-10");
  const [toDate, setToDate] = useState("2026-12-11");
  const [halfDayFrom, setHalfDayFrom] = useState(false);
  const [halfDayTo, setHalfDayTo] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [daysInput, setDaysInput] = useState("2.0");
  const [leaveError, setLeaveError] = useState("");

  const handleRegularise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTarget || !regReason.trim()) return;
    setAttendance((prev) =>
      prev.map((a) =>
        a.id === regTarget.id
          ? { ...a, status: regStatus, workedMinutes: regStatus === "present" ? 480 : 240 }
          : a
      )
    );
    showToast(`Regularised attendance for ${regTarget.employeeName}`, "success");
    setRegTarget(null);
    setRegReason("");
  };

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError("");
    const bal = balances.find((b) => b.leaveType === leaveType);
    if (bal && Number(daysInput) > Number(bal.balanceDays)) {
      setLeaveError(
        `API Error: Insufficient ${leaveType} balance (${bal.balanceDays} days available, ${daysInput} requested).`
      );
      return;
    }
    const newReq: LeaveRequest = {
      id: `lr-${Date.now()}`,
      employeeId: "emp-005",
      employeeName: "Tariq Al-Mansoor",
      leaveType,
      fromDate,
      toDate,
      halfDayFrom,
      halfDayTo,
      daysRequested: daysInput,
      reason: leaveReason || "Personal",
      status: "pending",
    };
    setLeaveRequests((prev) => [newReq, ...prev]);
    setIsLeaveOpen(false);
    showToast("Leave request submitted", "success");
  };

  const handleLeaveDecision = (id: string, decision: "approved" | "rejected") => {
    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: decision } : r))
    );
    showToast(`Leave request ${decision}`, "success");
  };

  const attCols: Column<AttendanceDay>[] = [
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Date", cell: (r) => <span className="font-mono text-xs">{r.date}</span> },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.status);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
    { header: "Worked (min)", align: "right", cell: (r) => <span className="font-mono">{r.workedMinutes}</span> },
    { header: "OT (min)", align: "right", cell: (r) => <span className="font-mono">{r.overtimeMinutes}</span> },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.locked ? (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted" title="Locked">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Locked
          </span>
        ) : r.status === "exception" ? (
          <Button size="sm" variant="ghost" onClick={() => setRegTarget(r)}>
            Regularise
          </Button>
        ) : null,
    },
  ];

  const leaveCols: Column<LeaveRequest>[] = [
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Type", cell: (r) => r.leaveType },
    { header: "Dates", cell: (r) => <span className="font-mono text-xs">{r.fromDate} → {r.toDate}</span> },
    { header: "Days", align: "right", cell: (r) => <span className="font-mono">{r.daysRequested}</span> },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.status);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="lime" onClick={() => handleLeaveDecision(r.id, "approved")}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleLeaveDecision(r.id, "rejected")}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
            HRM-03 & HRM-04
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Attendance & Leave
          </h1>
        </div>
        <Button variant="lime" onClick={() => setIsLeaveOpen(true)}>
          Request leave
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Exceptions Queue" value={String(attendance.filter((a) => a.status === "exception").length)} variant="yellow" />
        <KpiTile label="Pending Leave" value={String(leaveRequests.filter((l) => l.status === "pending").length)} variant="lime" />
        <KpiTile label="Annual Leave Bal" value={`${balances[0]?.balanceDays ?? "0.0"} d`} variant="panel" />
        <KpiTile label="Personal Leave Bal" value={`${balances[2]?.balanceDays ?? "0.0"} d`} variant="panel" />
      </div>

      <Card title="Attendance Days (HRM-03)">
        <DataTable columns={attCols} data={attendance} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <Card title="Leave Balances (Half-Day Steps)">
            <div className="space-y-2">
              {balances.map((b) => (
                <div key={b.leaveType} className="flex items-center justify-between p-2.5 bg-page border-2 border-border text-sm">
                  <span className="font-bold">{b.leaveType}</span>
                  <span className="font-mono font-bold">{b.balanceDays} days</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="lg:col-span-8">
          <Card title="Leave Approvals Inbox (HRM-04)">
            <DataTable columns={leaveCols} data={leaveRequests} />
          </Card>
        </div>
      </div>

      <Drawer
        isOpen={Boolean(regTarget)}
        onClose={() => setRegTarget(null)}
        title="Regularise attendance"
      >
        {regTarget && (
          <form onSubmit={handleRegularise} className="space-y-4">
            <p className="text-sm">
              <strong>{regTarget.employeeName}</strong> · {regTarget.date}
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Requested Change</label>
              <select
                value={regStatus}
                onChange={(e) => setRegStatus(e.target.value as "present" | "half_day")}
                className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
              >
                <option value="present">Present (480 min)</option>
                <option value="half_day">Half Day (240 min)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Reason</label>
              <textarea
                value={regReason}
                onChange={(e) => setRegReason(e.target.value)}
                rows={3}
                required
                className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
                placeholder="Explain the missing punch or exception..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setRegTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="lime">
                Submit regularisation
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer
        isOpen={isLeaveOpen}
        onClose={() => setIsLeaveOpen(false)}
        title="Request leave"
      >
        <form onSubmit={handleSubmitLeave} className="space-y-4">
          {leaveError && (
            <div className="p-3 bg-cream border-3 border-act text-xs font-bold text-act">
              {leaveError}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              {balances.map((b) => (
                <option key={b.leaveType} value={b.leaveType}>
                  {b.leaveType} ({b.balanceDays} days)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 bg-page border-3 border-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 bg-page border-3 border-border text-sm" />
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={halfDayFrom} onChange={(e) => setHalfDayFrom(e.target.checked)} />
              Half-day start
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={halfDayTo} onChange={(e) => setHalfDayTo(e.target.checked)} />
              Half-day end
            </label>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Days Requested</label>
            <input type="text" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Reason</label>
            <input type="text" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="w-full px-3 py-2 bg-page border-3 border-border text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsLeaveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime">
              Submit request
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
