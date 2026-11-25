import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { KpiTile } from "../../components/ui/KpiTile";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  mockDepartments,
  mockHeadcountPlan,
  mockOrgTree,
  mockPositions,
  mockRequisitions,
} from "../../modules/hrms/mock-api";
import { mapHrmStatus } from "../../modules/hrms/status-map";
import type {
  Department,
  HeadcountPlanRow,
  OrgTreeNode,
  Position,
  Requisition,
  RequisitionReason,
} from "../../modules/hrms/types";

const OrgTreeBranch: React.FC<{ node: OrgTreeNode; visited?: Set<string> }> = ({
  node,
  visited = new Set(),
}) => {
  if (visited.has(node.employeeId)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(node.employeeId);

  return (
    <div className="pl-4 border-l-3 border-border space-y-2">
      <div className="p-2.5 bg-page border-3 border-border inline-block min-w-[220px]">
        <div className="font-bold text-sm">{node.name}</div>
        <div className="text-xs text-text-muted">
          {node.title} · {node.department}
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="space-y-2 pt-1">
          {node.children.map((child) => (
            <OrgTreeBranch key={child.employeeId} node={child} visited={nextVisited} />
          ))}
        </div>
      )}
    </div>
  );
};

export const OrgAndRequisitionsPage: React.FC = () => {
  const { showToast } = useToast();
  const [departments] = useState<Department[]>(mockDepartments);
  const [positions] = useState<Position[]>(mockPositions);
  const [headcountPlan] = useState<HeadcountPlanRow[]>(mockHeadcountPlan);
  const [requisitions, setRequisitions] = useState<Requisition[]>(mockRequisitions);

  const [isNewReqOpen, setIsNewReqOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);

  const [posId, setPosId] = useState(positions[0]?.id ?? "");
  const [reason, setReason] = useState<RequisitionReason>("new");
  const [targetStartDate, setTargetStartDate] = useState("2026-12-15");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [budgetedCost, setBudgetedCost] = useState("95000.00");

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    const pos = positions.find((p) => p.id === posId) ?? positions[0]!;
    const newReq: Requisition = {
      id: `req-${Date.now()}`,
      requisitionNumber: `REQ-2026-0${requisitions.length + 104}`,
      positionId: pos.id,
      positionTitle: pos.title,
      departmentName: pos.departmentName,
      reason,
      leavingEmployeeName: reason === "backfill" ? "Jordan Lee" : undefined,
      leavingSeparationDate: reason === "backfill" ? "2026-11-30" : undefined,
      targetStartDate,
      priority,
      budgetedCost,
      state: "submitted",
      requesterId: "user-current",
      requesterName: "Current User",
      canApprove: false,
      approvalTrail: [
        { stepOrder: 1, approverName: "Elena Vance", role: "Finance", status: "pending" },
      ],
    };
    setRequisitions((prev) => [newReq, ...prev]);
    setIsNewReqOpen(false);
    showToast(`Created ${newReq.requisitionNumber}`, "success");
  };

  const handleApproveReq = (req: Requisition) => {
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? {
              ...r,
              state: "approved",
              canApprove: false,
              approvalTrail: r.approvalTrail.map((s) => ({
                ...s,
                status: "approved",
                decidedAt: "2026-11-24",
              })),
            }
          : r
      )
    );
    setSelectedReq((prev) =>
      prev && prev.id === req.id
        ? {
            ...prev,
            state: "approved",
            canApprove: false,
            approvalTrail: prev.approvalTrail.map((s) => ({
              ...s,
              status: "approved",
              decidedAt: "2026-11-24",
            })),
          }
        : prev
    );
    showToast(`Approved ${req.requisitionNumber}`, "success");
  };

  const deptCols: Column<Department>[] = [
    { header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Department", cell: (r) => <span className="font-bold">{r.name}</span> },
    { header: "Head", cell: (r) => r.headEmployeeName },
    { header: "Cost Center", cell: (r) => <span className="font-mono text-xs">{r.costCenter}</span> },
    { header: "Active", align: "right", cell: (r) => r.activeHeadcount },
  ];

  const posCols: Column<Position>[] = [
    { header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Position", cell: (r) => <span className="font-bold">{r.title}</span> },
    { header: "Department", cell: (r) => r.departmentName },
    {
      header: "Filled / Approved",
      align: "right",
      cell: (r) => `${r.filledHeadcount} / ${r.approvedHeadcount}`,
    },
    {
      header: "Status",
      cell: (r) => {
        const m = mapHrmStatus(r.status);
        return <StatusChip status={m.status} label={m.label} />;
      },
    },
  ];

  const hcCols: Column<HeadcountPlanRow>[] = [
    { header: "Department", cell: (r) => <span className="font-bold">{r.departmentName}</span> },
    { header: "Period", cell: (r) => <span className="font-mono text-xs">{r.period}</span> },
    { header: "Planned", align: "right", cell: (r) => r.planned },
    { header: "Approved", align: "right", cell: (r) => r.approved },
    { header: "Filled", align: "right", cell: (r) => r.filled },
  ];

  const reqCols: Column<Requisition>[] = [
    { header: "Number", cell: (r) => <span className="font-mono text-xs font-bold">{r.requisitionNumber}</span> },
    { header: "Position", cell: (r) => r.positionTitle },
    { header: "Reason", cell: (r) => r.reason },
    { header: "Budget", align: "right", cell: (r) => formatMoney(r.budgetedCost) },
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
        <Button size="sm" variant="ghost" onClick={() => setSelectedReq(r)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
            HRM-02 & HRM-16
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            Org Structure & Requisitions
          </h1>
        </div>
        <Button variant="lime" onClick={() => setIsNewReqOpen(true)}>
          New requisition
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Departments" value={String(departments.length)} variant="panel" />
        <KpiTile label="Open Positions" value={String(positions.filter((p) => p.status === "open").length)} variant="lime" />
        <KpiTile label="Requisitions" value={String(requisitions.length)} variant="yellow" />
        <KpiTile label="Pending Approval" value={String(requisitions.filter((r) => r.state === "submitted").length)} variant="panel" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <Card title="Org Chart (Reports-To Tree)">
            <div className="overflow-x-auto py-2">
              <OrgTreeBranch node={mockOrgTree} />
            </div>
          </Card>
        </div>
        <div className="lg:col-span-7 space-y-4">
          <Card title="Departments">
            <DataTable columns={deptCols} data={departments} />
          </Card>
          <Card title="Positions">
            <DataTable columns={posCols} data={positions} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <Card title="Headcount Plan (HRM-16)">
            <DataTable columns={hcCols} data={headcountPlan} />
          </Card>
        </div>
        <div className="lg:col-span-7">
          <Card title="Requisitions">
            <DataTable columns={reqCols} data={requisitions} />
          </Card>
        </div>
      </div>

      <Drawer
        isOpen={isNewReqOpen}
        onClose={() => setIsNewReqOpen(false)}
        title="New requisition"
      >
        <form onSubmit={handleCreateRequisition} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Position</label>
            <select
              value={posId}
              onChange={(e) => setPosId(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.departmentName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as RequisitionReason)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              <option value="new">New</option>
              <option value="backfill">Backfill</option>
              <option value="replacement">Replacement</option>
              <option value="conversion">Conversion</option>
            </select>
          </div>
          {reason === "backfill" && (
            <div className="p-3 bg-cream border-3 border-border text-xs">
              <strong>Backfill separation date:</strong> Jordan Lee · 2026-11-30
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Target Start Date</label>
            <input
              type="date"
              value={targetStartDate}
              onChange={(e) => setTargetStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Budgeted Cost</label>
            <input
              type="text"
              value={budgetedCost}
              onChange={(e) => setBudgetedCost(e.target.value)}
              className="w-full px-3 py-2 bg-page border-3 border-border text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsNewReqOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="lime">
              Submit requisition
            </Button>
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={Boolean(selectedReq)}
        onClose={() => setSelectedReq(null)}
        title={selectedReq ? selectedReq.requisitionNumber : "Requisition"}
      >
        {selectedReq && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">{selectedReq.positionTitle}</span>
              <StatusChip
                status={mapHrmStatus(selectedReq.state).status}
                label={mapHrmStatus(selectedReq.state).label}
              />
            </div>
            <div className="text-sm space-y-1 text-text-muted">
              <p>Department: {selectedReq.departmentName}</p>
              <p>Reason: {selectedReq.reason}</p>
              {selectedReq.leavingSeparationDate && (
                <p>
                  Leaving employee: {selectedReq.leavingEmployeeName} (Separation:{" "}
                  {selectedReq.leavingSeparationDate})
                </p>
              )}
              <p>Target Start: {selectedReq.targetStartDate}</p>
              <p>Budgeted Cost: {formatMoney(selectedReq.budgetedCost)}</p>
              <p>Requester: {selectedReq.requesterName}</p>
            </div>

            <div className="border-t-3 border-border pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2">Approval Trail</h3>
              <div className="space-y-2">
                {selectedReq.approvalTrail.map((step) => (
                  <div
                    key={step.stepOrder}
                    className="flex items-center justify-between p-2 bg-page border-2 border-border text-xs"
                  >
                    <div>
                      <span className="font-bold">{step.approverName}</span> ({step.role})
                    </div>
                    <StatusChip
                      status={mapHrmStatus(step.status).status}
                      label={mapHrmStatus(step.status).label}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedReq(null)}>
                Cancel
              </Button>
              {selectedReq.state === "submitted" &&
                (selectedReq.canApprove ? (
                  <Button variant="lime" onClick={() => handleApproveReq(selectedReq)}>
                    Approve requisition
                  </Button>
                ) : (
                  <span className="text-xs font-bold text-text-muted self-center px-3 py-2 border-2 border-border bg-page">
                    Waiting for another approver
                  </span>
                ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
