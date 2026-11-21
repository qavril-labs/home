import React, { useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { formatMoney } from "../../lib/currency";
import { INITIAL_THREE_WAY_MATCH_AUDITS, type ThreeWayMatchAudit } from "../../lib/three-way-match";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";

export interface ThreeWayMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThreeWayMatchModal: React.FC<ThreeWayMatchModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [audits, setAudits] = useState<ThreeWayMatchAudit[]>(INITIAL_THREE_WAY_MATCH_AUDITS);
  const [selectedAuditId, setSelectedAuditId] = useState<string>("PO-2026-004");

  const currentAudit = audits.find((a) => a.poNumber === selectedAuditId) || audits[0]!;

  const handleApproveBill = (poNum: string) => {
    setAudits((prev) =>
      prev.map((a) => (a.poNumber === poNum ? { ...a, autoApproveEligible: false, guardGusNotes: "Approved by Finance Controller." } : a))
    );
    showToast(`Bill for ${currentAudit.vendorName} approved & released for payment schedule.`, undefined, "good");
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="3-Way Match Verification Studio (PRC-04 / FIN-03)"
      description="Automated cross-check: Purchase Order (PO) ⟷ Physical Intake (GRN) ⟷ Supplier Bill"
      size="xl"
    >
      <div className="space-y-6 pb-6 text-xs font-sans">
        <div className="p-3 border-line bg-yellow/30 text-ink font-bold" role="note">
          Sample data. This studio is a preview and is not connected to your records yet. Live matches are on the Purchasing page.
        </div>
        {/* Navigation Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-page border-line">
          <div className="flex items-center gap-2">
            <span className="font-bold text-muted uppercase">Select Audit Case:</span>
            {audits.map((a) => (
              <button
                key={a.poNumber}
                type="button"
                onClick={() => setSelectedAuditId(a.poNumber)}
                className={`px-3 py-1.5 font-mono font-bold text-xs border-line transition-all ${
                  selectedAuditId === a.poNumber
                    ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-panel text-muted hover:text-text"
                }`}
              >
                {a.poNumber} ({a.vendorName})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">Match Score:</span>
            <span className={`px-2 py-0.5 font-mono font-bold text-xs border border-ink ${
              currentAudit.confidenceScore >= 95 ? "bg-good text-ink" : "bg-pink text-ink"
            }`}>
              {currentAudit.confidenceScore}% CONFIDENCE
            </span>
          </div>
        </div>

        {/* 3-Way Pillar Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pillar 1: Purchase Order */}
          <div className="p-3.5 bg-panel border-line shadow-sm space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase border-b border-grid pb-1">
              <span>1. Purchase Order</span>
              <span className="font-bold text-text">#{currentAudit.poNumber}</span>
            </div>
            <p className="font-bold text-sm text-text pt-1">{formatMoney(currentAudit.totalPoAmount)}</p>
            <p className="text-[10px] text-muted font-mono">Agreed contract terms</p>
          </div>

          {/* Pillar 2: Physical GRN */}
          <div className="p-3.5 bg-panel border-line shadow-sm space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase border-b border-grid pb-1">
              <span>2. Warehouse Intake</span>
              <span className="font-bold text-text">#{currentAudit.grnNumber}</span>
            </div>
            <p className="font-bold text-sm text-text pt-1">{formatMoney(currentAudit.totalGrnAmount)}</p>
            <p className="text-[10px] text-muted font-mono">Physical received intake</p>
          </div>

          {/* Pillar 3: Supplier Bill */}
          <div className="p-3.5 bg-panel border-line shadow-sm space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase border-b border-grid pb-1">
              <span>3. Supplier Invoice</span>
              <span className="font-bold text-text">#{currentAudit.billNumber}</span>
            </div>
            <p className="font-bold text-sm text-pink pt-1">{formatMoney(currentAudit.totalBillAmount)}</p>
            <p className="text-[10px] text-muted font-mono">Payable claim by vendor</p>
          </div>
        </div>

        {/* Guard Gus Anomaly Alert Banner */}
        <div className={`p-3.5 border-line shadow-sm flex items-start gap-3 ${
          currentAudit.overallMatchStatus === "perfect_match"
            ? "bg-good/15 border-good"
            : "bg-pink/15 border-pink"
        }`}>
          {currentAudit.overallMatchStatus === "perfect_match" ? (
            <CheckCircle2 className="w-5 h-5 text-good shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-pink shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-bold text-xs uppercase font-mono tracking-wide text-text">
              Guard Gus (AI-04) Audit Sentinel:
            </span>
            <p className="text-xs text-text">{currentAudit.guardGusNotes}</p>
          </div>
        </div>

        {/* Line Item Match Audit Table */}
        <div className="border-line bg-panel overflow-hidden">
          <div className="p-2.5 bg-page border-b border-line font-bold uppercase text-muted text-[10px] flex justify-between">
            <span>Line-by-Line 3-Way Discrepancy Breakdown</span>
            <span>Tolerance: 1.0%</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-ink bg-page/50 text-[10px] font-bold font-mono uppercase text-muted">
                  <th className="py-2 px-3">Item / SKU</th>
                  <th className="py-2 px-3 text-center">PO Qty</th>
                  <th className="py-2 px-3 text-center">GRN Qty</th>
                  <th className="py-2 px-3 text-center">Bill Qty</th>
                  <th className="py-2 px-3 text-right">PO Rate</th>
                  <th className="py-2 px-3 text-right">Bill Rate</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid">
                {currentAudit.lines.map((l) => (
                  <tr key={l.id} className={l.status !== "match" ? "bg-pink/10" : ""}>
                    <td className="py-2 px-3 font-medium">
                      <div>{l.description}</div>
                      <div className="font-mono text-[10px] text-muted">{l.sku}</div>
                    </td>
                    <td className="py-2 px-3 text-center font-mono">{l.poQuantity}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-good">{l.grnQuantity}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">{l.billQuantity}</td>
                    <td className="py-2 px-3 text-right font-mono">${l.poUnitPrice}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">${l.billUnitPrice}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold border border-ink ${
                        l.status === "match" ? "bg-good text-ink" : "bg-pink text-ink"
                      }`}>
                        {l.status === "match" ? "MATCH" : "DISCREPANCY"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-muted font-medium">
            {currentAudit.autoApproveEligible
              ? "All lines matched physical warehouse intake. Eligible for zero-touch auto-payment."
              : "Payment withheld due to variance. Requires procurement manager override or vendor credit note."}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-panel border-line shadow-sm hover:bg-cream text-xs font-bold font-mono"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleApproveBill(currentAudit.poNumber)}
              disabled={!currentAudit.autoApproveEligible}
              className={`px-4 py-2 font-mono font-bold text-xs uppercase border-line shadow-[2px_2px_0_var(--q-ink)] transition-all ${
                currentAudit.autoApproveEligible
                  ? "bg-lime text-ink hover:bg-yellow cursor-pointer"
                  : "bg-panel text-muted border-grid cursor-not-allowed"
              }`}
            >
              Release Bill for Payment (PRC-04)
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
