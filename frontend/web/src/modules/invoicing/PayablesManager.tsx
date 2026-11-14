import React, { useState, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { Drawer } from "../../components/ui/Drawer";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import type { Bill, Party, Account } from "../../types";
import {
  toDecimalString,
  getBillStatusChip,
  computePayablesAging,
} from "../invoicing/invoiceHelpers";
import {
  Plus,
  Search,
  CheckCircle2,
  FileCheck,
  Trash2,
} from "lucide-react";

export interface PayablesManagerProps {
  bills: Bill[];
  suppliers: Party[];
  expenseAccounts: Account[];
  onAddBill: (bill: Bill) => void;
  onApproveBill: (id: string) => void;
  onPayBill: (id: string) => void;
  onDeleteBill: (id: string) => void;
}

export const PayablesManager: React.FC<PayablesManagerProps> = ({
  bills,
  suppliers,
  expenseAccounts,
  onAddBill,
  onApproveBill,
  onPayBill,
  onDeleteBill,
}) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending_approval" | "approved" | "overdue" | "paid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Bill | null>(null);

  // New bill state
  const [billNumber, setBillNumber] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0] || "2026-11-10");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0] || "2026-12-10";
  });
  const [accountCode, setAccountCode] = useState("5000");
  const [amount, setAmount] = useState("0.00");
  const [notes, setNotes] = useState("");

  const aging = useMemo(() => computePayablesAging(bills), [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesFilter = filter === "all" || b.status === filter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.billNumber.toLowerCase().includes(q) ||
        b.supplierName.toLowerCase().includes(q) ||
        (b.vendorInvoiceNumber && b.vendorInvoiceNumber.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [bills, filter, searchQuery]);

  const openCreateDrawer = () => {
    setBillNumber(`BILL-${Math.floor(1000 + Math.random() * 9000)}`);
    setVendorRef("");
    setSupplierId(suppliers[0]?.id || "");
    const today = new Date().toISOString().split("T")[0] || "2026-11-10";
    setIssueDate(today);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split("T")[0] || "2026-12-10");
    setAccountCode(expenseAccounts[0]?.code || "5000");
    setAmount("0.00");
    setNotes("");
    setIsDrawerOpen(true);
  };

  const handleSaveBill = () => {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!supplierId || !sup) {
      showToast("Please select a valid supplier party", { type: "info" });
      return;
    }

    const normAmount = toDecimalString(amount);
    const newBill: Bill = {
      id: `bill-${Date.now()}`,
      billNumber: billNumber.trim().toUpperCase(),
      vendorInvoiceNumber: vendorRef.trim() || undefined,
      supplierId: sup.id,
      supplierName: sup.legalName || sup.tradeName,
      issueDate,
      dueDate,
      currency: "USD",
      status: "pending_approval",
      lines: [
        {
          id: `line-${Date.now()}`,
          sku: "EXP-GEN",
          description: notes || "Vendor materials & supply charges",
          quantity: 1,
          unit: "pcs",
          unitCost: normAmount,
          accountCode,
          lineTotal: normAmount,
        },
      ],
      subtotal: normAmount,
      taxTotal: "0.00",
      total: normAmount,
      amountPaid: "0.00",
      balanceDue: normAmount,
      notes,
    };

    onAddBill(newBill);
    setIsDrawerOpen(false);
    showToast(`Registered supplier bill ${newBill.billNumber}`, { type: "success" });
  };

  const columns: Column<Bill>[] = [
    {
      header: "Bill #",
      accessorKey: "billNumber",
      cell: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-text">{r.billNumber}</span>
          {r.vendorInvoiceNumber && (
            <div className="text-[10px] font-mono text-muted">Vendor Ref: {r.vendorInvoiceNumber}</div>
          )}
        </div>
      ),
    },
    {
      header: "Supplier",
      accessorKey: "supplierName",
      cell: (r) => (
        <div>
          <div className="font-bold text-xs text-text">{r.supplierName}</div>
          <div className="text-[10px] font-mono text-muted">{r.supplierId}</div>
        </div>
      ),
    },
    {
      header: "Due Date",
      accessorKey: "dueDate",
      cell: (r) => (
        <span
          className={`font-mono text-xs ${
            r.status === "overdue" ? "text-act font-bold bg-cream px-1 border border-act" : "text-muted"
          }`}
        >
          {r.dueDate}
        </span>
      ),
    },
    {
      header: "Total Due",
      accessorKey: "balanceDue",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-xs text-series-out">
          {formatMoney(r.balanceDue, "$")}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (r) => {
        const chip = getBillStatusChip(r.status);
        return <StatusChip status={chip.status} label={chip.label} />;
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.status === "pending_approval" && (
            <button
              type="button"
              onClick={() => {
                onApproveBill(r.id);
                showToast(`Approved bill ${r.billNumber}`, { type: "success" });
              }}
              className="p-1.5 bg-lime border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:opacity-90 text-ink cursor-pointer active:translate-y-0.5"
              title="Approve bill for payment"
            >
              <FileCheck className="w-3.5 h-3.5" />
            </button>
          )}

          {r.status === "approved" && (
            <button
              type="button"
              onClick={() => {
                onPayBill(r.id);
                showToast(`Recorded disbursement for ${r.billNumber}`, { type: "success" });
              }}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime text-ink cursor-pointer active:translate-y-0.5"
              title="Record payment release"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setDeleteCandidate(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-ink cursor-pointer active:translate-y-0.5"
            title="Delete bill"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Finance & Purchasing · FIN-03
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Accounts Payable (AP) & Bills
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Register vendor invoices, perform 3-way matching approvals, and maintain vendor aging schedules.
          </p>
        </div>

        <Button variant="lime" size="md" onClick={openCreateDrawer}>
          <Plus className="w-4 h-4 mr-1" />
          Record vendor bill
        </Button>
      </div>

      {/* AP Aging Schedule Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="neo-card p-3 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Current (Not Due)
          </span>
          <div className="font-display font-extrabold text-xl text-text mt-1">
            {formatMoney(aging.current, "$")}
          </div>
        </div>

        <div className="neo-card p-3 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            1 - 30 Days
          </span>
          <div className="font-display font-extrabold text-xl text-watch mt-1">
            {formatMoney(aging.days30, "$")}
          </div>
        </div>

        <div className="neo-card p-3 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            31 - 60 Days
          </span>
          <div className="font-display font-extrabold text-xl text-series-out mt-1">
            {formatMoney(aging.days60, "$")}
          </div>
        </div>

        <div className="neo-card p-3 bg-cream text-act">
          <span className="text-[10px] font-bold uppercase tracking-wider text-act block">
            61+ Days Past Due
          </span>
          <div className="font-display font-extrabold text-xl mt-1">
            {formatMoney(aging.days90Plus, "$")}
          </div>
        </div>

        <div className="neo-card p-3 bg-lime text-ink col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/80 block">
            Total AP Outstanding
          </span>
          <div className="font-display font-extrabold text-xl mt-1">
            {formatMoney(aging.totalOutstanding, "$")}
          </div>
        </div>
      </div>

      {/* Table & Filter Card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: "all", label: "All Bills" },
                { id: "pending_approval", label: "Needs Approval" },
                { id: "approved", label: "Approved for Payment" },
                { id: "overdue", label: "Past Due" },
                { id: "paid", label: "Paid" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 text-xs font-bold border-2 transition-all cursor-pointer ${
                  filter === t.id
                    ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                    : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-page border-line shadow-sm px-3 py-1.5 sm:w-64">
            <Search className="w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bill #, supplier…"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredBills}
          emptyTitle="No bills found"
          emptyDescription="Register vendor bills and accounts payable to track payments and expense allocations."
          onEmptyAction={openCreateDrawer}
          emptyActionLabel="Record vendor bill"
        />
      </Card>

      {/* Slide-out Create Bill Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Record Supplier Bill"
        description="Accounts Payable (FIN-03). Allocates expense to the general ledger upon approval."
        primaryActionLabel="Save & Submit for Approval"
        primaryActionVariant="lime"
        onPrimaryAction={handleSaveBill}
        secondaryActionLabel="Cancel"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bill-no"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Internal Bill # *
              </label>
              <input
                id="bill-no"
                type="text"
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono font-bold uppercase bg-page text-text border-line shadow-sm"
              />
            </div>

            <div>
              <label
                htmlFor="bill-vendor-ref"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Vendor's Invoice #
              </label>
              <input
                id="bill-vendor-ref"
                type="text"
                value={vendorRef}
                onChange={(e) => setVendorRef(e.target.value)}
                placeholder="e.g. INV-8921"
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-page text-text border-line shadow-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="bill-supplier"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Supplier Party *
            </label>
            <select
              id="bill-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.legalName || s.tradeName} ({s.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bill-date"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Bill Date *
              </label>
              <input
                id="bill-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-2 py-2 text-xs font-mono font-bold bg-page text-text border-line shadow-sm"
              />
            </div>

            <div>
              <label
                htmlFor="bill-due"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Payment Due Date *
              </label>
              <input
                id="bill-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2 py-2 text-xs font-mono font-bold bg-page text-text border-line shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bill-amount"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Bill Total ($) *
              </label>
              <input
                id="bill-amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-page text-text border-line shadow-sm"
              />
            </div>

            <div>
              <label
                htmlFor="bill-acct"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Expense Account
              </label>
              <select
                id="bill-acct"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm"
              >
                {expenseAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="bill-memo"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Memo & Items Description
            </label>
            <textarea
              id="bill-memo"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Raw steel bars delivery under PO-2026-004"
              className="w-full px-3 py-2 text-xs font-bold bg-page text-text border-line shadow-sm"
            />
          </div>
        </div>
      </Drawer>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        title="Delete Supplier Bill?"
        message={`Are you sure you want to delete "${deleteCandidate?.billNumber}" from ${deleteCandidate?.supplierName}?`}
        actionVerb="Delete Bill"
        actionVariant="pink"
        onConfirm={() => {
          if (deleteCandidate) {
            onDeleteBill(deleteCandidate.id);
            setDeleteCandidate(null);
            showToast("Supplier bill deleted", { type: "info" });
          }
        }}
      />
    </div>
  );
};
