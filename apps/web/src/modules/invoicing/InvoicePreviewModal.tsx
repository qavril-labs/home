import React from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { formatMoney } from "../../lib/currency";
import type { Invoice } from "../../types";
import { getInvoiceStatusChip } from "./invoiceHelpers";
import { CheckCircle2 } from "lucide-react";

export interface InvoicePreviewModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaid?: (id: string) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onMarkPaid,
}) => {
  if (!invoice) return null;

  const chip = getInvoiceStatusChip(invoice.status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invoice ${invoice.invoiceNumber}`}
      description="Printable tax invoice format following standard billing conventions."
      primaryActionLabel="Print Invoice"
      primaryActionVariant="lime"
      onPrimaryAction={() => window.print()}
      secondaryActionLabel="Close"
    >
      <div className="space-y-6 print:p-0">
        {/* Invoice Top Branding */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-line pb-4 bg-page p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 bg-lime border-line flex items-center justify-center font-display font-black text-ink text-sm">
                Q
              </span>
              <span className="font-display font-extrabold text-base tracking-tight uppercase">
                QAVRIL<span className="text-pink">/</span>LABS
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Apex Precision Tools Ltd · Industrial City, TX 75001
            </p>
          </div>

          <div className="text-right sm:text-right">
            <span className="font-display font-black text-2xl uppercase tracking-tight block">
              {invoice.invoiceNumber}
            </span>
            <div className="mt-1">
              <StatusChip status={chip.status} label={chip.label} />
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-page border-line">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
              Billed To
            </span>
            <div className="font-bold text-sm text-text font-body">{invoice.partyName}</div>
            {invoice.partyTaxId && (
              <div className="text-muted mt-0.5">Tax Registration: {invoice.partyTaxId}</div>
            )}
            <div className="text-muted mt-0.5">Customer ID: {invoice.partyId}</div>
          </div>

          <div className="p-3 bg-page border-line space-y-1">
            <div className="flex justify-between">
              <span className="text-muted uppercase">Issue Date:</span>
              <span className="font-bold">{invoice.issueDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted uppercase">Due Date:</span>
              <span className="font-bold">{invoice.dueDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted uppercase">Terms:</span>
              <span className="font-bold">{invoice.paymentTerms || "Net 30"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted uppercase">Currency:</span>
              <span className="font-bold">{invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border-line overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-page border-b-line font-bold">
                <th className="p-2.5">Item & Description</th>
                <th className="p-2.5 text-center">Qty</th>
                <th className="p-2.5 text-right">Unit Price</th>
                <th className="p-2.5 text-center">Tax</th>
                <th className="p-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-b border-grid">
                  <td className="p-2.5">
                    <div className="font-bold text-text">{l.description}</div>
                    <div className="font-mono text-[10px] text-muted">SKU: {l.sku}</div>
                  </td>
                  <td className="p-2.5 text-center font-mono">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="p-2.5 text-right font-mono">
                    {formatMoney(l.unitPrice, "$")}
                  </td>
                  <td className="p-2.5 text-center font-mono text-[11px] text-muted">
                    {l.taxCode}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold">
                    {formatMoney(l.lineTotal, "$")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 font-mono text-xs">
          <div className="p-3 bg-page border-line flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
              Payment Instructions
            </span>
            <p className="text-muted text-[11px] leading-relaxed">
              {invoice.notes || "Transfer funds directly to company account quoting invoice number."}
            </p>
          </div>

          <div className="p-3 bg-cream border-line w-full sm:w-64 space-y-1.5">
            <div className="flex justify-between text-muted">
              <span>Subtotal:</span>
              <span className="font-bold text-text">{formatMoney(invoice.subtotal, "$")}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Sales Tax:</span>
              <span className="font-bold text-text">{formatMoney(invoice.taxTotal, "$")}</span>
            </div>
            <div className="border-t border-ink pt-1 flex justify-between font-bold text-sm">
              <span>Total:</span>
              <span className="text-series-in font-display font-black text-base">
                {formatMoney(invoice.total, "$")}
              </span>
            </div>
            <div className="flex justify-between text-good text-xs pt-1 border-t border-grid">
              <span>Paid:</span>
              <span className="font-bold">{formatMoney(invoice.amountPaid, "$")}</span>
            </div>
            <div className="flex justify-between text-act text-xs font-bold">
              <span>Balance Due:</span>
              <span>{formatMoney(invoice.balanceDue, "$")}</span>
            </div>
          </div>
        </div>

        {/* Quick action bar */}
        {invoice.status !== "paid" && onMarkPaid && (
          <div className="flex justify-end pt-2">
            <Button
              variant="lime"
              size="sm"
              type="button"
              onClick={() => {
                onMarkPaid(invoice.id);
                onClose();
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Record Full Payment Received
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
