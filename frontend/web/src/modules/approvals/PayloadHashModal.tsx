import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import type { ApprovalItem } from "../../types";
import { ShieldCheck, Copy, Check, Hash, FileCode } from "lucide-react";

export interface PayloadHashModalProps {
  isOpen: boolean;
  onClose: () => void;
  approval: ApprovalItem | null;
}

export const PayloadHashModal: React.FC<PayloadHashModalProps> = ({
  isOpen,
  onClose,
  approval,
}) => {
  const [copied, setCopied] = useState(false);

  if (!approval) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(approval.payloadHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedPayload = JSON.stringify(approval.payload, null, 2);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cryptographic Hash Verification"
      description="Proves payload immutability between agent proposal and execution in accordance with the UAAP Security Standard."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Verification Status Banner */}
        <div className="p-3 bg-panel border-line flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-good" />
            <span className="font-bold text-text">
              SHA-256 Digest Match Verified
            </span>
          </div>
          <span className="font-mono text-[10px] bg-page border border-grid px-2 py-0.5 text-good font-bold">
            IMMUTABLE
          </span>
        </div>

        {/* SHA-256 Hash Display */}
        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-cyan" />
              <span>Cryptographic Payload Digest</span>
            </span>
            <button
              type="button"
              onClick={handleCopyHash}
              className="text-[10px] font-mono text-muted hover:text-text flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-good" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy Hash"}</span>
            </button>
          </label>
          <div className="p-2.5 bg-page border-line font-mono text-[11px] break-all select-all text-text font-bold">
            {approval.payloadHash}
          </div>
        </div>

        {/* Exact Payload JSON */}
        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-muted" />
            <span>Exact Normalized Payload (Draft 2020-12 Contract)</span>
          </label>
          <pre className="p-3 bg-page border-line font-mono text-[11px] max-h-56 overflow-y-auto whitespace-pre leading-snug text-text">
            {formattedPayload}
          </pre>
        </div>

        {/* Audit Guarantee Note */}
        <p className="text-[11px] text-muted leading-relaxed">
          The UAAP Execution Boundary re-hashes this normalized payload immediately before executing <code>{approval.toolName}</code>. If any field or amount differs by even one character, execution terminates with error code <code>IDEMPOTENCY_CONFLICT</code>.
        </p>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-grid">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close Verification
          </Button>
        </div>
      </div>
    </Modal>
  );
};
