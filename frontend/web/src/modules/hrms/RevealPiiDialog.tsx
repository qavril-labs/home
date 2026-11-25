import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";

export interface RevealPiiDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fieldLabel: string;
  employeeName: string;
  onRevealed: (reason: string) => void;
}

export const RevealPiiDialog: React.FC<RevealPiiDialogProps> = ({
  isOpen,
  onClose,
  fieldLabel,
  employeeName,
  onRevealed,
}) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required for the audit log.");
      return;
    }
    onRevealed(reason.trim());
    showToast(`Revealed ${fieldLabel} for ${employeeName} (audited)`, "info");
    setReason("");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reveal ${fieldLabel}`}>
      <form onSubmit={handleConfirm} className="space-y-4">
        <p className="text-sm text-text-muted">
          You are about to reveal <strong>{fieldLabel}</strong> for{" "}
          <strong>{employeeName}</strong>. This access is recorded in the server audit log.
        </p>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1">
            Reason for access
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            placeholder="e.g. Payroll tax verification"
            className="w-full px-3 py-2 bg-page border-3 border-border text-sm focus:outline-none"
          />
          {error && <p className="text-xs text-act font-bold mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="lime">
            Reveal {fieldLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
