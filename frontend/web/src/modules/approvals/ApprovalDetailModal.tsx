import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { ApprovalItem } from "../../types";
import {
  ShieldCheck,
  ShieldAlert,
  Hash,
  Clock,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileCode,
} from "lucide-react";

export interface ApprovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  approval: ApprovalItem | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onViewHash: (approval: ApprovalItem) => void;
}

export const ApprovalDetailModal: React.FC<ApprovalDetailModalProps> = ({
  isOpen,
  onClose,
  approval,
  onApprove,
  onReject,
  onViewHash,
}) => {
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  if (!approval) return null;

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(approval.id, rejectionReason.trim());
    setIsRejecting(false);
    setRejectionReason("");
  };

  const handleClose = () => {
    setIsRejecting(false);
    setRejectionReason("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={approval.title}
      description={`Proposed by ${approval.agentName} via tool ${approval.toolName}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Tier & Dual Control Header Bar */}
        <div className="p-3 bg-panel border-line shadow-sm flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border-line ${
                approval.tier === 3
                  ? "bg-pink text-white"
                  : approval.tier === 4
                  ? "bg-act text-white"
                  : "bg-yellow text-ink"
              }`}
            >
              Tier {approval.tier} Action
            </span>

            <span className="font-mono text-muted text-[11px] font-bold">
              {approval.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {approval.requiresDualControl ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan/20 border border-cyan text-ink text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan" />
                <span>Dual-Control Enforced</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-page border border-grid text-muted text-[11px]">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Single Supervisor Review</span>
              </span>
            )}
          </div>
        </div>

        {/* Amount Banner (if money-moving) */}
        {approval.amount && (
          <div className="p-3 bg-page border-line flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted block">
                Total Transaction Value
              </span>
              <span className="font-display font-black text-xl text-text">
                {formatMoney(approval.amount)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted block">
                Proposing Principal
              </span>
              <span className="font-mono text-xs font-bold text-text">
                {approval.initiator}
              </span>
            </div>
          </div>
        )}

        {/* Summary Description */}
        <div className="p-3 bg-panel border-line">
          <span className="text-[10px] uppercase font-bold text-muted block mb-1">
            Operation Summary
          </span>
          <p className="text-xs text-text font-medium leading-relaxed">
            {approval.summary}
          </p>
        </div>

        {/* Payload Snapshot & Hash Verification Link */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-muted" />
              <span>Execution Arguments Payload</span>
            </span>
            <button
              type="button"
              onClick={() => onViewHash(approval)}
              className="text-[11px] font-bold text-cyan hover:underline flex items-center gap-1"
            >
              <Hash className="w-3 h-3" />
              <span>Verify SHA-256 Digest</span>
            </button>
          </div>

          <pre className="p-3 bg-page border-line font-mono text-[11px] max-h-44 overflow-y-auto whitespace-pre leading-snug text-text">
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        </div>

        {/* Dual-Control Explanatory Alert */}
        {approval.requiresDualControl && (
          <div className="p-2.5 bg-cream border-line flex items-start gap-2 text-[11px] text-ink">
            <ShieldAlert className="w-4 h-4 text-act flex-shrink-0 mt-0.5" />
            <span>
              <strong>Dual-Control Policy (AGT-06):</strong> Money-moving Tier 3 operations require explicit authorization from a certified supervisor whose identity is cryptographically distinct from the initiating agent.
            </span>
          </div>
        )}

        {/* Rejection Reason Form (when active) */}
        {isRejecting && (
          <div className="p-3 bg-act/10 border-2 border-act space-y-2">
            <label className="block text-xs font-bold text-act uppercase tracking-wider">
              Reason for Rejection (Mandatory Audit Trail)
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Breaches 18% margin threshold; invoice reference does not match PO..."
              className="w-full text-xs p-2 bg-page border-line focus:outline-none focus:ring-1 focus:ring-act"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsRejecting(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="pink"
                disabled={!rejectionReason.trim()}
                onClick={handleConfirmReject}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isRejecting && (
          <div className="flex items-center justify-between pt-3 border-t border-grid">
            <div className="flex items-center gap-1.5 text-muted text-[11px]">
              <Clock className="w-3.5 h-3.5" />
              <span>Created: {approval.createdAt.replace("T", " ").replace("Z", "")}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRejecting(true)}
                className="text-act hover:bg-act/10 text-xs"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                <span>Reject</span>
              </Button>

              <Button
                variant="lime"
                size="sm"
                onClick={() => onApprove(approval.id)}
                className="text-xs font-bold flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Action</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
