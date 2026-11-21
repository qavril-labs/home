import React, { useState } from "react";
import { InvoiceList } from "../modules/invoicing/InvoiceList";
import { InvoiceDrawer } from "../modules/invoicing/InvoiceDrawer";
import { InvoicePreviewModal } from "../modules/invoicing/InvoicePreviewModal";
import { CustomerStatementDrawer } from "../modules/bots/CustomerStatementDrawer";
import { SendReminderModal } from "../modules/bots/SendReminderModal";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import { initialMockInvoicesSummary } from "../lib/api-mock";
import { apiClient, describeReminderOutcome } from "../lib/api-client";
import type {
  CustomerStatement,
  Invoice,
  InvoicesSummary,
  OverdueInvoice,
  Party,
  ProductItem,
  ReminderDraft,
} from "../types";
import { Plus, AlertTriangle, Bot, FileSpreadsheet, Radio } from "lucide-react";

export interface InvoicesPageProps {
  invoices: Invoice[];
  summary?: InvoicesSummary;
  parties: Party[];
  catalogItems: ProductItem[];
  isLiveApi?: boolean;
  onAddInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onMarkPaidInvoice: (id: string) => void;
  onNavigateToChaseChloe?: () => void;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  invoices,
  summary = initialMockInvoicesSummary,
  parties,
  catalogItems,
  isLiveApi = false,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onMarkPaidInvoice,
  onNavigateToChaseChloe,
}) => {
  const { showToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [activeStatement, setActiveStatement] = useState<CustomerStatement | null>(null);
  const [reminderCandidate, setReminderCandidate] = useState<OverdueInvoice | null>(null);

  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const handleOpenCreate = () => {
    setEditingInvoice(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setIsDrawerOpen(true);
  };

  const handleSave = (inv: Invoice) => {
    const isExisting = invoices.some((i) => i.id === inv.id);
    if (isExisting) {
      onUpdateInvoice(inv);
      showToast(`Updated invoice ${inv.invoiceNumber}`, { type: "success" });
    } else {
      onAddInvoice(inv);
      showToast(`Issued invoice ${inv.invoiceNumber}`, { type: "success" });
    }
    setIsDrawerOpen(false);
  };

  const handleDelete = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    onDeleteInvoice(id);
    showToast(`Deleted invoice ${inv?.invoiceNumber || id}`, { type: "info" });
  };

  const handleMarkPaid = (id: string) => {
    onMarkPaidInvoice(id);
    showToast("Recorded payment received in full", { type: "success" });
  };

  const handleOpenStatement = async (partyId: string) => {
    const party = parties.find((p) => p.id === partyId);
    const res = await apiClient.getCustomerStatement(partyId, party, invoices);
    setActiveStatement(res.data);
  };

  const handleOpenReminder = (inv: Invoice) => {
    const party = parties.find((p) => p.id === inv.partyId);
    const overdueModel = apiClient.buildOverdueInvoiceForReminder(inv, party);
    setReminderCandidate(overdueModel);
  };

  const handleSendReminder = async (draft: ReminderDraft) => {
    const result = await apiClient.sendPaymentReminder(draft.invoiceId, draft);
    const outcome = describeReminderOutcome(result, draft.recipient);
    showToast(outcome.text, { type: outcome.type });
    // Close the modal only when the server took the reminder; otherwise keep it open to retry.
    if (result.isLive) setReminderCandidate(null);
  };

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-pink">
              Sales & Receivables · SAL-04 / FIN-02 / FIN-14
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold border border-ink ${
                isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
              }`}
            >
              <Radio className="w-3 h-3" />
              {isLiveApi ? "LIVE HTTP · /v1/invoicing/invoices" : "CONTRACT CLIENT · /v1/invoicing/invoices"}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Sales Invoices & Receivables
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Issue sales invoices, inspect customer ledger statements, and dispatch Chase Chloe receivables reminders with zero browser money math.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToChaseChloe && (
            <Button variant="yellow" size="md" onClick={onNavigateToChaseChloe}>
              <Bot className="w-4 h-4 mr-1.5" />
              Chase Chloe Queue ({overdueCount})
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              const firstCustomer =
                parties.find((p) => p.type === "customer" || p.type === "both") ||
                parties[0];
              if (firstCustomer) {
                void handleOpenStatement(firstCustomer.id);
              }
            }}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Customer Statements
          </Button>
          <Button variant="lime" size="md" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New invoice
          </Button>
        </div>
      </div>

      {/* KPI Tiles per UI Contract (strictly API decimal strings formatted via formatMoney) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-panel">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Total Receivables (AR)
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl text-series-in mt-1">
            {formatMoney(summary.totalReceivable, "$")}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            Awaiting customer payment
          </span>
        </div>

        <div
          className={`neo-card p-4 ${
            overdueCount > 0 ? "bg-cream text-act" : "bg-panel text-good"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Overdue Invoices
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1 flex items-center gap-1.5">
            {overdueCount > 0 && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            <span>{formatMoney(summary.overdue, "$")}</span>
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            {overdueCount} {overdueCount === 1 ? "invoice past due" : "invoices past due"}
          </span>
        </div>

        <div className="neo-card p-4 bg-lime text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Collected Receipts
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {formatMoney(summary.paidThisMonth, "$")}
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            Paid in full to date
          </span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Total Documents
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl text-text mt-1">
            {invoices.length}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            Across all billing statuses
          </span>
        </div>
      </div>

      {/* Invoice List Table Component */}
      <InvoiceList
        invoices={invoices}
        onOpenCreate={handleOpenCreate}
        onOpenEdit={handleOpenEdit}
        onViewInvoice={(inv) => setPreviewInvoice(inv)}
        onDeleteInvoice={handleDelete}
        onMarkPaid={handleMarkPaid}
        onOpenReminder={handleOpenReminder}
        onOpenStatement={(partyId) => void handleOpenStatement(partyId)}
      />

      {/* Slide-out Invoice Drawer */}
      <InvoiceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        parties={parties}
        catalogItems={catalogItems}
        editingInvoice={editingInvoice}
        onSave={handleSave}
      />

      {/* Invoice Printable Preview Modal */}
      <InvoicePreviewModal
        isOpen={Boolean(previewInvoice)}
        onClose={() => setPreviewInvoice(null)}
        invoice={previewInvoice}
        onMarkPaid={handleMarkPaid}
      />

      {/* Customer Statement Viewer Drawer (FIN-02) */}
      <CustomerStatementDrawer
        isOpen={Boolean(activeStatement)}
        onClose={() => setActiveStatement(null)}
        statement={activeStatement}
      />

      {/* Chase Chloe Reminder Workflow Modal (FIN-14) */}
      <SendReminderModal
        isOpen={Boolean(reminderCandidate)}
        onClose={() => setReminderCandidate(null)}
        invoice={reminderCandidate}
        onSendReminder={(draft) => void handleSendReminder(draft)}
      />
    </div>
  );
};
