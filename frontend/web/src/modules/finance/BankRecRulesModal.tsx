import React, { useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { INITIAL_BANK_FEED_TRANSACTIONS, type BankFeedTransaction } from "../../lib/bank-reconciliation-rules";
import { CheckCircle2, Sparkles, ArrowDownLeft, ArrowUpRight, Zap } from "lucide-react";
import { useToast } from "../../context/ToastContext";

export interface BankRecRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankRecRulesModal: React.FC<BankRecRulesModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [feedTransactions, setFeedTransactions] = useState<BankFeedTransaction[]>(INITIAL_BANK_FEED_TRANSACTIONS);

  const handleBatchReconcileAll = () => {
    setFeedTransactions((prev) =>
      prev.map((t) => ({ ...t, reconciliationStatus: "reconciled" }))
    );
    showToast("Ledger Lou auto-matched and cleared 4 bank transactions directly against GL Account 1100.", undefined, "good");
  };

  const handleMatchSingle = (id: string) => {
    setFeedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reconciliationStatus: "reconciled" } : t))
    );
    showToast("Transaction matched and cleared.", undefined, "good");
  };

  const pendingCount = feedTransactions.filter((t) => t.reconciliationStatus !== "reconciled").length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Bank Reconciliation & Rules Engine (FIN-04)"
      description="Zero-touch clearing: Bank feed lines ⟷ Open Invoices & Payables ⟷ General Ledger"
      size="xl"
    >
      <div className="space-y-6 pb-6 text-xs font-sans">
        <div className="p-3 border-line bg-yellow/30 text-ink font-bold" role="note">
          Sample data. This studio is a preview and is not connected to your records yet. Live bank lines are on the Bank Reconciliation page; custom rules need a backend that is not built yet.
        </div>
        {/* Status Strip */}
        <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime border border-ink shadow-[2px_2px_0_var(--q-ink)] flex items-center justify-center text-ink shrink-0">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm uppercase">
                  Ledger Lou (AGT-03) Auto-Match Engine
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-good text-ink font-bold border border-ink">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-muted font-mono mt-0.5">
                {pendingCount} suggested matches ready for 1-click batch ledger posting
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBatchReconcileAll}
            disabled={pendingCount === 0}
            className={`px-4 py-2 font-mono font-bold text-xs uppercase border-line shadow-[2px_2px_0_var(--q-ink)] flex items-center gap-1.5 transition-all ${
              pendingCount > 0
                ? "bg-lime text-ink hover:bg-yellow active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                : "bg-panel text-muted border-grid cursor-not-allowed"
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Batch Reconcile All ({pendingCount})</span>
          </button>
        </div>

        {/* Transactions Feed List */}
        <div className="space-y-3">
          {feedTransactions.map((tx) => {
            const isReconciled = tx.reconciliationStatus === "reconciled";
            const isCredit = tx.rawType === "credit";

            return (
              <div
                key={tx.id}
                className={`p-4 border-line shadow-card transition-all ${
                  isReconciled ? "bg-page/40 opacity-75" : "bg-panel hover:border-ink"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left: Bank statement line */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 flex items-center justify-center border border-ink shrink-0 ${
                        isCredit ? "bg-lime text-ink" : "bg-pink text-ink"
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-text">{tx.description}</span>
                        <span className="text-[10px] font-mono text-muted">{tx.date}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-page border border-grid text-muted">
                          Ref: {tx.referenceNumber}
                        </span>
                        <span className="text-[10px] font-mono text-muted">
                          Counterparty: <strong className="text-text">{tx.counterparty}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Matching suggestion */}
                  <div className="flex items-center gap-4 self-end lg:self-center">
                    <div className="text-right">
                      <span className={`font-mono font-black text-sm block ${isCredit ? "text-good" : "text-pink"}`}>
                        {isCredit ? "+" : ""}${tx.amount} USD
                      </span>
                      <span className="text-[10px] font-mono text-muted uppercase">Bank Feed Line</span>
                    </div>

                    {isReconciled ? (
                      <span className="px-3 py-1.5 text-xs font-mono font-bold bg-good text-ink border border-ink flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        RECONCILED
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMatchSingle(tx.id)}
                        className="px-3 py-1.5 text-xs font-mono font-black bg-yellow text-ink border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-lime active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm Match
                      </button>
                    )}
                  </div>
                </div>

                {/* Lou's AI Rule Match Callout */}
                {tx.suggestedMatch && (
                  <div className="mt-3 p-2.5 bg-page border-l-4 border-l-cyan border-y border-r border-grid flex items-center justify-between gap-3 text-[11px] font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-cyan font-black uppercase shrink-0">Lou Rule Match:</span>
                      <span className="text-text font-bold truncate">
                        {tx.suggestedMatch.entityNumber} · {tx.suggestedMatch.entityName} (${tx.suggestedMatch.entityAmount})
                      </span>
                      <span className="text-muted hidden sm:inline">({tx.suggestedMatch.ruleApplied})</span>
                    </div>
                    <span className="px-1.5 py-0.2 bg-good text-ink font-bold border border-ink shrink-0">
                      {tx.suggestedMatch.confidence}% CONFIDENCE
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
};
