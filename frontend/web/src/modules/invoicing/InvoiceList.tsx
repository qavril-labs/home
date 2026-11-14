import React, { useState, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/currency";
import type { Invoice } from "../../types";
import { getInvoiceStatusChip } from "./invoiceHelpers";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Calendar,
  Printer,
  CheckCircle2,
  Send,
  FileSpreadsheet,
} from "lucide-react";

export type InvoiceFilter = "all" | "draft" | "issued" | "overdue" | "paid";

export interface InvoiceListProps {
  invoices: Invoice[];
  onOpenCreate: () => void;
  onOpenEdit: (invoice: Invoice) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onOpenReminder?: (invoice: Invoice) => void;
  onOpenStatement?: (partyId: string) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onOpenCreate,
  onOpenEdit,
  onViewInvoice,
  onDeleteInvoice,
  onMarkPaid,
  onOpenReminder,
  onOpenStatement,
}) => {
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Invoice | null>(null);

  const filterTabs: { id: InvoiceFilter; label: string }[] = [
    { id: "all", label: "All Invoices" },
    { id: "issued", label: "Issued & Awaiting Payment" },
    { id: "overdue", label: "Overdue" },
    { id: "paid", label: "Paid" },
    { id: "draft", label: "Drafts" },
  ];

  const counts = useMemo(() => {
    return {
      all: invoices.length,
      issued: invoices.filter((i) => i.status === "issued" || i.status === "partially_paid").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
      paid: invoices.filter((i) => i.status === "paid").length,
      draft: invoices.filter((i) => i.status === "draft").length,
    };
  }, [invoices]);

  const filteredData = useMemo(() => {
    return invoices.filter((inv) => {
      let matchesFilter = true;
      if (filter === "issued") {
        matchesFilter = inv.status === "issued" || inv.status === "partially_paid";
      } else if (filter !== "all") {
        matchesFilter = inv.status === filter;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.partyName.toLowerCase().includes(q) ||
        (inv.notes && inv.notes.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [invoices, filter, searchQuery]);

  const columns: Column<Invoice>[] = [
    {
      header: "Invoice #",
      accessorKey: "invoiceNumber",
      cell: (r) => (
        <div>
          <button
            type="button"
            onClick={() => onViewInvoice(r)}
            className="font-mono font-bold text-xs text-text hover:text-series-in underline text-left"
          >
            {r.invoiceNumber}
          </button>
          <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>Issued: {r.issueDate}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Customer Party",
      accessorKey: "partyName",
      cell: (r) => (
        <div>
          {onOpenStatement ? (
            <button
              type="button"
              onClick={() => onOpenStatement(r.partyId)}
              className="font-bold text-xs text-text hover:text-series-in underline text-left cursor-pointer"
              title="Open Customer Statement"
            >
              {r.partyName}
            </button>
          ) : (
            <div className="font-bold text-xs text-text">{r.partyName}</div>
          )}
          {r.partyTaxId && (
            <div className="text-[10px] font-mono text-muted">Tax ID: {r.partyTaxId}</div>
          )}
        </div>
      ),
    },
    {
      header: "Due Date",
      accessorKey: "dueDate",
      cell: (r) => {
        const isOverdue = r.status === "overdue";
        return (
          <span
            className={`font-mono text-xs font-bold ${
              isOverdue ? "text-act bg-cream px-1.5 py-0.5 border border-act" : "text-muted"
            }`}
          >
            {r.dueDate}
          </span>
        );
      },
    },
    {
      header: "Total",
      accessorKey: "total",
      align: "right",
      cell: (r) => (
        <span className="font-mono font-bold text-xs text-text">
          {formatMoney(r.total, "$")}
        </span>
      ),
    },
    {
      header: "Balance Due",
      accessorKey: "balanceDue",
      align: "right",
      cell: (r) => (
        <span
          className={`font-mono font-bold text-xs ${
            r.status === "paid" ? "text-good" : "text-series-in"
          }`}
        >
          {formatMoney(r.balanceDue, "$")}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (r) => {
        const chip = getInvoiceStatusChip(r.status);
        return <StatusChip status={chip.status} label={chip.label} />;
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {onOpenStatement && (
            <button
              type="button"
              onClick={() => onOpenStatement(r.partyId)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-cyan text-ink cursor-pointer active:translate-y-0.5"
              title="Customer Statement (FIN-02)"
              aria-label={`View statement for ${r.partyName}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenReminder && r.status !== "paid" && r.status !== "draft" && (
            <button
              type="button"
              onClick={() => onOpenReminder(r)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-yellow text-ink cursor-pointer active:translate-y-0.5"
              title="Chase Chloe Payment Reminder (FIN-14)"
              aria-label={`Send payment reminder for ${r.invoiceNumber}`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onViewInvoice(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-cream text-ink cursor-pointer active:translate-y-0.5"
            title="Preview / Print invoice"
            aria-label={`Preview ${r.invoiceNumber}`}
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {r.status !== "paid" && (
            <button
              type="button"
              onClick={() => onMarkPaid(r.id)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime text-ink cursor-pointer active:translate-y-0.5"
              title="Record payment received"
              aria-label={`Record payment for ${r.invoiceNumber}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenEdit(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-lime text-ink cursor-pointer active:translate-y-0.5"
            title="Edit invoice"
            aria-label={`Edit ${r.invoiceNumber}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setDeleteCandidate(r)}
            className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-ink cursor-pointer active:translate-y-0.5"
            title="Delete invoice"
            aria-label={`Delete ${r.invoiceNumber}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((t) => {
            const count = counts[t.id];
            const isActive = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                    : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                    isActive ? "bg-ink text-white" : "bg-page text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-page border-line shadow-sm px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer…"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
          </div>

          <Button variant="lime" size="sm" onClick={onOpenCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New invoice
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredData}
          emptyTitle="No invoices found"
          emptyDescription="Issue sales invoices to track customer receivables and post ledger sales entries."
          onEmptyAction={onOpenCreate}
          emptyActionLabel="Create first invoice"
        />
      </Card>

      {/* Confirm Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        title="Delete Sales Invoice?"
        message={`Are you sure you want to delete "${deleteCandidate?.invoiceNumber}" issued to ${deleteCandidate?.partyName}? This action cannot be undone.`}
        actionVerb="Delete Invoice"
        actionVariant="pink"
        onConfirm={() => {
          if (deleteCandidate) {
            onDeleteInvoice(deleteCandidate.id);
            setDeleteCandidate(null);
          }
        }}
      />
    </div>
  );
};
