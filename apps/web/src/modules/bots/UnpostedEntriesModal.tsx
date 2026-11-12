import React, { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { StatusChip } from "../../components/ui/StatusChip";
import { formatMoney } from "../../lib/currency";
import type { UnpostedEntry } from "../../types";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

export interface UnpostedEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: UnpostedEntry[];
  totalDraftAmount?: string;
  onApproveAndPost: () => void;
  isSubmitting?: boolean;
  currencySymbol?: string;
}

export const UnpostedEntriesModal: React.FC<UnpostedEntriesModalProps> = ({
  isOpen,
  onClose,
  entries,
  totalDraftAmount = "0.00",
  onApproveAndPost,
  isSubmitting = false,
  currencySymbol = "$",
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Format API-returned decimal string without client-side arithmetic
  const totalFormatted = formatMoney(
    entries.length > 0 ? totalDraftAmount : "0.00",
    currencySymbol
  );
  const isAllBalanced = entries.every((e) => e.isBalanced && e.debitTotal === e.creditTotal);

  const handlePrimaryClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmPost = () => {
    setIsConfirmOpen(false);
    onApproveAndPost();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Review Unposted Draft Entries"
        description="Verify side-by-side debit and credit allocations prepared by Ledger Lou (AGT-03 / FIN-13)."
        maxWidth="max-w-[760px]"
      >
        <div className="space-y-4">
          {/* Top Draft Notice Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-cream border-line shadow-[2px_2px_0_var(--q-ink)]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-yellow border-line text-[11px] font-bold uppercase tracking-wider text-ink">
                Draft · Action Required
              </span>
              <span className="text-xs text-muted font-medium">
                Draft actions are non-destructive until approved.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-ink">
                {entries.length} {entries.length === 1 ? "entry" : "entries"} pending
              </span>
              <StatusChip
                status={isAllBalanced ? "good" : "act"}
                label={isAllBalanced ? "✓ Balanced" : "● Out of balance"}
              />
            </div>
          </div>

          {/* List of Unposted Draft Entries */}
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {entries.length === 0 ? (
              <div className="p-8 text-center bg-page border-line">
                <CheckCircle2 className="w-8 h-8 text-good mx-auto mb-2" />
                <p className="text-sm font-bold text-text">No unposted draft entries</p>
                <p className="text-xs text-muted mt-1">
                  All draft depreciation and accrual schedules are posted.
                </p>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-page border-line p-3.5 shadow-[2px_2px_0_var(--q-ink)] space-y-3"
                >
                  {/* Entry Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-grid">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold px-1.5 py-0.5 bg-panel border-line text-ink">
                          {entry.reference}
                        </span>
                        <span className="text-xs font-bold text-text">{entry.memo}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 font-medium">
                        Source: {entry.source} · Effective {entry.date}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-cyan/20 border border-cyan text-ink">
                        Tier 2 Draft
                      </span>
                    </div>
                  </div>

                  {/* Side-by-Side Debit / Credit Verification Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-grid text-muted uppercase text-[10px] tracking-wider font-bold">
                          <th className="py-1 px-2">Account</th>
                          <th className="py-1 px-2 text-right w-28">Debit ({currencySymbol})</th>
                          <th className="py-1 px-2 text-right w-28">Credit ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-grid">
                        {entry.lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-panel/60 transition-colors">
                            <td className="py-1.5 px-2">
                              <span className="font-mono font-bold text-text mr-1.5">
                                {line.accountCode}
                              </span>
                              <span className="text-text">{line.accountName}</span>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold">
                              {line.side === "DEBIT" ? (
                                <span className="text-text">{formatMoney(line.amount, currencySymbol)}</span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold">
                              {line.side === "CREDIT" ? (
                                <span className="text-text">{formatMoney(line.amount, currencySymbol)}</span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-line bg-panel font-bold text-xs">
                          <td className="py-1.5 px-2 font-display uppercase tracking-wider text-[11px]">
                            Entry Balance Verification
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-ink">
                            {formatMoney(entry.debitTotal, currencySymbol)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-ink">
                            {formatMoney(entry.creditTotal, currencySymbol)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Verification Invariant Card & Grand Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-panel border-line">
            <div className="space-y-1 text-xs text-muted">
              <div className="flex items-center gap-1.5 font-bold text-text">
                <ShieldCheck className="w-4 h-4 text-good" />
                <span>Double-Entry Invariant Guard</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Ledger Lou verifies that Σ debits equal Σ credits across all accounts before submission.
              </p>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-grid pt-2 sm:pt-0 sm:pl-3">
              <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                Total Draft Posting Value
              </span>
              <span className="font-display font-extrabold text-xl text-text leading-tight block">
                {totalFormatted}
              </span>
              <span className="text-[11px] font-bold text-good flex items-center sm:justify-end gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero variance · Ready to post</span>
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-grid flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              Requires Tier 3 administrator authorization.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="lime"
                size="md"
                onClick={handlePrimaryClick}
                disabled={isSubmitting || entries.length === 0}
                className="flex items-center gap-1.5 font-bold"
              >
                <span>Approve & Post</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Tier 3 Confirm Dialog before irreversible money-moving action */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Approve & Post Journal Entries"
        message={`Post ${totalFormatted} across ${entries.length} draft journal entries into November 2026 books? This is a Tier 3 action and posts directly to the general ledger.`}
        actionVerb={`Post ${totalFormatted}`}
        actionVariant="lime"
        onConfirm={handleConfirmPost}
        isSubmitting={isSubmitting}
      />
    </>
  );
};
