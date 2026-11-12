import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { UnpostedEntriesModal } from "./UnpostedEntriesModal";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  initialLedgerLouData,
  initialUnpostedEntries,
  initialMonthEndChecklist,
  mockBankStatementLines,
} from "../../lib/api-mock";
import type {
  LedgerLouData,
  UnpostedEntry,
  MonthEndChecklistItem,
} from "../../types";
import {
  Power,
  RotateCw,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export interface LedgerLouProps {
  onNavigateBack?: () => void;
}

export const LedgerLou: React.FC<LedgerLouProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();

  // State
  const [data, setData] = useState<LedgerLouData>(initialLedgerLouData);
  const [checklist, setChecklist] = useState<MonthEndChecklistItem[]>(initialMonthEndChecklist);
  const [unpostedEntries, setUnpostedEntries] = useState<UnpostedEntry[]>(initialUnpostedEntries);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);

  // Modals & Drawers
  const [isUnpostedModalOpen, setIsUnpostedModalOpen] = useState<boolean>(false);
  const [isBankDrawerOpen, setIsBankDrawerOpen] = useState<boolean>(false);
  const [isLockPeriodConfirmOpen, setIsLockPeriodConfirmOpen] = useState<boolean>(false);
  const [isPeriodLocked, setIsPeriodLocked] = useState<boolean>(false);

  // Fetch bot responses reflecting GET /v1/workspace/insights
  const fetchBotInsights = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    try {
      const apiBase = (window as any).ERP_CONFIG?.apiBase || "http://localhost:3002";
      const res = await fetch(`${apiBase}/v1/workspace/insights`, {
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        setIsLiveApi(true);

        // If backend returns Lou insight in bots array
        if (Array.isArray(json.bots)) {
          const louInsight = json.bots.find((b: any) => b.id === "lou");
          if (louInsight) {
            setData((prev) => ({
              ...prev,
              role: louInsight.role || prev.role,
              balancesBalanced: louInsight.status === "good",
              lastUpdated: timeStr,
            }));
          }
        }
      } else {
        // Fallback to mock bot fixture
        setIsLiveApi(false);
      }
    } catch {
      setIsLiveApi(false);
    } finally {
      setIsLoading(false);
      setLastUpdated(timeStr);
    }
  }, []);

  useEffect(() => {
    fetchBotInsights();
  }, [fetchBotInsights]);

  // Toggle Kill Switch
  const handleToggleKillSwitch = () => {
    const nextState = !isKillSwitchActive;
    setIsKillSwitchActive(nextState);
    if (nextState) {
      showToast("Ledger Lou activated. Continuous month-end invariant checks resumed.", {
        type: "success",
      });
    } else {
      showToast("Ledger Lou kill switch engaged. Automated checks and draft creation suspended.", {
        type: "info",
      });
    }
  };

  // Handle Approve & Post from UnpostedEntriesModal
  const handleApproveAndPostEntries = () => {
    const count = unpostedEntries.length;
    const totalAmount = data.totalDraftAmount;

    // Clear unposted entries
    setUnpostedEntries([]);

    // Update checklist item 3 (Unposted depreciation)
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id === "unposted_depreciation") {
          return {
            ...item,
            status: "good",
            statusLabel: "✓ All posted",
            isCompleted: true,
            figures: [
              { label: "Draft Entries", value: "0" },
              { label: "Total Amount", value: "0.00" },
            ],
            actionLabel: "View Posted",
          };
        }
        return item;
      })
    );

    // Update Lou data state
    setData((prev) => ({
      ...prev,
      unpostedCount: 0,
      totalDraftAmount: "0.00",
    }));

    setIsUnpostedModalOpen(false);

    showToast(
      `Approve & Post successful: ${count} draft entries (${formatMoney(totalAmount)}) posted to General Ledger.`,
      { type: "success" }
    );
  };

  // Handle Lock Period Confirm
  const handleLockPeriod = () => {
    setIsLockPeriodConfirmOpen(false);
    setIsPeriodLocked(true);

    // Update checklist item 4 (Closed period lock)
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id === "period_lock") {
          return {
            ...item,
            status: "good",
            statusLabel: "✓ Period locked",
            isCompleted: true,
            figures: [
              { label: "Closed Period", value: "Nov 2026" },
              { label: "Lock Status", value: "Locked" },
            ],
            actionLabel: "View Lock Audit",
          };
        }
        return item;
      })
    );

    setData((prev) => ({
      ...prev,
      periodClosingPending: false,
    }));

    showToast("Fiscal period November 2026 locked successfully. Backdated entries are now restricted.", {
      type: "success",
    });
  };

  // Checklist Action Handler
  const handleChecklistAction = (item: MonthEndChecklistItem) => {
    if (item.id === "bank_rec") {
      setIsBankDrawerOpen(true);
    } else if (item.id === "unposted_depreciation") {
      setIsUnpostedModalOpen(true);
    } else if (item.id === "period_lock") {
      if (!isPeriodLocked) {
        setIsLockPeriodConfirmOpen(true);
      } else {
        showToast("Period 2026-11 is already locked and protected.", { type: "info" });
      }
    } else if (item.id === "unallocated_cash") {
      showToast("All cash transactions have been assigned to customer invoices.", { type: "info" });
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 py-6 space-y-6">
      {/* 1. Breadcrumb / Navigation back */}
      <div className="flex items-center justify-between pb-2 border-b border-grid">
        <button
          type="button"
          onClick={onNavigateBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-text transition-colors"
        >
          <span>← Return to Workspace Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-line ${
              isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveApi ? "bg-good" : "bg-watch"}`} />
            {isLiveApi ? "API Connected" : "Mock Fixture"}
          </span>
          <span className="text-xs font-mono font-bold text-muted">
            Agent Card: AGT-03 · FIN-13
          </span>
        </div>
      </div>

      {/* 2. Bot Header with Lou avatar, role, kill switch, and live indicator */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        aria-label="Ledger Lou Agent Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Lou Avatar & Identity */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar strictly following design/tokens.json: bot.ledger-lou (cyan token) */}
            <div className="w-16 h-16 bg-cyan text-ink border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <line x1="40" y1="8" x2="40" y2="16" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="40" cy="7" r="4" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="2" />
                <rect x="16" y="16" width="48" height="40" rx="14" fill="var(--q-cyan)" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="32" cy="34" r="5" fill="var(--q-ink)" />
                <circle cx="48" cy="34" r="5" fill="var(--q-ink)" />
                <path d="M33 46 H47" fill="none" stroke="var(--q-ink)" strokeWidth="3" strokeLinecap="round" />
                <rect x="24" y="58" width="32" height="14" rx="6" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="3" />
              </svg>
              {isKillSwitchActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-good rounded-full border-2 border-ink" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text leading-tight">
                  Ledger Lou
                </h1>
                <span className="px-2 py-0.5 bg-cyan/20 border border-cyan text-[11px] font-bold text-ink uppercase tracking-wider">
                  Month-End Checker
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  AGT-03 / FIN-13
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal">
                Continuous month-end checking: verifies trial balance zero-sum invariants, reconciles bank balances against general ledger, drafts depreciation entries, and prepares fiscal period locks.
              </p>
            </div>
          </div>

          {/* Right: Kill Switch & Live Indicator */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-grid">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 bg-page px-3 py-1.5 border-line shadow-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  isKillSwitchActive ? "bg-good animate-ping" : "bg-watch"
                }`}
              />
              <span className="text-xs font-bold text-text">
                Live · updated {lastUpdated || "just now"}
              </span>
              <button
                type="button"
                onClick={fetchBotInsights}
                disabled={isLoading}
                title="Sync from API"
                className="ml-1 text-muted hover:text-text disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* On/Off Kill Switch */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Kill Switch:
              </span>
              <button
                type="button"
                onClick={handleToggleKillSwitch}
                aria-pressed={isKillSwitchActive}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border-line shadow-[2px_2px_0_var(--q-ink)] transition-transform active:translate-y-0.5 ${
                  isKillSwitchActive
                    ? "bg-lime text-ink hover:bg-lime/90"
                    : "bg-act text-white hover:bg-act/90"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isKillSwitchActive ? "ACTIVE (ON)" : "OFF (SUSPENDED)"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Kill Switch Alert Banner when suspended */}
        {!isKillSwitchActive && (
          <div className="mt-4 p-3 bg-cream border-line flex items-center gap-3 text-xs text-ink font-semibold shadow-sm">
            <AlertTriangle className="w-4 h-4 text-act flex-shrink-0" />
            <span>
              Kill switch is engaged. Automated invariant checks, scheduled background evaluations, and draft proposals are paused.
            </span>
          </div>
        )}
      </section>

      {/* 3. StatusChip Display section per deliverable specification */}
      <section
        className="neo-card p-4 bg-page border-line shadow-card"
        aria-label="Ledger Lou Status Overview"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-grid">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Live Invariant & Closing Status
            </h2>
            <p className="text-xs text-text font-medium mt-0.5">
              Continuous monitoring of General Ledger zero-sum balance and closing requirements.
            </p>
          </div>

          {/* Explicit StatusChips required by prompt */}
          <div className="flex flex-wrap items-center gap-2">
            {/* StatusChip: ✓ All balanced */}
            <StatusChip
              status={data.balancesBalanced ? "good" : "act"}
              label="✓ All balanced"
            />

            {/* StatusChip: ! 2 unposted items */}
            <StatusChip
              status={unpostedEntries.length > 0 ? "watch" : "good"}
              label={
                unpostedEntries.length > 0
                  ? `! ${unpostedEntries.length} unposted items`
                  : "✓ 0 unposted items"
              }
            />

            {/* StatusChip: ● Period closing pending */}
            <StatusChip
              status={isPeriodLocked ? "good" : "act"}
              label={isPeriodLocked ? "✓ Period locked" : "● Period closing pending"}
            />
          </div>
        </div>

        {/* 4 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Trial Balance Invariant
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">Zero Diff</span>
              <span className="text-xs font-mono font-bold text-good">Δ $0.00</span>
            </div>
            <p className="text-[11px] text-muted mt-1">142 journals balanced</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Bank Balance Cleared
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">$42,150.00</span>
              <span className="text-xs font-mono font-bold text-good">100% matched</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Statement reconciled</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Unposted Draft Schedules
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.totalDraftAmount)}
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  unpostedEntries.length > 0 ? "text-watch" : "text-good"
                }`}
              >
                {unpostedEntries.length} items
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              {unpostedEntries.length > 0 ? "Tier 2 drafts pending" : "All drafts posted"}
            </p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Fiscal Period Status
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">Nov 2026</span>
              <span
                className={`text-xs font-mono font-bold ${
                  isPeriodLocked ? "text-good" : "text-act"
                }`}
              >
                {isPeriodLocked ? "Locked" : "Open"}
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">Period close target: Nov 30</p>
          </div>
        </div>
      </section>

      {/* 4. Month-End Closing Checklist Table */}
      <section
        className="neo-card p-4 bg-panel border-line shadow-card"
        aria-label="Month-End Closing Checklist"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-extrabold text-lg uppercase tracking-tight text-text leading-tight">
              Month-End Closing Checklist (FIN-13)
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Four verified closing requirements before November 2026 books are sealed.
            </p>
          </div>

          {unpostedEntries.length > 0 && (
            <Button
              variant="lime"
              size="sm"
              onClick={() => setIsUnpostedModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Review {unpostedEntries.length} Unposted Drafts</span>
            </Button>
          )}
        </div>

        {/* Checklist Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                <th className="py-2.5 px-3">Closing Requirement</th>
                <th className="py-2.5 px-3">Target Account / Scope</th>
                <th className="py-2.5 px-3">Figures & Status</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {checklist.map((item) => {
                const isUnpostedItem = item.id === "unposted_depreciation";
                const isPeriodLockItem = item.id === "period_lock";

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-page/70 transition-colors"
                  >
                    {/* Item & Description */}
                    <td className="py-3 px-3 align-top max-w-xs">
                      <div className="font-bold text-sm text-text flex items-center gap-1.5">
                        {item.title}
                      </div>
                      <p className="text-xs text-muted mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </td>

                    {/* Target Account */}
                    <td className="py-3 px-3 align-top font-mono text-xs text-text font-semibold">
                      <span className="px-2 py-0.5 bg-page border border-grid">
                        {item.targetAccount}
                      </span>
                    </td>

                    {/* Figures */}
                    <td className="py-3 px-3 align-top">
                      <div className="space-y-1">
                        {item.figures.map((fig, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="text-muted text-[11px]">{fig.label}:</span>
                            <span className="font-mono font-bold text-text">
                              {fig.value.includes(".")
                                ? formatMoney(fig.value)
                                : fig.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* StatusChip */}
                    <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                      <StatusChip status={item.status} label={item.statusLabel} />
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant={
                          isUnpostedItem && unpostedEntries.length > 0
                            ? "lime"
                            : isPeriodLockItem && !isPeriodLocked
                            ? "yellow"
                            : "ghost"
                        }
                        onClick={() => handleChecklistAction(item)}
                        className="text-xs py-1 px-3"
                      >
                        <span>{item.actionLabel || "Inspect"}</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Activity Log & Guardrails Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Lou Activity Feed (7 cols) */}
        <div className="lg:col-span-7 neo-card p-4 bg-panel border-line shadow-card">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-grid">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
                Lou Activity Log
              </h3>
              <p className="text-[11px] text-muted">
                Audit trail of recent invariant evaluations and reconciliation alerts.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-page border border-grid text-muted">
              Continuous Loop
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                time: "08:00",
                event: "Bank line $42,000.00 unmatched",
                result: "Likely customer wire payment for invoice INV-318",
                type: "watch",
              },
              {
                time: "08:05",
                event: "Entry posted after previous period close",
                result: "Flagged for supervisor review in audit queue",
                type: "act",
              },
              {
                time: "10:30",
                event: "Month-end closing checklist prepared",
                result: "3 of 4 invariant items verified and balanced",
                type: "good",
              },
              {
                time: "17:00",
                event: "Reconciliation invariant 100% matched",
                result: "Zero variance between Statement and GL 1100",
                type: "good",
              },
            ].map((feed, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2.5 bg-page border-line text-xs hover:bg-page/80 transition-colors"
              >
                <span className="font-mono font-bold text-muted text-[11px] px-1.5 py-0.5 bg-panel border border-grid flex-shrink-0">
                  {feed.time}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text truncate">{feed.event}</p>
                  <p className="text-[11px] text-muted mt-0.5">{feed.result}</p>
                </div>
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    feed.type === "good"
                      ? "bg-good"
                      : feed.type === "watch"
                      ? "bg-watch"
                      : "bg-act"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Agent Guardrails & Governance (5 cols) */}
        <div className="lg:col-span-5 neo-card p-4 bg-panel border-line shadow-card space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-grid">
            <ShieldCheck className="w-4 h-4 text-good" />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
              Agent Guardrails (AGT-03)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Non-Autonomous Period Close</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Ledger Lou reads and flags invariants. It never locks periods or posts journals without Tier 3 human approval.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Strict Token Conformance</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Avatar colors (cyan design token) and status indicators strictly honor QAVRIL design tokens.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Deterministic Provenance</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Every calculation cites its underlying register schedule (FIN-04, FIN-13) and maintains double-entry equality.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Unposted Entries Review Modal (Deliverable 2) */}
      <UnpostedEntriesModal
        isOpen={isUnpostedModalOpen}
        onClose={() => setIsUnpostedModalOpen(false)}
        entries={unpostedEntries}
        totalDraftAmount={data.totalDraftAmount}
        onApproveAndPost={handleApproveAndPostEntries}
        currencySymbol="$"
      />

      {/* 6. Bank Reconciliation Review Drawer */}
      <Drawer
        isOpen={isBankDrawerOpen}
        onClose={() => setIsBankDrawerOpen(false)}
        title="Bank Reconciliation Inspection"
        description="Verification of General Ledger Account 1100 (Bank) against matched statement feed lines."
        secondaryActionLabel="Close"
        onSecondaryAction={() => setIsBankDrawerOpen(false)}
      >
        <div className="space-y-4">
          <div className="p-3 bg-page border-line space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted">GL Book Balance (1100):</span>
              <span className="font-mono font-bold">$42,150.00</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Bank Statement Cleared:</span>
              <span className="font-mono font-bold">$42,150.00</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-grid font-bold">
              <span>Reconciliation Variance:</span>
              <span className="font-mono text-good">$0.00 (Balanced)</span>
            </div>
          </div>

          <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-muted">
            Cleared Statement Lines
          </h3>

          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {mockBankStatementLines.map((line) => (
              <div
                key={line.id}
                className="p-3 bg-panel border-line shadow-sm space-y-1 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-text">{line.description}</span>
                  <span
                    className={`font-mono font-bold ${
                      line.amount.startsWith("-") ? "text-series-out" : "text-series-in"
                    }`}
                  >
                    {formatMoney(line.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-grid">
                  <span>Effective Date: {line.date}</span>
                  <span className="font-mono text-good font-bold">
                    ✓ Matched {line.matchedRef}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* 7. Tier 3 Confirm Dialog for Period Lock */}
      <ConfirmDialog
        isOpen={isLockPeriodConfirmOpen}
        onClose={() => setIsLockPeriodConfirmOpen(false)}
        title="Lock Fiscal Period November 2026?"
        message="Locking period 2026-11 is a Tier 3 action. Once locked, no further sales, expenses, or journals can be posted to this period without explicit administrator override."
        actionVerb="Lock Period Nov 2026"
        actionVariant="pink"
        onConfirm={handleLockPeriod}
      />
    </div>
  );
};

export default LedgerLou;
