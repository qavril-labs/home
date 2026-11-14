import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { Invoice, InvoiceLineItem, ProductItem, Party } from "../../types";
import {
  calculateLineTotal,
  calculateInvoiceTotals,
} from "./invoiceHelpers";
import { Plus, Trash2, FileText, AlertCircle, User } from "lucide-react";

export interface InvoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parties: Party[];
  catalogItems: ProductItem[];
  editingInvoice?: Invoice | null;
  onSave: (invoice: Invoice) => void;
}

const TAX_RATE_MAP: Record<string, string> = {
  "TAX-STD": "0.15",
  "TAX-REDUCED": "0.05",
  "TAX-ZERO": "0.00",
  "TAX-EXEMPT": "0.00",
};

export const InvoiceDrawer: React.FC<InvoiceDrawerProps> = ({
  isOpen,
  onClose,
  parties,
  catalogItems,
  editingInvoice,
  onSave,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [partyId, setPartyId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0] || "2026-11-10");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0] || "2026-12-10";
  });
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [lines, setLines] = useState<InvoiceLineItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customerParties = parties.filter((p) => p.type === "customer" || p.type === "both");

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (editingInvoice) {
      setInvoiceNumber(editingInvoice.invoiceNumber);
      setPartyId(editingInvoice.partyId);
      setIssueDate(editingInvoice.issueDate);
      setDueDate(editingInvoice.dueDate);
      setNotes(editingInvoice.notes || "");
      setPaymentTerms(editingInvoice.paymentTerms || "Net 30");
      setLines(editingInvoice.lines.map((l) => ({ ...l })));
    } else {
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setPartyId(customerParties[0]?.id || "");
      const today = new Date().toISOString().split("T")[0] || "2026-11-10";
      setIssueDate(today);
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split("T")[0] || "2026-12-10");
      setNotes("Thank you for your business. Please include invoice number on bank transfer.");
      setPaymentTerms("Net 30");

      // Default line item if catalog available
      if (catalogItems.length > 0 && catalogItems[0]) {
        const item = catalogItems[0];
        setLines([
          {
            id: `line-${Date.now()}-1`,
            itemId: item.id,
            sku: item.sku,
            description: item.name,
            quantity: 1,
            unit: item.unit,
            unitPrice: item.unitPrice,
            taxCode: item.taxCode || "TAX-STD",
            taxRate: TAX_RATE_MAP[item.taxCode || "TAX-STD"] || "0.15",
            lineTotal: calculateLineTotal(1, item.unitPrice),
          },
        ]);
      } else {
        setLines([
          {
            id: `line-${Date.now()}-1`,
            sku: "SRV-GEN-01",
            description: "Professional Engineering Services",
            quantity: 1,
            unit: "hrs",
            unitPrice: "125.00",
            taxCode: "TAX-STD",
            taxRate: "0.15",
            lineTotal: "125.00",
          },
        ]);
      }
    }
  }, [isOpen, editingInvoice]);

  const handleAddLine = () => {
    const firstItem = catalogItems[0];
    const newLine: InvoiceLineItem = firstItem
      ? {
          id: `line-${Date.now()}-${lines.length + 1}`,
          itemId: firstItem.id,
          sku: firstItem.sku,
          description: firstItem.name,
          quantity: 1,
          unit: firstItem.unit,
          unitPrice: firstItem.unitPrice,
          taxCode: firstItem.taxCode || "TAX-STD",
          taxRate: TAX_RATE_MAP[firstItem.taxCode || "TAX-STD"] || "0.15",
          lineTotal: calculateLineTotal(1, firstItem.unitPrice),
        }
      : {
          id: `line-${Date.now()}-${lines.length + 1}`,
          sku: "ITEM-GEN",
          description: "General Service or Part",
          quantity: 1,
          unit: "pcs",
          unitPrice: "50.00",
          taxCode: "TAX-STD",
          taxRate: "0.15",
          lineTotal: "50.00",
        };

    setLines((prev) => [...prev, newLine]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) {
      setErrorMsg("An invoice must contain at least one line item.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleLineChange = (
    id: string,
    field: keyof InvoiceLineItem,
    val: string | number
  ) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: val };

        // Item picker auto-fill
        if (field === "itemId") {
          const matched = catalogItems.find((it) => it.id === val);
          if (matched) {
            updated.sku = matched.sku;
            updated.description = matched.name;
            updated.unit = matched.unit;
            updated.unitPrice = matched.unitPrice;
            updated.taxCode = matched.taxCode || "TAX-STD";
            updated.taxRate = TAX_RATE_MAP[updated.taxCode] || "0.15";
          }
        }

        if (field === "taxCode") {
          updated.taxRate = TAX_RATE_MAP[String(val)] || "0.00";
        }

        if (field === "quantity" || field === "unitPrice" || field === "itemId") {
          updated.lineTotal = calculateLineTotal(updated.quantity, updated.unitPrice);
        }

        return updated;
      })
    );
  };

  const totals = calculateInvoiceTotals(lines);

  const handleSubmit = (targetStatus: "draft" | "issued") => {
    const selectedParty = parties.find((p) => p.id === partyId);

    if (!partyId || !selectedParty) {
      setErrorMsg("Please select a customer party for this invoice.");
      return;
    }
    if (lines.length === 0) {
      setErrorMsg("Please add at least one line item.");
      return;
    }

    const savedInvoice: Invoice = {
      id: editingInvoice?.id || `INV-${Date.now().toString().slice(-4)}`,
      invoiceNumber: invoiceNumber.trim().toUpperCase(),
      partyId: selectedParty.id,
      partyName: selectedParty.legalName || selectedParty.tradeName,
      partyTaxId: selectedParty.taxRegistrationNumber,
      issueDate,
      dueDate,
      currency: "USD",
      status: editingInvoice ? (editingInvoice.status === "draft" ? targetStatus : editingInvoice.status) : targetStatus,
      lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: editingInvoice?.amountPaid || "0.00",
      balanceDue: editingInvoice ? editingInvoice.balanceDue : totals.total,
      notes,
      paymentTerms,
    };

    onSave(savedInvoice);
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingInvoice ? `Edit ${editingInvoice.invoiceNumber}` : "Create Sales Invoice"}
      description="Sales & Customer Invoicing (SAL-04). Postable directly to accounts receivable."
      primaryActionLabel={editingInvoice ? "Save Changes" : "Issue Invoice"}
      primaryActionVariant="lime"
      onPrimaryAction={() => handleSubmit("issued")}
      secondaryActionLabel="Cancel"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 bg-cream border-line text-act text-xs font-bold shadow-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Invoice Number & Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="inv-number"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Invoice Number *
            </label>
            <div className="relative">
              <input
                id="inv-number"
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2026-0001"
                className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold uppercase bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
              <FileText className="w-4 h-4 text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label
              htmlFor="inv-customer"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Customer Party *
            </label>
            <div className="relative">
              <select
                id="inv-customer"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              >
                {customerParties.length === 0 ? (
                  <option value="">No customers registered</option>
                ) : (
                  customerParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legalName || p.tradeName} ({p.id})
                    </option>
                  ))
                )}
              </select>
              <User className="w-4 h-4 text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Dates & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="inv-issue-date"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Issue Date *
            </label>
            <div className="relative">
              <input
                id="inv-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-2 py-2 text-xs font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="inv-due-date"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Due Date *
            </label>
            <div className="relative">
              <input
                id="inv-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2 py-2 text-xs font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="inv-terms"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Payment Terms
            </label>
            <select
              id="inv-terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-2 py-2 text-xs font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            >
              <option value="Due on Receipt">Due on Receipt</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="border-t-line pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Line Items ({lines.length})
            </span>
            <Button variant="ghost" size="sm" onClick={handleAddLine} type="button">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add item
            </Button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="p-3 bg-page border-line shadow-sm space-y-2 relative"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold text-muted">
                    #{idx + 1}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      className="text-muted hover:text-act p-1"
                      title="Remove line"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Catalog Item picker or description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                      Item / Product
                    </label>
                    <select
                      value={line.itemId || ""}
                      onChange={(e) => handleLineChange(line.id, "itemId", e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold bg-panel text-text border-line"
                    >
                      <option value="">Custom Item</option>
                      {catalogItems.map((ci) => (
                        <option key={ci.id} value={ci.id}>
                          {ci.sku} - {ci.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => handleLineChange(line.id, "description", e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold bg-panel text-text border-line"
                    />
                  </div>
                </div>

                {/* Quantity, Unit, Price, Tax, Total */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) =>
                        handleLineChange(line.id, "quantity", parseInt(e.target.value, 10) || 1)
                      }
                      className="w-full px-2 py-1 text-xs font-mono font-bold bg-panel text-text border-line"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                      Unit Price ($)
                    </label>
                    <input
                      type="text"
                      value={line.unitPrice}
                      onChange={(e) => handleLineChange(line.id, "unitPrice", e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold bg-panel text-text border-line"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                      Tax Code
                    </label>
                    <select
                      value={line.taxCode}
                      onChange={(e) => handleLineChange(line.id, "taxCode", e.target.value)}
                      className="w-full px-1 py-1 text-[11px] font-mono font-bold bg-panel text-text border-line"
                    >
                      <option value="TAX-STD">15% STD</option>
                      <option value="TAX-REDUCED">5% RED</option>
                      <option value="TAX-ZERO">0% ZERO</option>
                      <option value="TAX-EXEMPT">0% EXEMPT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5 text-right">
                      Line Total
                    </label>
                    <div className="px-2 py-1 text-xs font-mono font-bold text-right text-text bg-cream border-line">
                      {formatMoney(line.lineTotal, "$")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Summary Box */}
        <div className="neo-card p-4 bg-page space-y-1.5 border-line font-mono text-xs">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span className="font-bold text-text">{formatMoney(totals.subtotal, "$")}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Estimated Sales Tax</span>
            <span className="font-bold text-text">{formatMoney(totals.taxTotal, "$")}</span>
          </div>
          <div className="border-t border-grid pt-1.5 flex justify-between text-sm font-bold text-text">
            <span>Total Amount Due</span>
            <span className="text-series-in font-display font-extrabold text-base">
              {formatMoney(totals.total, "$")}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="inv-notes"
            className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
          >
            Customer Notes & Payment Instructions
          </label>
          <textarea
            id="inv-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
          />
        </div>
      </div>
    </Drawer>
  );
};
