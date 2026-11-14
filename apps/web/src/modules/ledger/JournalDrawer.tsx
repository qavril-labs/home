import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { formatMoney } from "../../lib/currency";
import type { JournalEntry, JournalEntryLine, Account, Party } from "../../types";
import { calculateJournalBalance, toDecimalString } from "./ledgerHelpers";
import { Plus, Trash2, AlertCircle, Hash } from "lucide-react";

export interface JournalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  parties?: Party[];
  onSave: (entry: JournalEntry) => void;
}

export const JournalDrawer: React.FC<JournalDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onSave,
}) => {
  const [entryNumber, setEntryNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0] || "2026-11-10");
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<JournalEntryLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setEntryNumber(`JRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(new Date().toISOString().split("T")[0] || "2026-11-10");
    setMemo("");
    setReference("");

    // Initial 2 balanced lines
    const acct1 = accounts.find((a) => a.code === "1100") || accounts[0];
    const acct2 = accounts.find((a) => a.code === "4000") || accounts[1] || accounts[0];

    if (acct1 && acct2) {
      setLines([
        {
          id: `line-${Date.now()}-1`,
          accountCode: acct1.code,
          accountName: acct1.name,
          side: "DEBIT",
          amount: "100.00",
        },
        {
          id: `line-${Date.now()}-2`,
          accountCode: acct2.code,
          accountName: acct2.name,
          side: "CREDIT",
          amount: "100.00",
        },
      ]);
    }
  }, [isOpen, accounts]);

  const balance = calculateJournalBalance(lines);

  const handleAddLine = () => {
    const acct = accounts[0];
    if (!acct) return;
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        accountCode: acct.code,
        accountName: acct.name,
        side: "DEBIT",
        amount: "0.00",
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) {
      setErrorMsg("A double-entry journal requires at least two lines.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleLineChange = (
    id: string,
    field: keyof JournalEntryLine,
    val: string
  ) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: val };

        if (field === "accountCode") {
          const matched = accounts.find((a) => a.code === val);
          if (matched) {
            updated.accountName = matched.name;
          }
        }

        if (field === "amount") {
          updated.amount = val;
        }

        return updated;
      })
    );
  };

  const handleSubmit = (targetStatus: "draft" | "posted") => {
    if (!memo.trim()) {
      setErrorMsg("Please provide a journal memo or description.");
      return;
    }

    if (targetStatus === "posted" && !balance.isBalanced) {
      setErrorMsg(
        `Journal entry does not balance. Debits ($${balance.totalDebit}) must equal Credits ($${balance.totalCredit}). Imbalance: $${balance.imbalance}`
      );
      return;
    }

    const newEntry: JournalEntry = {
      id: `jrn-${Date.now()}`,
      entryNumber: entryNumber.trim().toUpperCase(),
      date,
      memo: memo.trim(),
      sourceModule: "MANUAL",
      referenceDocument: reference.trim() || undefined,
      status: targetStatus,
      lines: lines.map((l) => ({ ...l, amount: toDecimalString(l.amount) })),
      totalDebit: balance.totalDebit,
      totalCredit: balance.totalCredit,
      isBalanced: balance.isBalanced,
      postedAt: targetStatus === "posted" ? new Date().toISOString() : undefined,
    };

    onSave(newEntry);
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Create Journal Entry"
      description="General Ledger (FIN-01). Strict double-entry rules apply: total debits must equal total credits."
      primaryActionLabel="Post to Ledger"
      primaryActionVariant="lime"
      onPrimaryAction={() => handleSubmit("posted")}
      secondaryActionLabel="Cancel"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 bg-cream border-line text-act text-xs font-bold shadow-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Entry Number & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="jrn-number"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Entry Number *
            </label>
            <div className="relative">
              <input
                id="jrn-number"
                type="text"
                required
                value={entryNumber}
                onChange={(e) => setEntryNumber(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold uppercase bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
              <Hash className="w-4 h-4 text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label
              htmlFor="jrn-date"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Posting Date *
            </label>
            <div className="relative">
              <input
                id="jrn-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-2 text-xs font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>
        </div>

        {/* Memo & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="jrn-memo"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Description / Memo *
            </label>
            <input
              id="jrn-memo"
              type="text"
              required
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="e.g. Accrued facility lease payment"
              className="w-full px-3 py-2 text-xs font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </div>

          <div>
            <label
              htmlFor="jrn-ref"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Document Reference
            </label>
            <input
              id="jrn-ref"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. CHQ-8902 or REC-104"
              className="w-full px-3 py-2 text-xs font-mono font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </div>
        </div>

        {/* Journal Lines */}
        <div className="border-t-line pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Journal Lines ({lines.length})
            </span>
            <Button variant="ghost" size="sm" onClick={handleAddLine} type="button">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add line
            </Button>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="p-2.5 bg-page border-line shadow-sm space-y-2 relative"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold text-muted">
                    Line #{idx + 1}
                  </span>
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      className="text-muted hover:text-act p-0.5"
                      title="Remove line"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                      Account Code & Name
                    </label>
                    <select
                      value={line.accountCode}
                      onChange={(e) => handleLineChange(line.id, "accountCode", e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold bg-panel text-text border-line"
                    >
                      {accounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-0.5">
                        Side
                      </label>
                      <select
                        value={line.side}
                        onChange={(e) =>
                          handleLineChange(line.id, "side", e.target.value as "DEBIT" | "CREDIT")
                        }
                        className={`w-full px-2 py-1 text-xs font-mono font-bold border-line ${
                          line.side === "DEBIT" ? "bg-violet text-white" : "bg-cyan text-ink"
                        }`}
                      >
                        <option value="DEBIT">DEBIT</option>
                        <option value="CREDIT">CREDIT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-muted mb-0.5 text-right">
                        Amount ($)
                      </label>
                      <input
                        type="text"
                        value={line.amount}
                        onChange={(e) => handleLineChange(line.id, "amount", e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-xs font-mono font-bold text-right bg-panel text-text border-line"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Balance Validation Card */}
        <div
          className={`neo-card p-3 border-line font-mono text-xs ${
            balance.isBalanced ? "bg-panel text-good" : "bg-cream text-act"
          }`}
        >
          <div className="flex justify-between font-bold">
            <span>Total Debits: {formatMoney(balance.totalDebit, "$")}</span>
            <span>Total Credits: {formatMoney(balance.totalCredit, "$")}</span>
          </div>
          <div className="mt-1 pt-1 border-t border-current flex items-center justify-between text-[11px]">
            <span>
              {balance.isBalanced
                ? "✓ Double-entry balanced to zero"
                : `● Imbalance: ${formatMoney(balance.imbalance, "$")}`}
            </span>
            <span className="font-bold uppercase tracking-wider">
              {balance.isBalanced ? "Valid to Post" : "Cannot Post Imbalance"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleSubmit("draft")}
          >
            Save as Draft
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
