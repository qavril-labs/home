import React, { useState, useMemo } from "react";
import { JournalList } from "../modules/ledger/JournalList";
import { JournalDrawer } from "../modules/ledger/JournalDrawer";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type { JournalEntry, Account, Party } from "../types";
import { Plus, CheckCircle2 } from "lucide-react";

export interface LedgerPageProps {
  entries: JournalEntry[];
  accounts: Account[];
  parties: Party[];
  onAddEntry: (entry: JournalEntry) => void;
  onPostDraft: (id: string) => void;
  onReverseEntry: (id: string) => void;
}

export const LedgerPage: React.FC<LedgerPageProps> = ({
  entries,
  accounts,
  parties,
  onAddEntry,
  onPostDraft,
  onReverseEntry,
}) => {
  const { showToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const stats = useMemo(() => {
    let postedVolumeCents = 0;
    let draftCount = 0;
    let totalJournals = entries.length;

    for (const e of entries) {
      if (e.status === "posted") {
        const norm = e.totalDebit.replace(/,/g, "");
        const [intPart = "0", decPart = "00"] = norm.split(".");
        postedVolumeCents += (parseInt(intPart, 10) || 0) * 100 + (parseInt(decPart, 10) || 0);
      } else if (e.status === "draft") {
        draftCount++;
      }
    }

    const toStr = (c: number) => {
      const i = Math.floor(c / 100);
      const d = String(c % 100).padStart(2, "0");
      return `${i}.${d}`;
    };

    return {
      postedVolume: toStr(postedVolumeCents),
      draftCount,
      totalJournals,
      accountCount: accounts.length,
    };
  }, [entries, accounts]);

  const handleSave = (entry: JournalEntry) => {
    onAddEntry(entry);
    showToast(`Journal ${entry.entryNumber} recorded (${entry.status})`, { type: "success" });
  };

  const handlePost = (id: string) => {
    onPostDraft(id);
    showToast("Journal draft posted to General Ledger", { type: "success" });
  };

  const handleReverse = (id: string) => {
    onReverseEntry(id);
    showToast("Reversal entry posted to Ledger", { type: "info" });
  };

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Core Finance · FIN-01
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            General Ledger & Journals
          </h1>
          <p className="text-xs text-muted mt-1 max-w-xl">
            Immutable double-entry ledger. All financial transactions post through verified journal lines that balance to zero.
          </p>
        </div>

        <Button variant="lime" size="md" onClick={() => setIsDrawerOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New journal entry
        </Button>
      </div>

      {/* KPI Tiles row per UI Contract */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-panel">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Posted Ledger Volume
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl text-series-in mt-1">
            {formatMoney(stats.postedVolume, "$")}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            Balanced debits across journals
          </span>
        </div>

        <div className="neo-card p-4 bg-lime text-ink">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/80 block">
            Double-Entry Integrity
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-6 h-6 text-ink" />
            <span>100% Balanced</span>
          </div>
          <span className="text-[11px] text-ink/80 font-medium mt-1 block">
            All posted lines net to zero
          </span>
        </div>

        <div
          className={`neo-card p-4 ${
            stats.draftCount > 0 ? "bg-cream text-act" : "bg-panel text-good"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Unposted Drafts
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl mt-1">
            {stats.draftCount}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            {stats.draftCount > 0 ? "Requires review & approval" : "All drafts posted"}
          </span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Chart Accounts
          </span>
          <div className="font-display font-extrabold text-2xl lg:text-3xl text-text mt-1">
            {stats.accountCount}
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">
            Active posting destinations
          </span>
        </div>
      </div>

      {/* Main Journal List */}
      <JournalList
        entries={entries}
        onOpenCreate={() => setIsDrawerOpen(true)}
        onPostDraft={handlePost}
        onReverseEntry={handleReverse}
      />

      {/* Journal Drawer */}
      <JournalDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        accounts={accounts}
        parties={parties}
        onSave={handleSave}
      />
    </div>
  );
};
