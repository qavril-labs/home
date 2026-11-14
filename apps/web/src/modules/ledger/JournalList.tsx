import React, { useState, useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/currency";
import type { JournalEntry } from "../../types";
import { getJournalStatusChip } from "./ledgerHelpers";
import {
  Plus,
  Search,
  RotateCcw,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export interface JournalListProps {
  entries: JournalEntry[];
  onOpenCreate: () => void;
  onPostDraft: (id: string) => void;
  onReverseEntry: (id: string) => void;
}

export const JournalList: React.FC<JournalListProps> = ({
  entries,
  onOpenCreate,
  onPostDraft,
  onReverseEntry,
}) => {
  const [filter, setFilter] = useState<"all" | "posted" | "draft" | "reversed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [reverseCandidate, setReverseCandidate] = useState<JournalEntry | null>(null);

  const filterTabs: { id: "all" | "posted" | "draft" | "reversed"; label: string }[] = [
    { id: "all", label: "All Journal Entries" },
    { id: "posted", label: "Posted to Ledger" },
    { id: "draft", label: "Drafts / Unposted" },
    { id: "reversed", label: "Reversed Entries" },
  ];

  const counts = useMemo(() => {
    return {
      all: entries.length,
      posted: entries.filter((e) => e.status === "posted").length,
      draft: entries.filter((e) => e.status === "draft").length,
      reversed: entries.filter((e) => e.status === "reversed").length,
    };
  }, [entries]);

  const filteredData = useMemo(() => {
    return entries.filter((e) => {
      const matchesFilter = filter === "all" || e.status === filter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        e.entryNumber.toLowerCase().includes(q) ||
        e.memo.toLowerCase().includes(q) ||
        (e.referenceDocument && e.referenceDocument.toLowerCase().includes(q)) ||
        e.lines.some((l) => l.accountCode.includes(q) || l.accountName.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [entries, filter, searchQuery]);

  const columns: Column<JournalEntry>[] = [
    {
      header: "Entry #",
      accessorKey: "entryNumber",
      cell: (r) => (
        <div>
          <span className="font-mono font-bold text-xs text-text">{r.entryNumber}</span>
          <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{r.date}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Memo & Accounts Breakdown",
      cell: (r) => (
        <div className="min-w-[240px]">
          <div className="font-bold text-xs text-text">{r.memo}</div>
          <div className="space-y-1 mt-1 font-mono text-[11px]">
            {r.lines.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-muted">
                <span>
                  {l.accountCode} · {l.accountName}
                </span>
                <span
                  className={
                    l.side === "DEBIT" ? "text-series-in font-bold" : "text-series-out font-bold"
                  }
                >
                  {l.side === "DEBIT" ? `DR ${formatMoney(l.amount, "$")}` : `CR ${formatMoney(l.amount, "$")}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      header: "Source Module",
      accessorKey: "sourceModule",
      cell: (r) => (
        <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 bg-page border border-grid text-muted">
          {r.sourceModule}
        </span>
      ),
    },
    {
      header: "Balanced Total",
      align: "right",
      cell: (r) => (
        <div className="text-right">
          <span className="font-mono font-bold text-xs text-text block">
            {formatMoney(r.totalDebit, "$")}
          </span>
          <span className="text-[10px] font-mono text-good">✓ DR = CR</span>
        </div>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (r) => {
        const chip = getJournalStatusChip(r.status);
        return <StatusChip status={chip.status} label={chip.label} />;
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.status === "draft" && (
            <button
              type="button"
              onClick={() => onPostDraft(r.id)}
              className="p-1.5 bg-lime border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:opacity-90 text-ink cursor-pointer active:translate-y-0.5"
              title="Post draft journal to General Ledger"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}

          {r.status === "posted" && !r.reversedByEntryId && (
            <button
              type="button"
              onClick={() => setReverseCandidate(r)}
              className="p-1.5 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] hover:bg-pink hover:text-white text-ink cursor-pointer active:translate-y-0.5"
              title="Reverse journal entry (immutable reversal rule)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((t) => {
            const count = counts[t.id];
            const isActive = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-lime text-ink border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                    : "bg-panel text-muted border-transparent hover:border-ink hover:text-text"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                    isActive ? "bg-ink text-white" : "bg-page text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-page border-line shadow-sm px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memo, account code…"
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-text placeholder:text-muted"
            />
          </div>

          <Button variant="lime" size="sm" onClick={onOpenCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New journal
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredData}
          emptyTitle="No journal entries found"
          emptyDescription="Double-entry journals maintain complete auditability across all accounts."
          onEmptyAction={onOpenCreate}
          emptyActionLabel="Create first journal"
        />
      </Card>

      {/* Reversal Confirmation Dialog per UI Contract: "Reversals not edits" */}
      <ConfirmDialog
        isOpen={Boolean(reverseCandidate)}
        onClose={() => setReverseCandidate(null)}
        title="Post Reversal Journal?"
        message={`Per accounting immutability rules, posted journals cannot be deleted. Posting a reversal for "${reverseCandidate?.entryNumber}" ($${reverseCandidate?.totalDebit}) will create offsetting debit/credit lines.`}
        actionVerb="Post Reversal"
        actionVariant="pink"
        onConfirm={() => {
          if (reverseCandidate) {
            onReverseEntry(reverseCandidate.id);
            setReverseCandidate(null);
          }
        }}
      />
    </div>
  );
};
