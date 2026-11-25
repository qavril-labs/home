import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { mockExitCases, mockLoans } from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type { ExitCase, LoanInstallment, LoanRecord } from "../../modules/hrms/types";

export const SeparationsAndLoansPage: React.FC = () => {
  const { showToast } = useToast();
  const [exitCases, setExitCases] = useState<ExitCase[]>(mockExitCases);
  const [selectedExit, setSelectedExit] = useState<ExitCase | null>(null);
  const [waiveTarget, setWaiveTarget] = useState<{ exitId: string; itemId: string; itemName: string } | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [fnfAction, setFnfAction] = useState<{ exit: ExitCase; type: "approve" | "pay" } | null>(null);

  const [loans, setLoans] = useState<LoanRecord[]>(mockLoans);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(mockLoans[0] ?? null);
  const [isLoanDrawerOpen, setIsLoanDrawerOpen] = useState(false);
  const [loanType, setLoanType] = useState<"salary_advance" | "personal_loan" | "emergency_loan">("personal_loan");
  const [loanPrincipal, setLoanPrincipal] = useState("5000.00");
  const [loanInstallments, setLoanInstallments] = useState(5);
  const [loanStartMonth, setLoanStartMonth] = useState("2026-12");

  const overLimitApprover = Number(loanPrincipal) > 3000 ? "Elena Vance (VP Finance)" : undefined;

  const handleClearItem = (exitId: string, itemId: string) => {
    setExitCases((prev) =>
      prev.map((ex) => {
        if (ex.id !== exitId) return ex;
        const items = ex.clearanceItems.map((i) =>
          i.id === itemId ? { ...i, status: "cleared" as const } : i
        );
        const completed = items.filter((i) => i.status !== "pending").length;
        const allDone = completed === items.length;
        const updated: ExitCase = {
          ...ex,
          clearanceItems: items,
          clearanceCompletedCount: completed,
          fnfStatus: allDone ? "READY" : "BLOCKED",
          fnfMissingInputs: allDone ? [] : items.filter((i) => i.status === "pending").map((i) => `${i.department}: ${i.itemName}`),
        };
        if (selectedExit?.id === exitId) setSelectedExit(updated);
        return updated;
      })
    );
    showToast("Clearance item cleared", "success");
  };

  const handleWaiveConfirm = () => {
    if (!waiveTarget || !waiveReason.trim()) return;
    setExitCases((prev) =>
      prev.map((ex) => {
        if (ex.id !== waiveTarget.exitId) return ex;
        const items = ex.clearanceItems.map((i) =>
          i.id === waiveTarget.itemId
            ? { ...i, status: "waived" as const, waiverReason: waiveReason.trim() }
            : i
        );
        const completed = items.filter((i) => i.status !== "pending").length;
        const allDone = completed === items.length;
        const updated: ExitCase = {
          ...ex,
          clearanceItems: items,
          clearanceCompletedCount: completed,
          fnfStatus: allDone ? "READY" : "BLOCKED",
          fnfMissingInputs: allDone ? [] : items.filter((i) => i.status === "pending").map((i) => `${i.department}: ${i.itemName}`),
        };
        if (selectedExit?.id === waiveTarget.exitId) setSelectedExit(updated);
        return updated;
      })
    );
    showToast(`Waived ${waiveTarget.itemName}`, "info");
    setWaiveTarget(null);
    setWaiveReason("");
  };

  const handleFnfConfirm = () => {
    if (!fnfAction) return;
    const { exit, type } = fnfAction;
    const nextState = type === "approve" ? "fnf_approved" : "fnf_paid";
    setExitCases((prev) =>
      prev.map((ex) => (ex.id === exit.id ? { ...ex, state: nextState } : ex))
    );
    if (selectedExit?.id === exit.id) {
      setSelectedExit({ ...exit, state: nextState });
    }
    showToast(`F&F ${type === "approve" ? "approved" : "paid"} for ${exit.employeeInitials}`, "success");
    setFnfAction(null);
  };

  const handleRequestLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const newLoan: LoanRecord = {
      id: `ln-${Date.now()}`,
      employeeId: "emp-005",
      employeeName: "Tariq Al-Mansoor",
      loanType,
      principal: loanPrincipal,
      outstandingBalance: loanPrincipal,
      state: "pending_approval",
      overLimitApproverName: overLimitApprover,
      installments: Array.from({ length: loanInstallments }, (_, idx) => ({
        installmentNumber: idx + 1,
        duePeriod: loanStartMonth,
        principal: "1000.00",
        interest: "0.00",
        status: "pending",
        roundingAbsorbed: idx === loanInstallments - 1,
      })),
    };
    setLoans((prev) => [newLoan, ...prev]);
    setSelectedLoan(newLoan);
    setIsLoanDrawerOpen(false);
    showToast("Loan request submitted", "success");
  };

  const exitCols: Column<ExitCase>[] = [
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Type", cell: (r) => r.exitType },
    { header: "Last Working Day", cell: (r) => <span className="font-mono text-xs">{r.lastWorkingDay}</span> },
    { header: "F&F Net", align: "right", cell: (r) => <span className="font-mono font-bold">{formatMoney(r.fnfNetPayable)}</span> },
    {
      header: "State",
      cell: (r) => {
        const m = mapHrmStatus(r.fnfStatus === "BLOCKED" ? "blocked" : r.state);
        return <StatusChip status={m.status} label={r.fnfStatus === "BLOCKED" ? "Blocked" : m.label} />;
      },
    },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedExit(r)}>
          Open Exit
        </Button>
      ),
    },
  ];

  const loanCols: Column<LoanRecord>[] = [
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Type", cell: (r) => r.loanType.replace("_", " ") },
    { header: "Outstanding", align: "right", cell: (r) => <span className="font-mono font-bold">{formatMoney(r.outstandingBalance)}</span> },
    {
      header: "State",
      cell: (r) => {
        const m = mapHrmStatus(r.state);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedLoan(r)}>
          Schedule
        </Button>
      ),
    },
  ];

  const instCols: Column<LoanInstallment>[] = [
    { header: "#", cell: (r) => r.installmentNumber },
    { header: "Due Period", cell: (r) => <span className="font-mono text-xs">{r.duePeriod}</span> },
    { header: "Principal", align: "right", cell: (r) => <span className="font-mono">{formatMoney(r.principal)}</span> },
    { header: "Interest", align: "right", cell: (r) => <span className="font-mono">{formatMoney(r.interest)}</span> },
    {
      header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusChip status={mapHrmStatus(r.status).status} label={mapHrmStatus(r.status).label} />
          {r.roundingAbsorbed && <span className="text-[10px] font-mono text-text-muted">(rounding absorbed)</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
            HRM-18 & HRM-19
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Separations & Loans
          </h1>
        </div>
        <Button variant="lime" onClick={() => setIsLoanDrawerOpen(true)}>
          Request loan
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Active Exit Cases" value={String(exitCases.length)} variant="yellow" />
        <KpiTile label="Blocked F&F" value={String(exitCases.filter((e) => e.fnfStatus === "BLOCKED").length)} variant="panel" />
        <KpiTile label="Active Loans" value={String(loans.filter((l) => l.state === "active").length)} variant="lime" />
        <KpiTile label="Pending Loans" value={String(loans.filter((l) => l.state === "pending_approval").length)} variant="panel" />
      </div>

      <Card title="Exit Cases & Full and Final (HRM-18)">
        <DataTable columns={exitCols} data={exitCases} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <Card title="Loans & Advances (HRM-19)">
            <DataTable columns={loanCols} data={loans} />
          </Card>
        </div>
        <div className="lg:col-span-7">
          {selectedLoan && (
            <Card title={`Installment Schedule: ${selectedLoan.employeeName}`}>
              {selectedLoan.overLimitApproverName && (
                <div className="mb-3 p-2.5 bg-cream border-2 border-border text-xs font-bold">
                  Over-limit request — requires approval from: {selectedLoan.overLimitApproverName}
                </div>
              )}
              <DataTable
                columns={instCols}
                data={selectedLoan.installments}
               
              />
            </Card>
          )}
        </div>
      </div>

      <Drawer
        isOpen={Boolean(selectedExit)}
        onClose={() => setSelectedExit(null)}
        title={selectedExit ? `Exit: ${selectedExit.employeeName}` : "Exit Case"}
      >
        {selectedExit && (
          <div className="space-y-4">
            <div className="text-xs space-y-1 text-text-muted">
              <p>Type: {selectedExit.exitType} · Reason: {selectedExit.reasonCode}</p>
              <p>Last Working Day: {selectedExit.lastWorkingDay} · Access Removal: {selectedExit.accessRemovalDate}</p>
              <p>
                Notice Shortfall: {selectedExit.noticeShortfallDays} days · Buy-out:{" "}
                <span className="font-mono font-bold">{formatMoney(selectedExit.noticeBuyoutAmount)}</span>
              </p>
            </div>

            <div className="border-t-3 border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider">Clearance Checklist</h3>
                <span className="text-xs font-mono font-bold">
                  {selectedExit.clearanceCompletedCount} / {selectedExit.clearanceTotalCount}
                </span>
              </div>
              {selectedExit.clearanceItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-page border-2 border-border text-xs">
                  <div>
                    <span className="font-bold">{item.department}:</span> {item.itemName}
                  </div>
                  {item.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="lime" onClick={() => handleClearItem(selectedExit.id, item.id)}>
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setWaiveTarget({ exitId: selectedExit.id, itemId: item.id, itemName: item.itemName })
                        }
                      >
                        Waive
                      </Button>
                    </div>
                  ) : (
                    <StatusChip status="good" label={item.status} />
                  )}
                </div>
              ))}
            </div>

            <div className="border-t-3 border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider">F&F Statement ({selectedExit.fnfRuleVersion})</h3>
                <StatusChip
                  status={selectedExit.fnfStatus === "BLOCKED" ? "watch" : "good"}
                  label={selectedExit.fnfStatus === "BLOCKED" ? "Worth a look" : "All good"}
                />
              </div>

              {selectedExit.fnfStatus === "BLOCKED" && (
                <div className="p-2.5 bg-cream border-3 border-watch text-xs font-bold">
                  BLOCKED — Missing inputs: {selectedExit.fnfMissingInputs.join(", ")}
                </div>
              )}

              <div className="space-y-1 text-xs">
                {selectedExit.fnfLines.map((line) => (
                  <div key={line.id} className="flex justify-between p-1.5 bg-page border border-border">
                    <div>
                      <div className="font-bold">{line.label}</div>
                      <div className="text-[10px] text-text-muted">{line.source} · {line.calculationId}</div>
                    </div>
                    <span className="font-mono font-bold self-center">{formatMoney(line.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm pt-2 border-t-2 border-border">
                  <span>
                    {selectedExit.fnfNetPayable.startsWith("-")
                      ? "Receivable from employee"
                      : "Net Payable"}
                  </span>
                  <span className="font-mono">{formatMoney(selectedExit.fnfNetPayable)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="lime"
                  disabled={selectedExit.fnfStatus === "BLOCKED" || selectedExit.state === "fnf_approved"}
                  onClick={() => setFnfAction({ exit: selectedExit, type: "approve" })}
                >
                  Approve F&F
                </Button>
                {selectedExit.state === "fnf_approved" && (
                  <Button
                    variant="lime"
                    onClick={() => setFnfAction({ exit: selectedExit, type: "pay" })}
                  >
                    Pay F&F
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        isOpen={isLoanDrawerOpen}
        onClose={() => setIsLoanDrawerOpen(false)}
        title="Request loan"
      >
        <form onSubmit={handleRequestLoan} className="space-y-4">
          {overLimitApprover && (
            <div className="p-3 bg-cream border-3 border-watch text-xs font-bold">
              Over-limit request: requires approval from {overLimitApprover}.
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Loan Type</label>
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as "salary_advance" | "personal_loan" | "emergency_loan")}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              <option value="salary_advance">Salary Advance</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="emergency_loan">Emergency Loan</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Principal</label>
            <input
              type="text"
              value={loanPrincipal}
              onChange={(e) => setLoanPrincipal(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Installments</label>
            <input
              type="number"
              min={1}
              max={24}
              value={loanInstallments}
              onChange={(e) => setLoanInstallments(Number(e.target.value))}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Start Month</label>
            <input
              type="month"
              value={loanStartMonth}
              onChange={(e) => setLoanStartMonth(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsLoanDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime">
              Submit loan request
            </Button>
          </div>
        </form>
      </Drawer>

      <Modal
        isOpen={Boolean(waiveTarget)}
        onClose={() => setWaiveTarget(null)}
        title="Waive clearance item"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Provide a reason to waive &quot;{waiveTarget?.itemName ?? ""}&quot;:
          </p>
          <input
            type="text"
            value={waiveReason}
            onChange={(e) => setWaiveReason(e.target.value)}
            placeholder="e.g. Recovered via payroll"
            className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWaiveTarget(null)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={handleWaiveConfirm}>
              Waive item
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(fnfAction)}
        onClose={() => setFnfAction(null)}
        onConfirm={handleFnfConfirm}
        title={fnfAction?.type === "approve" ? "Approve F&F" : "Pay F&F"}
        message={
          fnfAction
            ? `${fnfAction.type === "approve" ? "Approve" : "Pay"} F&F of ${formatMoney(fnfAction.exit.fnfNetPayable)} for ${fnfAction.exit.employeeInitials}?`
            : ""
        }
        actionVerb={fnfAction?.type === "approve" ? "Approve F&F" : "Pay F&F"}
      />
    </div>
  );
};
