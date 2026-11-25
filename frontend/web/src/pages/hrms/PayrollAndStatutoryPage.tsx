import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  mockPayRuns,
  mockPayslips,
  mockStatutoryFilings,
} from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type {
  PayRun,
  PayRunEmployeeLine,
  PayRunVerificationCheck,
  Payslip,
  StatutoryFiling,
} from "../../modules/hrms/types";

export const PayrollAndStatutoryPage: React.FC = () => {
  const { showToast } = useToast();
  const [payRuns, setPayRuns] = useState<PayRun[]>(mockPayRuns);
  const [selectedRunId, setSelectedRunId] = useState<string>(mockPayRuns[0]?.id ?? "");
  const [filings] = useState<StatutoryFiling[]>(mockStatutoryFilings);
  const [payslips] = useState<Payslip[]>(mockPayslips);

  const [overrideTarget, setOverrideTarget] = useState<PayRunVerificationCheck | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const [runAction, setRunAction] = useState<{
    run: PayRun;
    type: "approve" | "post" | "pay";
  } | null>(null);

  const selectedRun = payRuns.find((r) => r.id === selectedRunId) ?? payRuns[0];

  const handleOverride = () => {
    if (!overrideTarget || !overrideReason.trim() || !selectedRun) return;
    setPayRuns((prev) =>
      prev.map((r) =>
        r.id === selectedRun.id
          ? {
              ...r,
              verificationChecks: r.verificationChecks.map((c) =>
                c.id === overrideTarget.id
                  ? { ...c, overridden: true, overrideReason: overrideReason.trim() }
                  : c
              ),
            }
          : r
      )
    );
    showToast(`Overrode check: ${overrideTarget.name}`, "info");
    setOverrideTarget(null);
    setOverrideReason("");
  };

  const handleRunActionConfirm = () => {
    if (!runAction) return;
    const { run, type } = runAction;
    const nextState = type === "approve" ? "approved" : type === "post" ? "posted" : "paid";
    setPayRuns((prev) =>
      prev.map((r) => (r.id === run.id ? { ...r, state: nextState } : r))
    );
    showToast(`${run.periodLabel} marked as ${nextState}`, "success");
    setRunAction(null);
  };

  const runCols: Column<PayRun>[] = [
    { header: "Period", cell: (r) => <span className="font-bold">{r.periodLabel}</span> },
    { header: "Net Total", align: "right", cell: (r) => <span className="font-mono font-bold">{formatMoney(r.totalNet)}</span> },
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
        <Button size="sm" variant="ghost" onClick={() => setSelectedRunId(r.id)}>
          Inspect
        </Button>
      ),
    },
  ];

  const lineCols: Column<PayRunEmployeeLine>[] = [
    { header: "Code", cell: (r) => <span className="font-mono text-xs">{r.employeeCode}</span> },
    { header: "Employee", cell: (r) => <span className="font-bold">{r.employeeName}</span> },
    { header: "Earnings", align: "right", cell: (r) => <span className="font-mono">{formatMoney(r.earnings)}</span> },
    { header: "Deductions", align: "right", cell: (r) => <span className="font-mono">{formatMoney(r.deductions)}</span> },
    { header: "Net Pay", align: "right", cell: (r) => <span className="font-mono font-bold">{formatMoney(r.netPay)}</span> },
  ];

  const filingCols: Column<StatutoryFiling>[] = [
    { header: "Filing", cell: (r) => <span className="font-bold">{r.filingName}</span> },
    { header: "Authority", cell: (r) => r.authority },
    { header: "Due Date", cell: (r) => <span className="font-mono text-xs">{r.dueDate}</span> },
    { header: "Pack Version", cell: (r) => <span className="font-mono text-xs">{r.packVersion} (eff. {r.packEffectiveFrom})</span> },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.status);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
  ];

  const payslipCols: Column<Payslip>[] = [
    { header: "Period", cell: (r) => <span className="font-bold">{r.periodLabel}</span> },
    { header: "Pay Date", cell: (r) => <span className="font-mono text-xs">{r.payDate}</span> },
    { header: "Gross", align: "right", cell: (r) => <span className="font-mono">{formatMoney(r.grossPay)}</span> },
    { header: "Net Pay", align: "right", cell: (r) => <span className="font-mono font-bold">{formatMoney(r.netPay)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
            HRM-05 & HRM-06
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Payroll & Statutory
          </h1>
        </div>
      </div>

      {selectedRun && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Selected Period" value={selectedRun.periodLabel} variant="panel" />
          <KpiTile label="Total Earnings" value={formatMoney(selectedRun.totalEarnings)} variant="panel" />
          <KpiTile label="Total Deductions" value={formatMoney(selectedRun.totalDeductions)} variant="yellow" />
          <KpiTile label="Net Payable" value={formatMoney(selectedRun.totalNet)} variant="lime" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <Card title="Pay Runs (HRM-05)">
            <DataTable columns={runCols} data={payRuns} />
          </Card>
        </div>

        <div className="lg:col-span-7">
          {selectedRun && (
            <Card title={`Pay Run Detail: ${selectedRun.periodLabel}`}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-text-muted">
                    Prepared by: <strong>{selectedRun.preparerName}</strong>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedRun.state === "verified" &&
                      (selectedRun.canApprove ? (
                        <Button
                          variant="lime"
                          size="sm"
                          onClick={() => setRunAction({ run: selectedRun, type: "approve" })}
                        >
                          Approve run
                        </Button>
                      ) : (
                        <span className="text-xs font-bold text-text-muted px-2 py-1 border-2 border-border">
                          Preparer cannot approve
                        </span>
                      ))}
                    {selectedRun.state === "approved" && (
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => setRunAction({ run: selectedRun, type: "post" })}
                      >
                        Post to ledger
                      </Button>
                    )}
                    {selectedRun.state === "posted" && (
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => setRunAction({ run: selectedRun, type: "pay" })}
                      >
                        Mark as paid
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider">Verification Checks</h3>
                  {selectedRun.verificationChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-page border-2 border-border text-xs"
                    >
                      <div>
                        <span className="font-bold">{chk.name}:</span> {chk.message}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip
                          status={chk.passed || chk.overridden ? "good" : "watch"}
                          label={chk.passed ? "Passed" : chk.overridden ? "Overridden" : "Failed"}
                        />
                        {!chk.passed && !chk.overridden && (
                          <Button size="sm" variant="ghost" onClick={() => setOverrideTarget(chk)}>
                            Override
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <DataTable
                  columns={lineCols}
                  data={selectedRun.employeeLines}
                 
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <Card title="Statutory Filing Calendar (HRM-06)">
            <DataTable columns={filingCols} data={filings} />
          </Card>
        </div>
        <div className="lg:col-span-5">
          <Card title="Payslips (Posted Runs Only)">
            <DataTable columns={payslipCols} data={payslips} />
          </Card>
        </div>
      </div>

      <Modal
        isOpen={Boolean(overrideTarget)}
        onClose={() => setOverrideTarget(null)}
        title="Override verification check"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Provide a reason to override &quot;{overrideTarget?.name ?? ""}&quot;:
          </p>
          <input
            type="text"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. Manual wire arranged"
            className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOverrideTarget(null)}>
              Cancel
            </Button>
            <Button variant="lime" onClick={handleOverride}>
              Override check
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(runAction)}
        onClose={() => setRunAction(null)}
        onConfirm={handleRunActionConfirm}
        title={
          runAction?.type === "approve"
            ? "Approve run"
            : runAction?.type === "post"
            ? "Post to ledger"
            : "Mark as paid"
        }
        message={
          runAction
            ? `${
                runAction.type === "approve"
                  ? "Approve"
                  : runAction.type === "post"
                  ? "Post to ledger"
                  : "Mark as paid"
              } ${formatMoney(runAction.run.totalNet)} for ${runAction.run.periodLabel}?`
            : ""
        }
        actionVerb={
          runAction?.type === "approve"
            ? "Approve run"
            : runAction?.type === "post"
            ? "Post to ledger"
            : "Mark as paid"
        }
      />
    </div>
  );
};
