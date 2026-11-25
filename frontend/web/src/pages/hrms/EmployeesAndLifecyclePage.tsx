import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { RevealPiiDialog } from "../../modules/hrms/RevealPiiDialog";
import { mockEmployees, mockLifecycleEvents } from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type {
  Employee,
  EmployeeStatus,
  LifecycleEvent,
  LifecycleEventType,
} from "../../modules/hrms/types";

export const EmployeesAndLifecyclePage: React.FC = () => {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [events, setEvents] = useState<LifecycleEvent[]>(mockLifecycleEvents);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [drawerTab, setDrawerTab] = useState<"employment" | "documents" | "bank">("employment");

  const [revealTarget, setRevealTarget] = useState<{
    fieldLabel: string;
    employeeName: string;
  } | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventEmpId, setEventEmpId] = useState(employees[0]?.id ?? "");
  const [eventType, setEventType] = useState<LifecycleEventType>("confirmation");
  const [effectiveDate, setEffectiveDate] = useState("2026-11-25");
  const [reasonCode, setReasonCode] = useState("CONFIRM_PASS");

  const closedPeriodWarning =
    effectiveDate && effectiveDate <= "2026-10-31"
      ? "API Warning: Effective date is in a closed pay period (October 2026). Retroactive payroll adjustment will be queued."
      : null;

  const filteredEmployees = employees.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    return true;
  });

  const pagedEmployees = filteredEmployees.slice((page - 1) * pageSize, page * pageSize);

  const handleVerifyBank = (empId: string, bankId: string) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === empId
          ? {
              ...e,
              bankAccounts: e.bankAccounts.map((b) =>
                b.id === bankId ? { ...b, verified: true, canVerify: false } : b
              ),
            }
          : e
      )
    );
    setSelectedEmp((prev) =>
      prev && prev.id === empId
        ? {
            ...prev,
            bankAccounts: prev.bankAccounts.map((b) =>
              b.id === bankId ? { ...b, verified: true, canVerify: false } : b
            ),
          }
        : prev
    );
    showToast("Bank account verified", "success");
  };

  const handleRecordEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === eventEmpId) ?? employees[0]!;
    const newEvt: LifecycleEvent = {
      id: `le-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      eventType,
      effectiveDate,
      reasonCode,
      status: "pending",
      approvals: [
        { step: "Manager Approval", status: "pending" },
        { step: "HR Approval", status: "pending" },
      ],
    };
    setEvents((prev) => [newEvt, ...prev]);
    setIsEventModalOpen(false);
    showToast(`Recorded ${eventType.replace("_", " ")} for ${emp.name}`, "success");
  };

  const empCols: Column<Employee>[] = [
    { header: "Code", cell: (r) => <span className="font-mono text-xs font-bold">{r.code}</span> },
    { header: "Name", cell: (r) => <span className="font-bold">{r.name}</span> },
    { header: "Department", cell: (r) => r.department },
    { header: "Branch", cell: (r) => r.branch },
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
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedEmp(r)}>
          Profile
        </Button>
      ),
    },
  ];

  const eventCols: Column<LifecycleEvent>[] = [
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Event", cell: (r) => r.eventType.replace("_", " ") },
    { header: "Effective Date", cell: (r) => <span className="font-mono text-xs">{r.effectiveDate}</span> },
    { header: "Reason", cell: (r) => <span className="font-mono text-xs">{r.reasonCode}</span> },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.overdue ? "overdue" : r.status);
        return <StatusChip status={m.status} label={r.overdue ? "Overdue" : m.label} />;
      },
    },
  ];

  const departments = Array.from(new Set(employees.map((e) => e.department)));
  const statuses: EmployeeStatus[] = [
    "pre_boarding",
    "active",
    "on_leave",
    "suspended",
    "notice",
    "separated",
    "no_show",
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
            HRM-01 & HRM-17
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Employees & Lifecycle
          </h1>
        </div>
        <Button variant="lime" onClick={() => setIsEventModalOpen(true)}>
          Record event
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Total Employees" value={String(employees.length)} variant="lime" />
        <KpiTile label="Active" value={String(employees.filter((e) => e.status === "active").length)} variant="panel" />
        <KpiTile label="Probation Due (14d)" value={String(events.filter((e) => e.eventType === "probation_review").length)} variant="yellow" />
        <KpiTile label="Overdue Reviews" value={String(events.filter((e) => e.overdue).length)} variant="panel" />
      </div>

      <Card title="Employee Directory (HRM-01)">
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-page border-3 border-border text-xs font-bold"
          >
            <option value="all">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by department"
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-page border-3 border-border text-xs font-bold"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <DataTable columns={empCols} data={pagedEmployees} />

        <div className="flex items-center justify-between pt-3 text-xs">
          <span>
            Showing {pagedEmployees.length} of {filteredEmployees.length}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page * pageSize >= filteredEmployees.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Lifecycle Events Queue (HRM-17)">
        <DataTable columns={eventCols} data={events} />
      </Card>

      <Drawer
        isOpen={Boolean(selectedEmp)}
        onClose={() => setSelectedEmp(null)}
        title={selectedEmp ? `${selectedEmp.name} (${selectedEmp.code})` : "Employee Profile"}
      >
        {selectedEmp && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">
                {selectedEmp.department} · {selectedEmp.branch}
              </span>
              <StatusChip
                status={mapHrmStatus(selectedEmp.status).status}
                label={mapHrmStatus(selectedEmp.status).label}
              />
            </div>

            <div className="p-3 bg-page border-2 border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span>
                  <strong>National ID:</strong>{" "}
                  {revealedFields[`${selectedEmp.id}-nid`] ? "123-45-4419" : selectedEmp.nationalIdMasked}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRevealTarget({ fieldLabel: "National ID", employeeName: selectedEmp.name })
                  }
                >
                  Reveal
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  <strong>Tax ID:</strong>{" "}
                  {revealedFields[`${selectedEmp.id}-tax`] ? "98-7659912" : selectedEmp.taxIdMasked}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRevealTarget({ fieldLabel: "Tax ID", employeeName: selectedEmp.name })
                  }
                >
                  Reveal
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  <strong>DOB:</strong> {selectedEmp.dobMasked}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRevealTarget({ fieldLabel: "Date of Birth", employeeName: selectedEmp.name })
                  }
                >
                  Reveal
                </Button>
              </div>
            </div>

            <div className="flex gap-2 border-b-3 border-border pb-2">
              {(["employment", "documents", "bank"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={drawerTab === t ? "lime" : "ghost"}
                  onClick={() => setDrawerTab(t)}
                >
                  {t === "employment" ? "Employment" : t === "documents" ? "Documents" : "Bank accounts"}
                </Button>
              ))}
            </div>

            {drawerTab === "employment" && (
              <div className="space-y-2">
                {selectedEmp.employmentHistory.map((h) => (
                  <div key={h.id} className="p-2.5 bg-page border-2 border-border text-xs">
                    <div className="font-bold">{h.title}</div>
                    <div className="text-text-muted">
                      {h.department} · {h.branch}
                    </div>
                    <div className="font-mono mt-1">
                      valid_from: {h.valid_from} · valid_to: {h.valid_to ?? "Present"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drawerTab === "documents" && (
              <div className="space-y-2">
                {selectedEmp.documents.length === 0 ? (
                  <p className="text-xs text-text-muted">No documents uploaded.</p>
                ) : (
                  selectedEmp.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 bg-page border-2 border-border text-xs">
                      <div>
                        <div className="font-bold">{d.name}</div>
                        <div className="text-text-muted">Expiry: {d.expiryDate ?? "None"}</div>
                      </div>
                      <StatusChip
                        status={mapHrmStatus(d.status).status}
                        label={mapHrmStatus(d.status).label}
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {drawerTab === "bank" && (
              <div className="space-y-2">
                {selectedEmp.bankAccounts.length === 0 ? (
                  <p className="text-xs text-text-muted">No bank accounts on file.</p>
                ) : (
                  selectedEmp.bankAccounts.map((b) => (
                    <div key={b.id} className="p-2.5 bg-page border-2 border-border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{b.bankName} ({b.accountNumberMasked})</span>
                        <StatusChip
                          status={b.verified ? "good" : "act"}
                          label={b.verified ? "Verified" : "Pending verification"}
                        />
                      </div>
                      <div className="text-text-muted">Effective from: {b.effectiveFrom}</div>
                      {!b.verified && b.canVerify && (
                        <Button
                          size="sm"
                          variant="lime"
                          onClick={() => handleVerifyBank(selectedEmp.id, b.id)}
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title="Record event"
      >
        <form onSubmit={handleRecordEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Employee</label>
            <select
              value={eventEmpId}
              onChange={(e) => setEventEmpId(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as LifecycleEventType)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              <option value="probation_review">Probation Review</option>
              <option value="confirmation">Confirmation</option>
              <option value="transfer">Transfer</option>
              <option value="promotion">Promotion</option>
              <option value="status_change">Status Change</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Effective Date (YYYY-MM-DD)</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
            {closedPeriodWarning && (
              <p className="text-xs font-bold text-watch mt-1">{closedPeriodWarning}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Reason Code</label>
            <input
              type="text"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEventModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime">
              Record event
            </Button>
          </div>
        </form>
      </Modal>

      <RevealPiiDialog
        isOpen={Boolean(revealTarget)}
        onClose={() => setRevealTarget(null)}
        fieldLabel={revealTarget?.fieldLabel ?? ""}
        employeeName={revealTarget?.employeeName ?? ""}
        onRevealed={() => {
          if (selectedEmp && revealTarget) {
            const key =
              revealTarget.fieldLabel === "National ID"
                ? `${selectedEmp.id}-nid`
                : `${selectedEmp.id}-tax`;
            setRevealedFields((prev) => ({ ...prev, [key]: true }));
          }
        }}
      />
    </div>
  );
};
