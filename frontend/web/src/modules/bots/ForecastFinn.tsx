import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { CashRiver3D } from "../../scenes/CashRiver3D";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  initialForecastFinnData,
  initialCashForecastPoints,
} from "../../lib/api-mock";
import type {
  ForecastFinnData,
  CashForecastPoint,
} from "../../types";
import {
  Power,
  RotateCw,
  AlertTriangle,
  Waves,
  ShieldCheck,
} from "lucide-react";

export interface ForecastFinnProps {
  onNavigateBack?: () => void;
  onNavigateToFinancials?: () => void;
}

export const ForecastFinn: React.FC<ForecastFinnProps> = ({ onNavigateBack, onNavigateToFinancials }) => {
  const { showToast } = useToast();

  // State
  const [data] = useState<ForecastFinnData>(initialForecastFinnData);
  const [points] = useState<CashForecastPoint[]>(initialCashForecastPoints);
  const [scenario, setScenario] = useState<"expected" | "conservative" | "optimistic">("expected");
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);

  // Sync / Refresh
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
        setIsLiveApi(true);
      } else {
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

  // Kill Switch Toggle
  const handleToggleKillSwitch = () => {
    const nextState = !isKillSwitchActive;
    setIsKillSwitchActive(nextState);

    showToast(
      nextState
        ? "Forecast Finn resumed: Working capital simulation and cash river forecasting active."
        : "Forecast Finn kill switch engaged: Cash runway and burn rate models suspended.",
      { type: nextState ? "success" : "warning" }
    );
  };

  // Scenario change
  const handleScenarioChange = (s: "expected" | "conservative" | "optimistic") => {
    setScenario(s);
    showToast(`Cash river model re-calibrated to ${s.toUpperCase()} scenario.`, {
      type: "info",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="text-xs font-bold text-muted hover:text-text flex items-center gap-1 transition-colors"
            >
              ← Back to Dashboard
            </button>
          )}
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-mono font-bold text-muted uppercase">
            Agents & Automated Bots
          </span>
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-bold text-text">Forecast Finn (AIS-02)</span>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToFinancials && (
            <button
              type="button"
              onClick={onNavigateToFinancials}
              className="px-2.5 py-1 text-[11px] font-bold bg-page border border-line hover:bg-cream text-text shadow-sm"
            >
              View Financial Statements (FIN-05) →
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-line ${
              isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveApi ? "bg-good" : "bg-watch"}`} />
            {isLiveApi ? "API Connected" : "Mock Fixture"}
          </span>
          <span className="text-xs font-mono font-bold text-muted">
            Agent Card: AIS-02 · FIN-15
          </span>
        </div>
      </div>

      {/* 2. Bot Header with Finn Avatar, Role, Kill Switch, and Live Pulse */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        aria-label="Forecast Finn Agent Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar strictly following design/tokens.json: bot.forecast-finn (violet token #8b6bff) */}
            <div className="w-16 h-16 bg-violet text-white border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="32" fill="var(--q-violet)" stroke="var(--q-ink)" strokeWidth="3" />
                <path d="M22 46 C28 36, 36 36, 40 44 C44 52, 52 52, 58 42" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
                <circle cx="30" cy="28" r="4" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="2" />
                <circle cx="50" cy="28" r="4" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="2" />
              </svg>
              {isKillSwitchActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-good rounded-full border-2 border-ink" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text leading-tight">
                  Forecast Finn
                </h1>
                <span className="px-2 py-0.5 bg-violet/20 border border-violet text-[11px] font-bold text-ink uppercase tracking-wider">
                  Cash Flow Forecaster
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  AIS-02 / FIN-15
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal">
                Continuous working capital & cash river forecaster: models scheduled receivables against recurring opex and tax obligations across 30, 60, and 90-day liquidity horizons.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-col items-start lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-grid">
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

        {!isKillSwitchActive && (
          <div className="mt-4 p-3 bg-cream border-line flex items-center gap-3 text-xs text-ink font-semibold shadow-sm">
            <AlertTriangle className="w-4 h-4 text-act flex-shrink-0" />
            <span>
              Kill switch is engaged. Automated cash river simulations, runway stress-tests, and working capital forecasts are paused.
            </span>
          </div>
        )}
      </section>

      {/* 3. StatusChip Display Section */}
      <section
        className="neo-card p-4 bg-page border-line shadow-card"
        aria-label="Forecast Finn Status Overview"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-grid">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Live Cash Runway & Liquidity Status
            </h2>
            <p className="text-xs text-text font-medium mt-0.5">
              Monitoring bank liquidity against known recurring payables and customer remittance commitments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status="good"
              label="✓ Cash runway positive"
            />

            <StatusChip
              status="watch"
              label="! 60-day tax outlay dip"
            />

            <StatusChip
              status="good"
              label="● Net working capital healthy"
            />
          </div>
        </div>

        {/* 4 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              30-Day Projected Cash
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.cash30Day)}
              </span>
              <span className="text-xs font-mono font-bold text-good">+15.6%</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Expected net operating gain</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Cash Runway
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {data.runwayMonths} Months
              </span>
              <span className="text-xs font-mono font-bold text-good">&gt; 12m Target</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Sufficient liquidity cushion</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              90-Day Liquidity Target
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.cash90Day)}
              </span>
              <span className="text-xs font-mono font-bold text-violet">Solid Buffer</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Absorbs quarterly tax dip</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Monthly Operational Burn
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.monthlyBurnRate)}
              </span>
              <span className="text-xs font-mono font-bold text-series-out">Fixed Opex</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Rent, wages & utilities</p>
          </div>
        </div>
      </section>

      {/* 4. Cash River Visualization & Scenario Controls */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card space-y-4"
        aria-label="Cash River Visualization"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-extrabold text-lg uppercase tracking-tight text-text leading-tight flex items-center gap-2">
              <Waves className="w-5 h-5 text-violet" />
              <span>Cash River Trajectory (30 · 60 · 90 Days)</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Flowing cash projection ribbon showing expected bank balance bounded by sensitivity envelopes.
            </p>
          </div>

          {/* Scenario Selector Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted mr-1">Scenario:</span>
            {(["conservative", "expected", "optimistic"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleScenarioChange(s)}
                className={`px-2.5 py-1 text-xs font-bold border-line uppercase transition-all ${
                  scenario === s
                    ? "bg-violet text-white shadow-[2px_2px_0_var(--q-ink)]"
                    : "bg-page text-muted hover:text-text hover:bg-page/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Cash River Visualization (Desktop with fine pointer & motion) */}
        <CashRiver3D points={points} scenario={scenario} />

        {/* 2D Cash River Graphic */}
        <div className="p-4 bg-page border-line space-y-3">
          <div className="flex items-center justify-between text-xs text-muted font-bold pb-2 border-b border-grid">
            <span>Projection Milestone Nodes</span>
            <span>Scenario Active: <strong className="text-text uppercase">{scenario}</strong></span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {points.map((pt) => {
              const balance =
                scenario === "conservative"
                  ? pt.conservativeBalance
                  : scenario === "optimistic"
                  ? pt.optimisticBalance
                  : pt.projectedBalance;

              return (
                <div
                  key={pt.day}
                  className="p-3 bg-panel border-line shadow-sm space-y-1 relative group hover:-translate-y-0.5 transition-transform"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                    <span className="font-bold">{pt.label}</span>
                    <span>+{pt.day}d</span>
                  </div>
                  <div className="font-display font-black text-base text-text">
                    {formatMoney(balance)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted pt-1 border-t border-grid">
                    <span className="text-series-in">+{formatMoney(pt.inflowScheduled)}</span>
                    <span className="text-series-out">-{formatMoney(pt.outflowScheduled)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scheduled Milestones Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                <th className="py-2.5 px-3">Horizon & Date</th>
                <th className="py-2.5 px-3 text-right">Scheduled Inflow</th>
                <th className="py-2.5 px-3 text-right">Scheduled Outflow</th>
                <th className="py-2.5 px-3 text-right">Projected Balance</th>
                <th className="py-2.5 px-3">Major Scheduled Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {points.map((pt) => (
                <tr key={pt.day} className="hover:bg-page/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-text">
                    {pt.label} ({pt.date})
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-right text-series-in">
                    {pt.inflowScheduled === "0.00" ? "—" : `+${formatMoney(pt.inflowScheduled)}`}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-right text-series-out">
                    {pt.outflowScheduled === "0.00" ? "—" : `-${formatMoney(pt.outflowScheduled)}`}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-black text-right text-text text-sm">
                    {formatMoney(
                      scenario === "conservative"
                        ? pt.conservativeBalance
                        : scenario === "optimistic"
                        ? pt.optimisticBalance
                        : pt.projectedBalance
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-muted text-xs">
                    {pt.eventMemo || "Standard working capital flow"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Activity Log & Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Finn Activity Stream */}
        <div className="lg:col-span-7 neo-card p-4 bg-panel border-line shadow-card">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-grid">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
                Finn Simulation Stream
              </h3>
              <p className="text-[11px] text-muted">
                Audit trail of working capital projections and cash sensitivity evaluations.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-page border border-grid text-muted">
              Live Model
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                time: "07:30",
                event: "Cash River 90-day simulation executed",
                result: "Projected Q1 2027 bank balance exceeds $53,000.00 target",
                type: "good",
              },
              {
                time: "08:00",
                event: "Tax outlay sensitivity analysis",
                result: "Identified $18,500.00 January tax commitment; safe buffer confirmed",
                type: "watch",
              },
              {
                time: "11:20",
                event: "Burn rate stability check",
                result: "Monthly burn held steady at $14,200.00 across 3 consecutive cycles",
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
                    feed.type === "good" ? "bg-good" : "bg-watch"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Guardrails Card */}
        <div className="lg:col-span-5 neo-card p-4 bg-panel border-line shadow-card space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-grid">
            <ShieldCheck className="w-4 h-4 text-good" />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
              Agent Guardrails (AIS-02)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Read-Only Simulation</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Finn operates strictly at Canonical Tier 1. It projects scenarios and evaluates runway, but cannot move money or alter invoices.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Design Token Conformance</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Finn strictly employs <code className="font-bold">var(--q-violet)</code> (violet design token) for avatar and graphical highlights per <code>tokens.json</code>.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">2D & 3D Twin Equivalence</span>
              <p className="text-[11px] text-muted leading-relaxed">
                All data visualised in 3D is mirrored on the 2D page, ensuring full accessibility and mobile parity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastFinn;
