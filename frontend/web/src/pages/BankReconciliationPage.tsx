import React, { useState, useMemo } from "react";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import type { BankFeedLine, Invoice, Bill } from "../types";
import {
  Landmark,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Scale,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";

export interface BankReconciliationPageProps {
  bankLines: BankFeedLine[];
  invoices?: Invoice[];
  bills?: Bill[];
  onReconcileLine?: (lineId: string, matchedRef: string) => void;
  onImportStatement?: (lines: BankFeedLine[]) => void;
}

export const BankReconciliationPage: React.FC<BankReconciliationPageProps> = ({
  bankLines: initialBankLines,
  invoices = [],
  bills = [],
  onReconcileLine,
  onImportStatement,
}) => {
  const { showToast } = useToast();
  const [bankLines, setBankLines] = useState<BankFeedLine[]>(initialBankLines);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Unmatched" | "Suggested" | "Reconciled">("ALL");
  const [isManualMatchDrawerOpen, setIsManualMatchDrawerOpen] = useState(false);
  const [selectedLineForMatch, setSelectedLineForMatch] = useState<BankFeedLine | null>(null);
  const [manualTargetRef, setManualTargetRef] = useState<string>("");

  // KPIs
  const kpis = useMemo(() => {
    const totalLines = bankLines.length;
    const reconciledCount = bankLines.filter((l) => l.status === "Reconciled").length;
    const unmatchedCount = bankLines.filter((l) => l.status === "Unmatched").length;
    const suggestedCount = bankLines.filter((l) => l.status === "Suggested").length;

    // Simulated cash calculation
    const netBankCash = bankLines.reduce((acc, l) => {
      const amt = parseFloat(l.amount) || 0;
      return l.direction === "IN" ? acc + amt : acc - amt;
    }, 45000);

    const matchRate = totalLines > 0 ? Math.round((reconciledCount / totalLines) * 100) : 0;

    return {
      bankBalance: netBankCash.toFixed(2),
      ledgerBalance: (netBankCash - 1200).toFixed(2), // Slight variance before rec
      unmatchedCount,
      suggestedCount,
      reconciledCount,
      matchRate: `${matchRate}%`,
    };
  }, [bankLines]);

  const filteredLines = useMemo(() => {
    if (statusFilter === "ALL") return bankLines;
    return bankLines.filter((l) => l.status === statusFilter);
  }, [bankLines, statusFilter]);

  const handleConfirmMatch = (line: BankFeedLine) => {
    const ref = line.matchedRef || "INV-2026-041";
    setBankLines((prev) =>
      prev.map((l) =>
        l.id === line.id
          ? { ...l, status: "Reconciled", confidence: 100 }
          : l
      )
    );
    onReconcileLine?.(line.id, ref);

    showToast({
      title: "Bank Line Reconciled",
      description: `Matched ${line.reference} with ledger transaction ${ref}.`,
      variant: "success",
    });
  };

  const handleOpenManualMatch = (line: BankFeedLine) => {
    setSelectedLineForMatch(line);
    setManualTargetRef(invoices[0]?.invoiceNumber || bills[0]?.billNumber || "INV-2026-041");
    setIsManualMatchDrawerOpen(true);
  };

  const handleSaveManualMatch = () => {
    if (!selectedLineForMatch || !manualTargetRef) return;

    setBankLines((prev) =>
      prev.map((l) =>
        l.id === selectedLineForMatch.id
          ? {
              ...l,
              status: "Reconciled",
              matchedRef: manualTargetRef,
              matchedLabel: `Manual Match: ${manualTargetRef}`,
              confidence: 100,
            }
          : l
      )
    );
    onReconcileLine?.(selectedLineForMatch.id, manualTargetRef);
    setIsManualMatchDrawerOpen(false);

    showToast({
      title: "Manual Reconciliation Saved",
      description: `Matched ${selectedLineForMatch.reference} with ${manualTargetRef}.`,
      variant: "success",
    });
  };

  const handleSimulateStatementImport = () => {
    const sampleLine: BankFeedLine = {
      id: `bnk-${Date.now()}`,
      postedDate: new Date().toISOString().split("T")[0] || "2026-11-14",
      reference: `ACH-${Math.floor(Math.random() * 900000 + 100000)}-APEX`,
      description: "CHASE OPERATING WIRE TRANSFER INFLOW",
      amount: "7500.00",
      direction: "IN",
      status: "Suggested",
      matchedRef: "INV-2026-042",
      matchedLabel: "Sales Invoice INV-2026-042 (Delta Dynamics)",
      confidence: 94,
    };

    setBankLines((prev) => [sampleLine, ...prev]);
    onImportStatement?.([sampleLine]);

    showToast({
      title: "Statement Imported (OFX/CSV)",
      description: `Successfully ingested 1 bank line: ${sampleLine.reference} (${formatMoney(sampleLine.amount, "$")}).`,
      variant: "success",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-black uppercase tracking-wider bg-cyan text-ink border border-ink">
              FIN-04
            </span>
            <span className="text-xs font-bold text-muted">Cash & Treasury Management</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-text mt-1">
            Bank & Cash Reconciliation
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Ingest live statement feeds (CSV / OFX / Plaid) and reconcile line-by-line against general ledger entries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="cyan"
            size="sm"
            onClick={handleSimulateStatementImport}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Statement Feed</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Bank Feed Balance</span>
            <Landmark className="w-4 h-4 text-cyan" />
          </div>
          <p className="font-display font-black text-2xl text-text">
            {formatMoney(kpis.bankBalance, "$")}
          </p>
          <span className="text-[11px] font-bold text-muted">Chase Treasury #8841</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>GL Cash Balance</span>
            <Scale className="w-4 h-4 text-violet" />
          </div>
          <p className="font-display font-black text-2xl text-text">
            {formatMoney(kpis.ledgerBalance, "$")}
          </p>
          <span className="text-[11px] font-bold text-pink">-$1,200.00 discrepancy</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Unmatched Items</span>
            <Clock className="w-4 h-4 text-yellow" />
          </div>
          <p className="font-display font-black text-2xl text-yellow">{kpis.unmatchedCount}</p>
          <span className="text-[11px] font-bold text-muted">{kpis.suggestedCount} suggested ready</span>
        </div>

        <div className="bg-panel border-line p-4 shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase mb-1">
            <span>Reconciled Ratio</span>
            <ShieldCheck className="w-4 h-4 text-lime" />
          </div>
          <p className="font-display font-black text-2xl text-good">{kpis.matchRate}</p>
          <span className="text-[11px] font-bold text-muted">{kpis.reconciledCount} reconciled lines</span>
        </div>
      </div>

      {/* Reconciliation Workspace Table */}
      <div className="bg-panel border-line p-5 shadow-card space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-muted">Filter:</span>
            {(["ALL", "Suggested", "Unmatched", "Reconciled"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-bold border-2 ${
                  statusFilter === st
                    ? "bg-cyan text-ink border-ink shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-page text-text border-line hover:bg-cream"
                }`}
              >
                {st === "ALL" ? "All Lines" : st}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold px-2.5 py-1 bg-page border border-line">
            {filteredLines.length} bank feed transactions
          </span>
        </div>

        {/* Transactions list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase font-black text-[10px]">
                <th className="p-3">Posted Date</th>
                <th className="p-3">Reference / Bank ID</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-center">Flow</th>
                <th className="p-3 text-right">Amount ($)</th>
                <th className="p-3">Matched Ledger Entry</th>
                <th className="p-3 text-center">Confidence</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-medium text-text">
              {filteredLines.map((line) => (
                <tr key={line.id} className="hover:bg-cream/40 transition-colors">
                  <td className="p-3 text-muted">{line.postedDate}</td>
                  <td className="p-3 font-mono font-bold text-violet">{line.reference}</td>
                  <td className="p-3 font-bold max-w-xs truncate">{line.description}</td>
                  <td className="p-3 text-center">
                    {line.direction === "IN" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase bg-good/20 text-good border border-good">
                        <ArrowDownLeft className="w-3 h-3" />
                        Inflow
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase bg-pink/20 text-pink border border-pink">
                        <ArrowUpRight className="w-3 h-3" />
                        Outflow
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-sm">
                    {line.direction === "IN" ? "+" : "-"}
                    {formatMoney(line.amount, "$")}
                  </td>
                  <td className="p-3">
                    {line.matchedRef ? (
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-text underline">
                          {line.matchedRef}
                        </span>
                        {line.matchedLabel && (
                          <p className="text-[10px] text-muted truncate max-w-xs">
                            {line.matchedLabel}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted italic text-[11px]">No automatic match found</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {line.confidence ? (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border ${
                          line.confidence >= 95
                            ? "bg-good/10 text-good border-good"
                            : "bg-yellow/10 text-yellow border-yellow"
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        {line.confidence}%
                      </span>
                    ) : (
                      <span className="text-muted text-[11px]">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase border border-ink ${
                        line.status === "Reconciled"
                          ? "bg-good text-panel"
                          : line.status === "Suggested"
                          ? "bg-cyan text-ink"
                          : "bg-muted/20 text-muted"
                      }`}
                    >
                      {line.status === "Reconciled" && <CheckCircle2 className="w-3 h-3" />}
                      {line.status === "Suggested" && <Sparkles className="w-3 h-3" />}
                      {line.status === "Unmatched" && <Clock className="w-3 h-3" />}
                      {line.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {line.status === "Suggested" && (
                        <Button
                          variant="cyan"
                          size="sm"
                          onClick={() => handleConfirmMatch(line)}
                          className="text-[11px] py-1 px-2 font-black"
                        >
                          Confirm Match
                        </Button>
                      )}
                      {line.status === "Unmatched" && (
                        <Button
                          variant="yellow"
                          size="sm"
                          onClick={() => handleOpenManualMatch(line)}
                          className="text-[11px] py-1 px-2"
                        >
                          <LinkIcon className="w-3 h-3 mr-1" />
                          Match...
                        </Button>
                      )}
                      {line.status === "Reconciled" && (
                        <span className="text-[11px] font-bold text-good flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Reconciled
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Match Drawer */}
      <Drawer
        isOpen={isManualMatchDrawerOpen}
        onClose={() => setIsManualMatchDrawerOpen(false)}
        title="Manual Ledger Match (FIN-04)"
        description="Pair this bank feed transaction with an open sales invoice, vendor bill, or ledger journal entry."
        primaryActionLabel="Confirm Match"
        onPrimaryAction={handleSaveManualMatch}
        primaryActionVariant="cyan"
      >
        {selectedLineForMatch && (
          <div className="space-y-4 text-xs font-bold text-text">
            <div className="p-3 bg-page border-line space-y-1">
              <span className="text-[10px] uppercase text-muted block">Selected Bank Line</span>
              <p className="font-mono text-xs font-black text-violet">{selectedLineForMatch.reference}</p>
              <p className="text-xs font-bold text-text">{selectedLineForMatch.description}</p>
              <p className="font-mono font-black text-sm text-lime">
                {selectedLineForMatch.direction === "IN" ? "+" : "-"}
                {formatMoney(selectedLineForMatch.amount, "$")}
              </p>
            </div>

            <div>
              <label className="block uppercase text-[10px] text-muted mb-1">
                Select Matching Ledger Transaction
              </label>
              <select
                value={manualTargetRef}
                onChange={(e) => setManualTargetRef(e.target.value)}
                className="w-full p-2.5 bg-page border-line text-text font-mono focus:outline-none focus:border-ink"
              >
                <optgroup label="Open Customer Invoices (SAL-04)">
                  <option value="INV-2026-041">INV-2026-041 - Vanguard Aerospace ($18,400.00)</option>
                  <option value="INV-2026-042">INV-2026-042 - Delta Dynamics ($7,500.00)</option>
                </optgroup>
                <optgroup label="Pending Vendor Bills (FIN-03)">
                  <option value="BILL-2026-102">BILL-2026-102 - Northstar Metals ($6,420.00)</option>
                  <option value="BILL-2026-103">BILL-2026-103 - AWS Cloud Services ($840.00)</option>
                </optgroup>
                <optgroup label="General Journal Entries (FIN-01)">
                  <option value="JRN-2026-0091">JRN-2026-0091 - Monthly Bank Processing Fee ($45.00)</option>
                </optgroup>
              </select>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
