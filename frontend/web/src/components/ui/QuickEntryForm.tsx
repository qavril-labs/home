import React, { useState } from "react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";
import type { QuickEntryPayload } from "../../types";

export interface QuickEntryFormProps {
  currencySymbol?: string;
  onSubmit: (entry: QuickEntryPayload) => Promise<void> | void;
  className?: string;
}

export type QuickEntryKind = "sale" | "expense" | "customer_payment" | "owner_investment";

export const QuickEntryForm: React.FC<QuickEntryFormProps> = ({
  currencySymbol = "$",
  onSubmit,
  className,
}) => {
  const [kind, setKind] = useState<QuickEntryKind>("sale");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0] || "2026-11-10");
  const [account, setAccount] = useState<string>("4000");
  const [via, setVia] = useState<string>("1100");
  const [partyName, setPartyName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const tabs: { kind: QuickEntryKind; label: string; verb: string }[] = [
    { kind: "sale", label: "A sale", verb: "Record sale" },
    { kind: "expense", label: "An expense", verb: "Record expense" },
    { kind: "customer_payment", label: "A customer paid me", verb: "Record payment" },
    { kind: "owner_investment", label: "Money I put in", verb: "Record money in" },
  ];

  const currentTab = tabs.find((t) => t.kind === kind) || tabs[0]!;

  const viaOptions: Record<QuickEntryKind, { code: string; label: string }[]> = {
    sale: [
      { code: "1100", label: "1100 · Bank" },
      { code: "1000", label: "1000 · Cash on hand" },
      { code: "1200", label: "1200 · Customer will pay later" },
    ],
    expense: [
      { code: "1100", label: "1100 · Bank" },
      { code: "1000", label: "1000 · Cash on hand" },
      { code: "2000", label: "2000 · Bill to pay later" },
    ],
    customer_payment: [
      { code: "1100", label: "1100 · Bank" },
      { code: "1000", label: "1000 · Cash on hand" },
    ],
    owner_investment: [
      { code: "1100", label: "1100 · Bank" },
      { code: "1000", label: "1000 · Cash on hand" },
    ],
  };

  const viaLabel =
    kind === "expense" ? "Paid from" : kind === "sale" ? "Paid into" : "Money went into";

  const handleTabChange = (newKind: QuickEntryKind) => {
    setKind(newKind);
    setErrorMsg("");
    setStatusMessage("");
    setVia("1100");
    if (newKind === "sale") setAccount("4000");
    else if (newKind === "expense") setAccount("5100");
    else if (newKind === "customer_payment") setAccount("1200");
    else if (newKind === "owner_investment") setAccount("3000");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMessage("");

    const numVal = parseFloat(amount);
    if (!amount || isNaN(numVal) || numVal <= 0) {
      setErrorMsg("Enter an amount like 1250 or 1250.50, and a date.");
      return;
    }

    if (!date) {
      setErrorMsg("Please select an entry date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: QuickEntryPayload = {
        kind,
        amount: numVal.toFixed(2),
        partyName:
          partyName.trim() ||
          (kind === "sale"
            ? "Customer"
            : kind === "expense"
            ? "Supplier"
            : "Direct Transfer"),
        date,
        description: description.trim() || `${currentTab.label} (${date})`,
        account: kind !== "owner_investment" ? account : undefined,
      };

      await onSubmit(payload);

      setStatusMessage(`✓ ${currentTab.verb} of ${currencySymbol}${numVal.toFixed(2)} recorded to ledger.`);
      setAmount("");
      setDescription("");
      setPartyName("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to post entry. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("neo-card p-4", className)}>
      <div className="mb-4 pb-2 border-b border-grid">
        <h2 className="text-[1.15rem] font-bold font-display uppercase tracking-tight text-text leading-tight">
          Record something
        </h2>
        <p className="text-xs text-muted mt-1">
          Quick entries post straight into your books with no manual journal entries needed.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="quick-tabs flex flex-wrap gap-2 mb-4"
        role="tablist"
        aria-label="Type of entry"
      >
        {tabs.map((t) => (
          <button
            key={t.kind}
            type="button"
            role="tab"
            aria-selected={kind === t.kind}
            onClick={() => handleTabChange(t.kind)}
            className={cn(
              "px-3 py-1.5 text-xs font-bold border-line shadow-sm transition-transform active:translate-y-0.5",
              kind === t.kind
                ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                : "bg-panel text-muted hover:bg-page hover:text-text"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form with 2-column fields */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Amount */}
          <div>
            <label htmlFor="q-amount" className="block text-xs font-bold uppercase text-muted mb-1">
              Amount ({currencySymbol}) <span className="text-act">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted select-none">
                {currencySymbol}
              </span>
              <input
                id="q-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                required
                pattern="^\d+(\.\d{1,2})?$"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm font-bold bg-page border-line text-text focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="q-date" className="block text-xs font-bold uppercase text-muted mb-1">
              Date <span className="text-act">*</span>
            </label>
            <input
              id="q-date"
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold bg-page border-line text-text focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </div>

          {/* Account Category (hidden for owner_investment & customer_payment per contract) */}
          {(kind === "sale" || kind === "expense") && (
            <div>
              <label htmlFor="q-account" className="block text-xs font-bold uppercase text-muted mb-1">
                Account
              </label>
              <select
                id="q-account"
                name="account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-page border-line text-text focus:outline-none focus:ring-2 focus:ring-lime"
              >
                {kind === "sale" ? (
                  <>
                    <option value="4000">4000 · Product Sales</option>
                    <option value="4010">4010 · Machining Services</option>
                    <option value="4020">4020 · Consulting & Engineering</option>
                  </>
                ) : (
                  <>
                    <option value="5000">5000 · Direct Materials & Tooling</option>
                    <option value="5100">5100 · Utilities & Power</option>
                    <option value="5200">5200 · Software & Operations</option>
                    <option value="5300">5300 · Logistics & Freight</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Paid Via / Into */}
          <div className={kind === "owner_investment" || kind === "customer_payment" ? "sm:col-span-2" : ""}>
            <label htmlFor="q-via" className="block text-xs font-bold uppercase text-muted mb-1">
              {viaLabel}
            </label>
            <select
              id="q-via"
              name="via"
              value={via}
              onChange={(e) => setVia(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-page border-line text-text focus:outline-none focus:ring-2 focus:ring-lime"
            >
              {(viaOptions[kind] || viaOptions.sale).map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Note / Memo */}
          <div className="sm:col-span-2">
            <label htmlFor="q-memo" className="block text-xs font-bold uppercase text-muted mb-1">
              Note <span className="text-muted font-normal lowercase">(optional)</span>
            </label>
            <input
              id="q-memo"
              name="memo"
              type="text"
              maxLength={200}
              placeholder="e.g. Saturday market takings or Batch #41 CNC machining"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm font-medium bg-page border-line text-text focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-act bg-page p-2 border-line" role="alert">
            ! {errorMsg}
          </p>
        )}

        <Button
          type="submit"
          variant="lime"
          size="md"
          disabled={isSubmitting}
          className="w-full justify-center text-sm uppercase tracking-wider font-bold"
        >
          {isSubmitting ? "Posting to ledger…" : currentTab.verb}
        </Button>

        {statusMessage && (
          <p
            className="text-xs font-bold text-good bg-page p-2 border border-grid text-center"
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </p>
        )}
      </form>
    </div>
  );
};
