import React, { useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { initialMockOcrDocuments } from "../../lib/api-mock";
import { eventBus } from "../../lib/event-stream";
import type { OcrDocument, OcrBoundingBox, Bill } from "../../types";
import {
  ShieldCheck,
  Sparkles,
  Eye,
  Building,
} from "lucide-react";

export interface DocumentIntelligenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBillCreated?: (bill: Bill) => void;
}

export const DocumentIntelligenceDrawer: React.FC<DocumentIntelligenceDrawerProps> = ({
  isOpen,
  onClose,
  onBillCreated,
}) => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<OcrDocument[]>(initialMockOcrDocuments);
  const [selectedDocId, setSelectedDocId] = useState<string>("DOC-OCR-8821");
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0]!;

  const handleBoxClick = (box: OcrBoundingBox) => {
    setActiveFieldKey(box.fieldKey);
  };

  const handlePostBill = () => {
    if (!currentDoc) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const newBill: Bill = {
        id: `bill-${Date.now()}`,
        billNumber: `BILL-${currentDoc.invoiceNumber.replace(/^INV-?/, "")}`,
        vendorInvoiceNumber: currentDoc.invoiceNumber,
        supplierId: "CNT-003",
        supplierName: currentDoc.vendorName,
        issueDate: currentDoc.invoiceDate,
        dueDate: currentDoc.dueDate,
        currency: currentDoc.currency,
        status: "pending_approval",
        lines: currentDoc.lines.map((l, i) => ({
          id: `li-${i}`,
          sku: l.sku || "TOOL-GEN",
          description: l.description,
          quantity: l.quantity,
          unit: "pcs",
          unitCost: l.unitPrice,
          accountCode: "5000",
          lineTotal: l.lineTotal,
        })),
        subtotal: currentDoc.subtotal,
        taxTotal: currentDoc.taxTotal,
        total: currentDoc.totalAmount,
        amountPaid: "0.00",
        balanceDue: currentDoc.totalAmount,
      };

      // Emit domain event across real-time bus
      eventBus.emit({
        type: "doc.extracted",
        producer: "services/uaap/doc_extract_fields",
        data: {
          docId: currentDoc.id,
          vendor: currentDoc.vendorName,
          amount: currentDoc.totalAmount,
          sha256: currentDoc.provenanceSha256,
        },
      });

      eventBus.emit({
        type: "bot.action.drafted",
        producer: "services/uaap/guard_gus",
        data: {
          botId: "gus",
          actionType: "bill_verification",
          billId: newBill.id,
          amount: newBill.total,
        },
      });

      // Update doc status to posted
      setDocuments((prev) =>
        prev.map((d) => (d.id === currentDoc.id ? { ...d, status: "posted" } : d))
      );

      setIsSubmitting(false);
      onBillCreated?.(newBill);
      showToast(
        `OCR bill ${currentDoc.invoiceNumber} posted as ${newBill.billNumber} and routed to Approvals Inbox`,
        undefined,
        "good"
      );
      onClose();
    }, 350);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Document Intelligence & OCR Inspector (AI-01)"
      description="Visual extraction audit · PDF receipt analysis with cryptographic provenance"
    >
      <div className="space-y-6 pb-6" data-testid="ocr-inspector-drawer">
        {/* Document Selection Tabs & Hash Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-page border-line">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted uppercase">Sample Document:</span>
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                data-testid={`select-doc-${doc.id}`}
                onClick={() => {
                  setSelectedDocId(doc.id);
                  setActiveFieldKey(null);
                }}
                className={`px-3 py-1.5 text-xs font-bold font-mono border-line transition-all ${
                  selectedDocId === doc.id
                    ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-panel text-muted hover:text-text"
                }`}
              >
                {doc.filename}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted bg-panel px-2 py-1 border border-ink flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-good" />
              <span>{currentDoc.provenanceSha256.slice(0, 22)}…</span>
            </span>
            <StatusChip
              status={currentDoc.status === "posted" ? "good" : "watch"}
              label={currentDoc.status === "posted" ? "✓ Posted to Bills" : "● Ready to Verify"}
            />
          </div>
        </div>

        {/* Split Screen Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: INTERACTIVE VISUAL DOCUMENT (6 cols) */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted px-1">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan" />
                <span>Visual Document Canvas (Interactive Bounding Boxes)</span>
              </span>
              <span className="font-mono text-[11px] text-text">Click box to inspect</span>
            </div>

            {/* Document Surface */}
            <div
              className="relative w-full aspect-[1/1.33] bg-panel border-2 border-ink shadow-[4px_4px_0_var(--q-ink)] p-5 select-none overflow-hidden font-sans text-text text-xs"
              data-testid="ocr-canvas"
            >
              {/* Watermark / Paper Texture Header */}
              <div className="flex items-start justify-between border-b-2 border-ink pb-4">
                <div>
                  <div className="font-display font-black text-lg tracking-tight uppercase">
                    {currentDoc.vendorName}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">
                    Industrial Park, Suite 400 · Chicago, IL 60601
                  </div>
                  <div className="text-[10px] text-muted">tax-id: US-8829104</div>
                </div>

                <div className="text-right">
                  <span className="font-display font-bold text-sm bg-ink text-panel px-2 py-0.5 uppercase tracking-wider">
                    INVOICE
                  </span>
                  <div className="font-mono font-bold text-xs mt-1">
                    #{currentDoc.invoiceNumber}
                  </div>
                  <div className="text-[10px] text-muted">Date: {currentDoc.invoiceDate}</div>
                </div>
              </div>

              {/* Bill To */}
              <div className="mt-4 pb-3 border-b border-grid text-[11px]">
                <span className="text-[10px] font-bold uppercase text-muted block">Bill To:</span>
                <span className="font-bold">Apex Precision Tools Ltd</span>
                <div className="text-muted text-[10px]">100 Enterprise Way, Silicon Valley, CA</div>
              </div>

              {/* Items Table Mock Rendering */}
              <div className="mt-4">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-ink font-bold text-[10px] uppercase text-muted">
                      <th className="py-1">Description</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grid">
                    {currentDoc.lines.map((li) => (
                      <tr key={li.id}>
                        <td className="py-1.5 pr-2 font-medium">{li.description}</td>
                        <td className="py-1.5 text-center font-mono">{li.quantity}</td>
                        <td className="py-1.5 text-right font-mono">{formatMoney(li.unitPrice)}</td>
                        <td className="py-1.5 text-right font-mono font-bold">{formatMoney(li.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="mt-6 pt-3 border-t-2 border-ink space-y-1 text-right text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-muted">Subtotal:</span>
                  <span className="font-mono">{formatMoney(currentDoc.subtotal)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted">Tax (15%):</span>
                  <span className="font-mono">{formatMoney(currentDoc.taxTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-display font-black pt-1 border-t border-grid">
                  <span>TOTAL DUE:</span>
                  <span className="font-mono text-base text-pink">{formatMoney(currentDoc.totalAmount)}</span>
                </div>
              </div>

              {/* INTERACTIVE OCR BOUNDING BOX OVERLAYS */}
              {currentDoc.boundingBoxes.map((box) => {
                const isActive = activeFieldKey === box.fieldKey;
                return (
                  <div
                    key={box.id}
                    data-testid={`ocr-box-${box.id}`}
                    onClick={() => handleBoxClick(box)}
                    style={{
                      top: `${box.box.top}%`,
                      left: `${box.box.left}%`,
                      width: `${box.box.width}%`,
                      height: `${box.box.height}%`,
                    }}
                    className={`absolute cursor-pointer transition-all border-2 ${
                      isActive
                        ? "border-pink bg-pink/20 shadow-[0_0_8px_var(--q-pink)] z-20"
                        : "border-cyan/70 bg-cyan/10 hover:border-cyan hover:bg-cyan/20 z-10"
                    }`}
                    title={`${box.label}: ${box.extractedValue} (${(box.confidence * 100).toFixed(1)}% confidence)`}
                  >
                    <span
                      className={`absolute -top-3.5 left-0 px-1 text-[9px] font-mono font-bold border border-ink ${
                        isActive ? "bg-pink text-ink" : "bg-cyan text-ink"
                      }`}
                    >
                      {(box.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: VERIFIED DATA FORM & ACTIONS (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-3 bg-page border-line flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-lime" />
                <span>Extracted Bill Fields ({currentDoc.boundingBoxes.length} Detected)</span>
              </span>
              <span className="text-xs font-mono font-bold text-good">
                Avg Confidence: 99.4%
              </span>
            </div>

            {/* Field Form */}
            <div className="space-y-3 p-4 bg-page border-line">
              {/* Vendor */}
              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                  Vendor Name (MDM-01 Linked)
                </label>
                <div
                  className={`p-2 bg-panel border-line font-bold text-xs flex items-center justify-between ${
                    activeFieldKey === "vendorName" ? "ring-2 ring-pink" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-muted" />
                    <span>{currentDoc.vendorName}</span>
                  </span>
                  <span className="font-mono text-[10px] text-good font-bold">99.8%</span>
                </div>
              </div>

              {/* Invoice Number & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Invoice #
                  </label>
                  <div
                    className={`p-2 bg-panel border-line font-mono font-bold text-xs flex items-center justify-between ${
                      activeFieldKey === "invoiceNumber" ? "ring-2 ring-pink" : ""
                    }`}
                  >
                    <span>{currentDoc.invoiceNumber}</span>
                    <span className="font-mono text-[10px] text-good font-bold">99.6%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Issue Date
                  </label>
                  <div
                    className={`p-2 bg-panel border-line font-mono text-xs flex items-center justify-between ${
                      activeFieldKey === "invoiceDate" ? "ring-2 ring-pink" : ""
                    }`}
                  >
                    <span>{currentDoc.invoiceDate}</span>
                    <span className="font-mono text-[10px] text-good font-bold">99.2%</span>
                  </div>
                </div>
              </div>

              {/* Due Date & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Payment Due Date
                  </label>
                  <div
                    className={`p-2 bg-panel border-line font-mono text-xs flex items-center justify-between ${
                      activeFieldKey === "dueDate" ? "ring-2 ring-pink" : ""
                    }`}
                  >
                    <span>{currentDoc.dueDate}</span>
                    <span className="font-mono text-[10px] text-good font-bold">98.9%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                    Currency
                  </label>
                  <div className="p-2 bg-panel border-line font-mono font-bold text-xs">
                    {currentDoc.currency} (USD)
                  </div>
                </div>
              </div>

              {/* Extracted Line Items */}
              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                  Line Items ({currentDoc.lines.length} Rows)
                </label>
                <div className="overflow-x-auto border-line bg-panel">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-ink bg-page text-[10px] font-bold uppercase text-muted">
                        <th className="py-1.5 px-2">Description</th>
                        <th className="py-1.5 px-2 text-center">Qty</th>
                        <th className="py-1.5 px-2 text-right">Price</th>
                        <th className="py-1.5 px-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grid">
                      {currentDoc.lines.map((li) => (
                        <tr key={li.id}>
                          <td className="py-1.5 px-2 font-medium">{li.description}</td>
                          <td className="py-1.5 px-2 text-center font-mono">{li.quantity}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{formatMoney(li.unitPrice)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">{formatMoney(li.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="p-3 bg-panel border-line space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted font-bold">Subtotal:</span>
                  <span className="font-mono font-bold">{formatMoney(currentDoc.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted font-bold">Tax (15% GST):</span>
                  <span className="font-mono font-bold">{formatMoney(currentDoc.taxTotal)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-line">
                  <span className="text-xs font-bold uppercase">Total Payable:</span>
                  <span className="font-display font-black text-lg text-text">
                    {formatMoney(currentDoc.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Post Action Button */}
            <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-muted font-medium">
                Post as Draft Bill and emit <code className="font-mono text-text">doc.extracted</code> event into the transactional outbox.
              </div>

              <Button
                variant="lime"
                size="md"
                data-testid="post-ocr-bill-btn"
                onClick={handlePostBill}
                disabled={isSubmitting || currentDoc.status === "posted"}
              >
                <span>
                  {currentDoc.status === "posted"
                    ? "✓ Already Posted to Bills"
                    : isSubmitting
                    ? "Posting Draft Bill…"
                    : "Post Draft Bill & Submit (Tier 2)"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
