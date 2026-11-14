import React, { useEffect, useState, useRef, useCallback } from "react";
import { KpiTile } from "../components/ui/KpiTile";
import { BotCard } from "../components/ui/BotCard";
import { TrendChart } from "../components/ui/TrendChart";
import { DataTable, Column } from "../components/ui/DataTable";
import { QuickEntryForm } from "../components/ui/QuickEntryForm";
import { StatusChip } from "../components/ui/StatusChip";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/currency";
import { initialMockInsights, initialMockEntries } from "../lib/api-mock";
import { is3DSupported, MoneyCityInstance } from "../scenes/MoneyCity";
import type { WorkspaceInsights, RecentEntry, QuickEntryPayload, BotInsight } from "../types";
import {
  Boxes,
  BarChart3,
  RotateCw,
} from "lucide-react";

export interface DashboardProps {
  onNavigateToBot?: (botId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToBot }) => {
  const { showToast } = useToast();

  // Data states
  const [insights, setInsights] = useState<WorkspaceInsights>(initialMockInsights);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>(initialMockEntries);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // 3D vs 2D Hero state
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [support3D, setSupport3D] = useState<boolean>(false);
  const cityContainerRef = useRef<HTMLDivElement>(null);
  const cityInstanceRef = useRef<MoneyCityInstance | null>(null);

  // Bot Action Modals state
  const [activeBotModal, setActiveBotModal] = useState<{
    bot: BotInsight;
    title: string;
    description: string;
    content: React.ReactNode;
    primaryLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Determine 3D support on mount
  useEffect(() => {
    const supported = is3DSupported();
    setSupport3D(supported);
    // If not supported (e.g. mobile, reduced motion, or no WebGL), default to 2D
    if (!supported) {
      setViewMode("2d");
    }
  }, []);

  // Fetch overview & insights data (GET /v1/workspace/overview and /insights)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
      const apiBase = (window as any).ERP_CONFIG?.apiBase || "http://localhost:3002";

      // Attempt to query live API endpoints
      const [overviewRes, insightsRes] = await Promise.all([
        fetch(`${apiBase}/v1/workspace/overview`, {
          headers: { "Content-Type": "application/json" },
        }).catch(() => null),
        fetch(`${apiBase}/v1/workspace/insights`, {
          headers: { "Content-Type": "application/json" },
        }).catch(() => null),
      ]);

      if (overviewRes && overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setIsLiveApi(true);

        // Merge live data with insights format
        setInsights((prev) => ({
          ...prev,
          company: overviewData.company?.name || prev.company,
          workspaceName: overviewData.workspace?.slug || prev.workspaceName,
          currency: overviewData.company?.currency || prev.currency,
          asOf: overviewData.asOf || prev.asOf,
          totals: overviewData.totals || prev.totals,
          trend: overviewData.trend?.length ? overviewData.trend : prev.trend,
        }));

        if (Array.isArray(overviewData.recent) && overviewData.recent.length > 0) {
          setRecentEntries(overviewData.recent);
        }
      } else {
        // Fallback to mock fixtures
        setIsLiveApi(false);
      }

      if (insightsRes && insightsRes.ok) {
        const insightsData = await insightsRes.json();
        if (Array.isArray(insightsData.bots) && insightsData.bots.length > 0) {
          setInsights((prev) => ({
            ...prev,
            bots: insightsData.bots,
          }));
        }
      }
    } catch {
      // Graceful fallback to mock fixtures
      setIsLiveApi(false);
    } finally {
      setIsLoading(false);
      setLastUpdated(timeStr);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mount/update Money City 3D
  useEffect(() => {
    if (viewMode !== "3d" || !support3D || !cityContainerRef.current) {
      if (cityInstanceRef.current) {
        cityInstanceRef.current.destroy();
        cityInstanceRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    // Dynamic import Three.js scene per UI Contract rule
    import("../scenes/MoneyCity").then(({ mountMoneyCity }) => {
      if (isCancelled || !cityContainerRef.current) return;

      if (!cityInstanceRef.current) {
        try {
          cityInstanceRef.current = mountMoneyCity(cityContainerRef.current, {
            currencySymbol: "$",
            totals: insights.totals,
            trend: insights.trend,
          });
        } catch (err) {
          console.warn("Failed to mount 3D Money City:", err);
          setViewMode("2d");
        }
      } else {
        cityInstanceRef.current.update({
          currencySymbol: "$",
          totals: insights.totals,
          trend: insights.trend,
        });
      }
    });

    return () => {
      isCancelled = true;
      if (cityInstanceRef.current) {
        cityInstanceRef.current.destroy();
        cityInstanceRef.current = null;
      }
    };
  }, [viewMode, support3D, insights]);

  // Handle Quick Entry submission
  const handleQuickEntry = async (entry: QuickEntryPayload) => {
    const numAmount = parseFloat(entry.amount);
    const isNegative = entry.kind === "expense";
    const signedAmountStr = isNegative ? `-${numAmount.toFixed(2)}` : numAmount.toFixed(2);

    // Try posting to live backend if connected
    if (isLiveApi) {
      try {
        const apiBase = (window as any).ERP_CONFIG?.apiBase || "http://localhost:3002";
        const res = await fetch(`${apiBase}/v1/workspace/quick-entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (res.ok) {
          const result = await res.json();
          await fetchData();
          showToast(`Posted as ${result.reference || "entry"}. Your figures are updated.`, { type: "success" });
          return;
        }
      } catch (e) {
        console.warn("Live API post failed, falling back to local ledger update:", e);
      }
    }

    // In-memory update for mock fixture mode
    const newEntry: RecentEntry = {
      id: `ENT-${Math.floor(1000 + Math.random() * 9000)}`,
      date: entry.date,
      kind:
        entry.kind === "sale"
          ? "Sale"
          : entry.kind === "expense"
          ? "Expense"
          : entry.kind === "customer_payment"
          ? "Customer Payment"
          : "Owner Investment",
      description: entry.description,
      party: entry.partyName,
      amount: signedAmountStr,
      status: "posted",
    };

    // Update in-memory state
    setRecentEntries((prev) => [newEntry, ...prev]);

    // Recalculate totals string values (pure decimal strings)
    setInsights((prev) => {
      const curCash = parseFloat(prev.totals.cash) || 0;
      const curRev = parseFloat(prev.totals.revenue) || 0;
      const curExp = parseFloat(prev.totals.expenses) || 0;

      let nextCash = curCash;
      let nextRev = curRev;
      let nextExp = curExp;

      if (entry.kind === "sale") {
        nextRev += numAmount;
        nextCash += numAmount;
      } else if (entry.kind === "expense") {
        nextExp += numAmount;
        nextCash = Math.max(0, nextCash - numAmount);
      } else if (entry.kind === "customer_payment") {
        nextCash += numAmount;
      } else if (entry.kind === "owner_investment") {
        nextCash += numAmount;
      }

      const nextProfit = nextRev - nextExp;

      const updatedTotals = {
        cash: nextCash.toFixed(2),
        revenue: nextRev.toFixed(2),
        expenses: nextExp.toFixed(2),
        profit: nextProfit.toFixed(2),
      };

      // Also update latest month trend row
      const updatedTrend = [...prev.trend];
      const lastRow = updatedTrend[updatedTrend.length - 1];
      if (lastRow) {
        const s = (parseFloat(lastRow.sales) || 0) + (entry.kind === "sale" ? numAmount : 0);
        const e = (parseFloat(lastRow.expenses) || 0) + (entry.kind === "expense" ? numAmount : 0);
        updatedTrend[updatedTrend.length - 1] = {
          ...lastRow,
          sales: s.toFixed(2),
          expenses: e.toFixed(2),
          salesRaw: s,
          expensesRaw: e,
        };
      }

      return {
        ...prev,
        totals: updatedTotals,
        trend: updatedTrend,
      };
    });

    showToast(`${newEntry.kind} of $${numAmount.toFixed(2)} posted straight to your books.`, {
      type: "success",
      undoAction: () => {
        setRecentEntries((prev) => prev.filter((item) => item.id !== newEntry.id));
        showToast(`Reversed entry ${newEntry.id}.`, { type: "info" });
      },
    });
  };

  // Bot action handler
  const handleBotAction = (bot: BotInsight) => {
    if (bot.id === "lou") {
      if (onNavigateToBot) {
        onNavigateToBot("ledger-lou");
        return;
      }
    }
    if (bot.id === "chloe") {
      setActiveBotModal({
        bot,
        title: "Review WhatsApp Payment Reminders",
        description: "Chase Chloe has drafted polite payment reminders for overdue balances.",
        content: (
          <div className="space-y-4">
            <div className="bg-page p-3 border-line">
              <span className="text-xs font-bold uppercase text-muted block mb-1">
                Recipient: Titan Industries ($2,850.00 overdue 16 days)
              </span>
              <blockquote className="text-sm bg-panel p-2.5 border border-grid text-text font-medium">
                "Hi Titan Industries team, friendly reminder from Apex Precision Tools: Invoice INV-2026-074 ($2,850.00) was due on Oct 25. Please let us know when payment has been scheduled. Thank you!"
              </blockquote>
            </div>
            <div className="bg-page p-3 border-line">
              <span className="text-xs font-bold uppercase text-muted block mb-1">
                Recipient: Acme Corp ($2,000.00 overdue 14 days)
              </span>
              <blockquote className="text-sm bg-panel p-2.5 border border-grid text-text font-medium">
                "Hi Acme Accounts team, quick follow up regarding INV-2026-079 for $2,000.00. We would appreciate if you could confirm the disbursement date. Many thanks!"
              </blockquote>
            </div>
          </div>
        ),
        primaryLabel: "Send Both Reminders",
        onConfirm: () => {
          showToast("2 WhatsApp payment reminders delivered successfully.", { type: "success" });
          setActiveBotModal(null);
        },
      });
    } else if (bot.id === "rex") {
      setActiveBotModal({
        bot,
        title: "Approve Replenishment PO-2026-004",
        description: "Restock Rex drafted a purchase order for items below safety reorder threshold.",
        content: (
          <div className="space-y-3">
            <div className="bg-page p-3 border-line">
              <h4 className="font-bold text-sm mb-2">Vendor: Industrial Supply Co.</h4>
              <ul className="text-xs space-y-1.5 border-t border-grid pt-2">
                <li className="flex justify-between">
                  <span>6061-T6 Aluminum Round Bar (15 meters)</span>
                  <span className="font-bold">$1,275.00</span>
                </li>
                <li className="flex justify-between">
                  <span>Synthetic Coolant Drum (3 drums)</span>
                  <span className="font-bold">$1,230.00</span>
                </li>
                <li className="flex justify-between">
                  <span>Stainless Steel Hex Bolts M6 (50 packs)</span>
                  <span className="font-bold">$912.50</span>
                </li>
              </ul>
              <div className="flex justify-between border-t border-line mt-3 pt-2 font-display font-bold text-sm">
                <span>Total PO Amount</span>
                <span>$3,417.50</span>
              </div>
            </div>
          </div>
        ),
        primaryLabel: "Approve & Post PO",
        onConfirm: () => {
          showToast("PO-2026-004 approved and sent to Industrial Supply Co.", { type: "success" });
          setActiveBotModal(null);
        },
      });
    } else if (bot.id === "gus") {
      setActiveBotModal({
        bot,
        title: "Inspect Anomaly Flag · INV-8921",
        description: "Guard Gus detected a 98% matching duplicate invoice from Steel Corp Holdings.",
        content: (
          <div className="space-y-3">
            <div className="p-3 bg-yellow/20 border-line text-xs font-bold text-ink">
              ! An identical invoice for $1,240.00 was recorded and approved 6 days ago (INV-8890).
            </div>
            <div className="bg-page p-3 border-line text-xs space-y-1">
              <p><strong>Supplier:</strong> Steel Corp Holdings</p>
              <p><strong>Amount:</strong> $1,240.00</p>
              <p><strong>PO Reference:</strong> PO-2026-002</p>
              <p><strong>Recommendation:</strong> Reject duplicate to avoid paying twice.</p>
            </div>
          </div>
        ),
        primaryLabel: "Reject Duplicate",
        onConfirm: () => {
          showToast("Flag resolved: Duplicate invoice rejected.", { type: "info" });
          setActiveBotModal(null);
        },
      });
    } else {
      showToast(`${bot.name}: ${bot.nextText}`, { type: "info" });
    }
  };

  // Recent entries table columns
  const recentColumns: Column<RecentEntry>[] = [
    {
      header: "Date",
      accessorKey: "date",
      width: "110px",
      cell: (r) => <span className="font-mono text-xs">{r.date}</span>,
    },
    {
      header: "Reference",
      accessorKey: "id",
      width: "110px",
      cell: (r) => <span className="font-bold text-xs">{r.id}</span>,
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: (r) => (
        <div>
          <span className="font-bold text-xs text-text block leading-tight">{r.description}</span>
          <span className="text-[11px] text-muted">{r.party}</span>
        </div>
      ),
    },
    {
      header: "Type",
      accessorKey: "kind",
      width: "140px",
      cell: (r) => (
        <span className="inline-block text-[11px] font-bold px-2 py-0.5 bg-page border border-line">
          {r.kind}
        </span>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amount",
      align: "right",
      width: "130px",
      cell: (r) => {
        const isNeg = r.amount.startsWith("-");
        return (
          <span
            className={`font-mono font-bold text-xs ${
              isNeg ? "text-series-out" : "text-good"
            }`}
          >
            {formatMoney(r.amount)}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      align: "center",
      width: "100px",
      cell: () => <StatusChip status="good" label="Posted" />,
    },
  ];

  return (
    <div className="max-w-[1240px] mx-auto px-4 py-6 space-y-6">
      {/* 1. Greeting & Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b-line">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {insights.company} · {insights.workspaceName}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-line ${
                isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveApi ? "bg-good" : "bg-watch"}`}></span>
              {isLiveApi ? "API Connected" : "Mock Fixture"}
            </span>
          </div>

          <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl uppercase tracking-tight text-text">
            {getGreeting()}, Apex Team.
          </h1>

          <p className="text-xs sm:text-sm text-muted mt-1">
            Figures in {insights.currency}, as at {insights.asOf}. Every number below comes straight from your ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* 2. 4 KPI Tiles counting up on mount */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Cash and bank"
            value={insights.totals.cash}
            variant="lime"
            currencySymbol="$"
            helperText="Live bank & cash vault balance"
          />
          <KpiTile
            label="Sales to date"
            value={insights.totals.revenue}
            variant="panel"
            currencySymbol="$"
            helperText="Product & machining revenue"
          />
          <KpiTile
            label="Expenses to date"
            value={insights.totals.expenses}
            variant="panel"
            currencySymbol="$"
            helperText="Materials, tooling & utilities"
          />
          <KpiTile
            label="Net profit to date"
            value={insights.totals.profit}
            variant="yellow"
            currencySymbol="$"
            helperText="Revenue minus ledger expenses"
          />
        </div>
      </section>

      {/* 3. Hero Section: 3D Money City with 2D fallback toggle */}
      <section className="neo-card p-4 overflow-hidden border-line shadow-card" aria-labelledby="hero-title">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-grid">
          <div>
            <h2 id="hero-title" className="text-[1.15rem] font-bold font-display uppercase tracking-tight text-text">
              Financial Overview & Money City (PLT-23)
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Monthly sales & expenses trajectory with cash reserves stack.
            </p>
          </div>

          {/* Toggle between 3D and 2D */}
          <div className="flex items-center gap-2">
            {support3D ? (
              <div className="flex items-center border-line bg-page p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("3d")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all ${
                    viewMode === "3d"
                      ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                      : "text-muted hover:text-text"
                  }`}
                  aria-pressed={viewMode === "3d"}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>3D Money City</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("2d")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all ${
                    viewMode === "2d"
                      ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                      : "text-muted hover:text-text"
                  }`}
                  aria-pressed={viewMode === "2d"}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>2D Trend Chart</span>
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold text-muted bg-page px-2.5 py-1 border border-grid">
                2D Chart Mode (Touch/Mobile)
              </span>
            )}
          </div>
        </div>

        {/* Hero Content: 3D (when active & supported) + Always-visible 2D Chart */}
        <div
          className={
            viewMode === "3d" && support3D
              ? "grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch"
              : "w-full"
          }
        >
          {viewMode === "3d" && support3D && (
            <div className="xl:col-span-7 relative w-full h-[320px] sm:h-[360px] bg-panel border-line overflow-hidden select-none">
              {/* 3D Canvas Container */}
              <div
                ref={cityContainerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
              />

              {/* Instruction badge */}
              <div className="absolute bottom-3 left-3 pointer-events-none bg-panel/90 backdrop-blur-sm border-line px-3 py-1 shadow-sm">
                <p className="text-[11px] font-bold text-text flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-lime animate-pulse"></span>
                  <span>Drag to spin · Violet is sales, Orange is expenses · Coins are cash</span>
                </p>
              </div>

              {/* Legend pill */}
              <div className="absolute top-3 right-3 pointer-events-none bg-panel/90 backdrop-blur-sm border-line px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-series-in border border-ink"></span>
                    <span>Sales</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-series-out border border-ink"></span>
                    <span>Expenses</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-lime border border-ink"></span>
                    <span>Cash</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div
            className={
              viewMode === "3d" && support3D
                ? "xl:col-span-5 p-3 sm:p-4 bg-page border-line flex flex-col justify-center"
                : "p-2 sm:p-4 bg-page border-line"
            }
          >
            <TrendChart data={insights.trend} />
          </div>
        </div>
      </section>

      {/* 4. Two-Column Layout: QuickEntryForm & Recent Entries DataTable */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Quick Entry Form (5 cols) */}
        <div className="lg:col-span-5">
          <QuickEntryForm currencySymbol="$" onSubmit={handleQuickEntry} />
        </div>

        {/* Right Column: Recent Entries DataTable (7 cols) */}
        <div className="lg:col-span-7 neo-card p-4">
          <div className="flex items-center justify-between gap-4 mb-4 pb-2 border-b border-grid">
            <div>
              <h2 className="text-[1.15rem] font-bold font-display uppercase tracking-tight text-text leading-tight">
                Latest Entries
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Double-entry journals recorded in this period.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-muted">
              {recentEntries.length} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <DataTable
              columns={recentColumns}
              data={recentEntries}
              emptyTitle="No recent ledger entries"
              emptyDescription="Record a sale or expense above to start populating your books."
            />
          </div>
        </div>
      </div>

      {/* 5. Live Bot Crew Summary Grid */}
      <section className="neo-card p-4" aria-labelledby="crew-title">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-grid">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-pink text-white border-line flex items-center justify-center font-bold text-sm shadow-[2px_2px_0_var(--q-ink)]">
              AI
            </div>
            <div>
              <h2 id="crew-title" className="text-[1.15rem] font-bold font-display uppercase tracking-tight text-text leading-tight">
                Your Bot Crew, Working on Your Numbers
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Each bot reads the entries you record and tells you what it found and what it would do next.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-page px-3 py-1.5 border-line shadow-sm">
            <span className="w-2 h-2 rounded-full bg-good animate-ping"></span>
            <span className="text-xs font-bold text-text">
              Live · updated {lastUpdated || "just now"}
            </span>
          </div>
        </div>

        {/* 6-Bot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onAction={handleBotAction} />
          ))}
        </div>
      </section>

      {/* 6. Bot Action Review Modal */}
      {activeBotModal && (
        <Modal
          isOpen={true}
          onClose={() => setActiveBotModal(null)}
          title={activeBotModal.title}
          description={activeBotModal.description}
          primaryActionLabel={activeBotModal.primaryLabel}
          onPrimaryAction={activeBotModal.onConfirm}
          secondaryActionLabel="Dismiss"
          onSecondaryAction={() => setActiveBotModal(null)}
        >
          {activeBotModal.content}
        </Modal>
      )}
    </div>
  );
};
