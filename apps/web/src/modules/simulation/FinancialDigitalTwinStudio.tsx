import React, { useState, useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { eventBus } from "../../lib/event-stream";
import {
  SCENARIO_PRESETS,
  DEFAULT_BASELINE_PARAMS,
  calculateScenarioProjection,
} from "../../lib/scenario-simulation";
import type { ScenarioParameters } from "../../types";
import {
  Sliders,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Bot,
  Zap,
  ArrowRight,
} from "lucide-react";

export interface FinancialDigitalTwinStudioProps {
  onOpenCashRiver3D?: () => void;
  onNavigateToInbox?: () => void;
}

export const FinancialDigitalTwinStudio: React.FC<FinancialDigitalTwinStudioProps> = ({
  onOpenCashRiver3D,
  onNavigateToInbox,
}) => {
  const { showToast } = useToast();
  const [params, setParams] = useState<ScenarioParameters>(DEFAULT_BASELINE_PARAMS);
  const [activePresetKey, setActivePresetKey] = useState<string>("baseline");
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  // Re-calculate projection whenever parameters change
  const projection = useMemo(() => {
    return calculateScenarioProjection(params);
  }, [params]);

  const handleApplyPreset = (key: string) => {
    setActivePresetKey(key);
    setParams(SCENARIO_PRESETS[key] || DEFAULT_BASELINE_PARAMS);
  };

  const handleReset = () => {
    setActivePresetKey("baseline");
    setParams(DEFAULT_BASELINE_PARAMS);
    showToast("Parameters reset to baseline", undefined, "good");
  };

  const handleCommitScenario = () => {
    setIsCommitting(true);
    setTimeout(() => {
      eventBus.emit({
        type: "scenario.simulated",
        producer: "services/uaap/financial_digital_twin",
        data: {
          scenarioName: params.scenarioName,
          runwayMonths: projection.projectedRunwayMonths,
          cash90d: projection.projectedCash90d,
          riskLevel: projection.riskLevel,
          riskScore: projection.riskScore,
        },
      });

      setIsCommitting(false);
      showToast(
        `Committed "${params.scenarioName}" stress scenario to Executive Approvals Memo`,
        undefined,
        "good"
      );
      if (onNavigateToInbox) {
        onNavigateToInbox();
      }
    }, 400);
  };

  return (
    <div className="space-y-6" data-testid="digital-twin-studio">
      {/* Title & Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pink block">
            Executive Financial Sandbox · AIS-02 / FIN-09
          </span>
          <h1 className="font-display font-extrabold text-3xl uppercase tracking-tight text-text leading-tight">
            Financial Digital Twin & Stress Testing
          </h1>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Simulate macroeconomic shocks, demand swings, and supply price inflation in real-time.
            Twist parameters to test runway resilience before taking high-stakes cash decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenCashRiver3D && (
            <Button
              variant="violet"
              size="md"
              data-testid="open-cash-river-btn"
              onClick={onOpenCashRiver3D}
            >
              <Zap className="w-4 h-4 mr-1.5" />
              View Cash River 3D
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            data-testid="reset-scenario-btn"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Preset Macro Shock Buttons */}
      <div className="p-4 bg-page border-line space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
          Preset Macro Stress Shocks:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(SCENARIO_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              data-testid={`preset-btn-${key}`}
              onClick={() => handleApplyPreset(key)}
              className={`px-3 py-1.5 text-xs font-bold font-mono border-line transition-all cursor-pointer ${
                activePresetKey === key
                  ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)] -translate-x-0.5 -translate-y-0.5"
                  : "bg-panel text-muted hover:text-text hover:bg-page"
              }`}
            >
              {preset.scenarioName}
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid: Left Sliders, Right Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: PARAMETER CONTROL DECK (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="neo-card p-4 bg-panel space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-grid">
              <span className="text-xs font-display font-extrabold uppercase flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan" />
                <span>Stress Parameters</span>
              </span>
              <span className="text-[11px] font-mono text-muted">Real-Time Reactive</span>
            </div>

            {/* Slider 1: Revenue Growth Delta */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold">Demand / Revenue Delta</label>
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 text-xs border border-ink ${
                    params.revenueGrowthDelta >= 0 ? "bg-good/20 text-good" : "bg-danger/20 text-pink"
                  }`}
                >
                  {params.revenueGrowthDelta >= 0 ? `+${params.revenueGrowthDelta}%` : `${params.revenueGrowthDelta}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={params.revenueGrowthDelta}
                onChange={(e) => {
                  setActivePresetKey("custom");
                  setParams({ ...params, revenueGrowthDelta: Number(e.target.value) });
                }}
                data-testid="slider-revenue"
                className="w-full accent-cyan cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>-50% (Depression)</span>
                <span>0% (Baseline)</span>
                <span>+50% (Boom)</span>
              </div>
            </div>

            {/* Slider 2: COGS / Supply Chain Inflation */}
            <div className="space-y-1.5 pt-2 border-t border-grid">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold">COGS / Material Inflation</label>
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 text-xs border border-ink ${
                    params.cogsInflationDelta > 10 ? "bg-danger/20 text-pink" : "bg-page text-text"
                  }`}
                >
                  +{params.cogsInflationDelta}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="2"
                value={params.cogsInflationDelta}
                onChange={(e) => {
                  setActivePresetKey("custom");
                  setParams({ ...params, cogsInflationDelta: Number(e.target.value) });
                }}
                data-testid="slider-cogs"
                className="w-full accent-pink cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>+0%</span>
                <span>+20%</span>
                <span>+40% (Severe Shock)</span>
              </div>
            </div>

            {/* Slider 3: Debtor DSO Slippage */}
            <div className="space-y-1.5 pt-2 border-t border-grid">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold">Customer Payment Slippage (DSO)</label>
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 text-xs border border-ink ${
                    params.dsoDaysDelta >= 30 ? "bg-danger/20 text-pink" : "bg-page text-text"
                  }`}
                >
                  +{params.dsoDaysDelta} Days
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={params.dsoDaysDelta}
                onChange={(e) => {
                  setActivePresetKey("custom");
                  setParams({ ...params, dsoDaysDelta: Number(e.target.value) });
                }}
                data-testid="slider-dso"
                className="w-full accent-yellow cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>On Time (0d)</span>
                <span>+30 Days Delay</span>
                <span>+60 Days Squeeze</span>
              </div>
            </div>

            {/* Slider 4: Additional Headcount Hiring */}
            <div className="space-y-1.5 pt-2 border-t border-grid">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold">New Headcount / Hires</label>
                <span className="font-mono font-bold px-1.5 py-0.5 text-xs border border-ink bg-page text-text">
                  +{params.opexHiringCount} Engineers
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={params.opexHiringCount}
                onChange={(e) => {
                  setActivePresetKey("custom");
                  setParams({ ...params, opexHiringCount: Number(e.target.value) });
                }}
                data-testid="slider-hiring"
                className="w-full accent-violet cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>0</span>
                <span>+5 Hires</span>
                <span>+15 Team Expansion</span>
              </div>
            </div>

            {/* Slider 5: Price Adjustment */}
            <div className="space-y-1.5 pt-2 border-t border-grid">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold">Product Price Adjustment</label>
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 text-xs border border-ink ${
                    params.priceIncreaseDelta >= 0 ? "bg-good/20 text-good" : "bg-danger/20 text-pink"
                  }`}
                >
                  {params.priceIncreaseDelta >= 0 ? `+${params.priceIncreaseDelta}%` : `${params.priceIncreaseDelta}%`}
                </span>
              </div>
              <input
                type="range"
                min="-15"
                max="25"
                step="1"
                value={params.priceIncreaseDelta}
                onChange={(e) => {
                  setActivePresetKey("custom");
                  setParams({ ...params, priceIncreaseDelta: Number(e.target.value) });
                }}
                data-testid="slider-price"
                className="w-full accent-lime cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>-15% (Discount)</span>
                <span>0% (List Price)</span>
                <span>+25% (Premium)</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PROJECTED OUTCOMES & BOT REACTIONS (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Runway */}
            <div className="neo-card p-3 bg-panel" data-testid="metric-runway">
              <span className="text-[10px] font-bold uppercase text-muted block">Runway</span>
              <div
                className={`font-display font-black text-2xl mt-1 ${
                  projection.projectedRunwayMonths < 6 ? "text-pink" : "text-text"
                }`}
              >
                {projection.projectedRunwayMonths >= 36 ? "36+ Mo" : `${projection.projectedRunwayMonths} Mo`}
              </div>
              <span className="text-[10px] text-muted">
                {projection.projectedRunwayMonths < 6 ? "🚨 Urgent Cash Action" : "Cash Safe"}
              </span>
            </div>

            {/* 90-Day Cash */}
            <div className="neo-card p-3 bg-panel" data-testid="metric-cash90d">
              <span className="text-[10px] font-bold uppercase text-muted block">90-Day Cash</span>
              <div className="font-display font-black text-xl mt-1 text-text">
                {formatMoney(projection.projectedCash90d)}
              </div>
              <span className="text-[10px] text-muted">Projected Buffer</span>
            </div>

            {/* Monthly Net */}
            <div className="neo-card p-3 bg-panel" data-testid="metric-net-cashflow">
              <span className="text-[10px] font-bold uppercase text-muted block">Net Flow / Mo</span>
              <div
                className={`font-display font-black text-xl mt-1 flex items-center gap-1 ${
                  parseFloat(projection.netCashflowDelta) >= 0 ? "text-good" : "text-pink"
                }`}
              >
                {parseFloat(projection.netCashflowDelta) >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{formatMoney(projection.netCashflowDelta)}</span>
              </div>
              <span className="text-[10px] text-muted">Post-tax Net Burn</span>
            </div>

            {/* Risk Index */}
            <div className="neo-card p-3 bg-panel" data-testid="metric-risk-index">
              <span className="text-[10px] font-bold uppercase text-muted block">Stress Index</span>
              <div className="font-display font-black text-2xl mt-1 text-text">
                {projection.riskScore}
                <span className="text-xs font-normal text-muted">/100</span>
              </div>
              <StatusChip
                status={projection.riskLevel === "critical" ? "act" : projection.riskLevel === "severe" ? "watch" : "good"}
                label={projection.riskLevel.toUpperCase()}
              />
            </div>
          </div>

          {/* Cashflow Runway Trajectory Comparison */}
          <div className="neo-card p-4 bg-panel space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-black uppercase tracking-tight flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-yellow" />
                <span>Liquidity Trajectory (30 · 60 · 90 Days)</span>
              </span>
              <span className="text-[10px] font-mono text-muted">Baseline Cash: $148,500.00</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 bg-page border-line">
                <span className="text-[10px] font-bold uppercase text-muted block">30 Days</span>
                <span className="font-display font-black text-base text-text block mt-1">
                  {formatMoney(projection.projectedCash30d)}
                </span>
                <span className="text-[10px] font-mono text-muted">Immediate liquidity</span>
              </div>

              <div className="p-2.5 bg-page border-line">
                <span className="text-[10px] font-bold uppercase text-muted block">60 Days</span>
                <span className="font-display font-black text-base text-text block mt-1">
                  {formatMoney(projection.projectedCash60d)}
                </span>
                <span className="text-[10px] font-mono text-muted">DSO realization</span>
              </div>

              <div className="p-2.5 bg-page border-line">
                <span className="text-[10px] font-bold uppercase text-muted block">90 Days</span>
                <span className="font-display font-black text-base text-text block mt-1">
                  {formatMoney(projection.projectedCash90d)}
                </span>
                <span className="text-[10px] font-mono text-muted">Stress terminal cash</span>
              </div>
            </div>
          </div>

          {/* Autonomous Agents Impact Matrix */}
          <div className="neo-card p-4 bg-panel space-y-3" data-testid="bot-impact-matrix">
            <div className="flex items-center justify-between pb-2 border-b border-grid">
              <span className="text-xs font-display font-black uppercase tracking-tight flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-violet" />
                <span>Autonomous Agent Forecast Signals ({projection.botAlerts.length})</span>
              </span>
              <span className="text-[10px] font-mono text-good font-bold">UAAP Brain Sync</span>
            </div>

            <div className="space-y-2">
              {projection.botAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-page border-line flex items-start gap-3"
                  data-testid={`bot-alert-${alert.botId}`}
                >
                  <div
                    className={`w-7 h-7 flex items-center justify-center font-display font-black text-xs border border-ink shadow-[1px_1px_0_var(--q-ink)] shrink-0 ${
                      alert.botColor === "violet"
                        ? "bg-violet text-panel"
                        : alert.botColor === "pink"
                        ? "bg-pink text-panel"
                        : alert.botColor === "lime"
                        ? "bg-lime text-ink"
                        : "bg-cyan text-ink"
                    }`}
                  >
                    {alert.botName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text">{alert.headline}</span>
                      <StatusChip
                        status={alert.severity}
                        label={alert.severity === "act" ? "CRITICAL" : alert.severity === "watch" ? "CAUTION" : "NORMAL"}
                      />
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {alert.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-muted font-medium">
              Ready to execute contingencies? Emit simulation to Approvals Inbox as an Executive Board Memo.
            </div>

            <Button
              variant="lime"
              size="md"
              data-testid="commit-scenario-btn"
              onClick={handleCommitScenario}
              disabled={isCommitting}
            >
              <span>{isCommitting ? "Submitting Memo…" : "Commit Stress Memo (Tier 2)"}</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
