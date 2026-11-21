import React from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { AnomalyFinding } from "../../types";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface AnomalyInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  finding: AnomalyFinding | null;
  onQuarantine: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const AnomalyInspectionModal: React.FC<AnomalyInspectionModalProps> = ({
  isOpen,
  onClose,
  finding,
  onQuarantine,
  onDismiss,
}) => {
  if (!finding) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={finding.title}
      description={`Detected by Guard Gus heuristic & pattern-matching sentinels (Confidence: ${(finding.confidence * 100).toFixed(0)}%)`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        {/* Severity Banner */}
        <div className="p-3 bg-panel border-line shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-pink" />
            <div>
              <span className="font-bold text-text block">
                Rule: {finding.rule.replace("_", " ").toUpperCase()}
              </span>
              <span className="text-[10px] text-muted">
                Reference ID: {finding.id} · Detected {finding.detectedAt.replace("T", " ").replace("Z", "")}
              </span>
            </div>
          </div>

          <span className="px-2 py-0.5 bg-pink/20 border border-pink text-ink text-[11px] font-bold">
            {(finding.confidence * 100).toFixed(0)}% Match Confidence
          </span>
        </div>

        {/* Side-by-Side Comparison for Duplicate / Suspicious Bills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Suspected Record */}
          <div className="p-3 bg-act/10 border-line border-act/40 space-y-1">
            <span className="text-[10px] font-bold uppercase text-act block">
              Suspected Record (Under Inspection)
            </span>
            <div className="font-mono font-bold text-sm text-text">
              {finding.suspectedRef}
            </div>
            <div className="text-xs text-text font-medium">{finding.partyName}</div>
            <div className="font-display font-black text-sm text-act pt-1">
              {formatMoney(finding.amount)}
            </div>
          </div>

          {/* Matched Reference (if applicable) */}
          <div className="p-3 bg-page border-line space-y-1">
            <span className="text-[10px] font-bold uppercase text-muted block">
              Prior Approved Record (Reference)
            </span>
            <div className="font-mono font-bold text-sm text-text">
              {finding.matchedRef || "N/A (Policy Violation)"}
            </div>
            <div className="text-xs text-text font-medium">{finding.partyName}</div>
            <div className="font-display font-black text-sm text-good pt-1">
              {formatMoney(finding.amount)}
            </div>
          </div>
        </div>

        {/* Detection Logic Explanation */}
        <div className="p-3 bg-panel border-line">
          <span className="text-[10px] font-bold uppercase text-muted block mb-1">
            Audit Finding Evidence & Details
          </span>
          <p className="text-xs text-text font-medium leading-relaxed break-words">
            {finding.details}
          </p>
        </div>

        {/* Guardrail Policy Notice */}
        <div className="p-2.5 bg-cream border-line flex items-start gap-2 text-[11px] text-ink">
          <AlertTriangle className="w-4 h-4 text-watch flex-shrink-0 mt-0.5" />
          <span>
            <strong>Deterministic Provenance:</strong> Gus flags anomalies based on exact ledger invariants and fuzzy duplicate matching. Discarding or quarantining logs a tamper-proof audit trail event.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-grid">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDismiss(finding.id);
              onClose();
            }}
            className="text-muted hover:text-text text-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-good" />
            <span>Dismiss as Legitimate</span>
          </Button>

          <Button
            variant="pink"
            size="sm"
            onClick={() => {
              onQuarantine(finding.id);
              onClose();
            }}
            className="text-xs font-bold flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Quarantine & Block Record</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
