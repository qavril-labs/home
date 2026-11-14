import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { DealFollowUpModal } from "./DealFollowUpModal";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  initialPipData,
  initialPipelineDeals,
} from "../../lib/api-mock";
import type {
  PipData,
  PipelineDeal,
} from "../../types";
import {
  Power,
  RotateCw,
  AlertTriangle,
  Target,
  Send,
  ShieldCheck,
  Clock,
} from "lucide-react";

export interface PipProps {
  onNavigateBack?: () => void;
}

export const Pip: React.FC<PipProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();

  // State
  const [data] = useState<PipData>(initialPipData);
  const [deals, setDeals] = useState<PipelineDeal[]>(initialPipelineDeals);
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
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
        ? "Pip resumed: Deal follow-up drafting and pipeline velocity monitoring active."
        : "Pip kill switch engaged: Automated sales outreach drafts and margin checks paused.",
      { type: nextState ? "success" : "warning" }
    );
  };

  // Follow-Up Send Handler
  const handleSendFollowUp = (dealId: string, message: string) => {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, daysQuiet: 0, needsFollowUp: false, draftMessage: message }
          : d
      )
    );

    const targetDeal = deals.find((d) => d.id === dealId);
    showToast(
      `Follow-up outreach sent to ${targetDeal?.contactPerson} (${targetDeal?.customer}).`,
      {
        type: "success",
        undoAction: () => {
          setDeals((prev) =>
            prev.map((d) =>
              d.id === dealId ? { ...d, daysQuiet: 8, needsFollowUp: true } : d
            )
          );
          showToast(`Reversed follow-up for deal ${dealId}.`, { type: "info" });
        },
      }
    );
  };

  const quietDeals = deals.filter((d) => d.needsFollowUp);
  const activeDeals = deals.filter((d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost");

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
          <span className="text-xs font-bold text-text">Pip (AGT-02)</span>
        </div>

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
            Agent Card: AGT-02 · SAL-02
          </span>
        </div>
      </div>

      {/* 2. Bot Header with Pip Avatar, Role, Kill Switch, and Live Pulse */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        aria-label="Pip Agent Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar strictly following design/tokens.json: bot.pip (lime token #c6ff3d) */}
            <div className="w-16 h-16 bg-lime text-ink border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <rect x="18" y="18" width="44" height="44" rx="8" fill="var(--q-lime)" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="32" cy="34" r="5" fill="var(--q-ink)" />
                <circle cx="48" cy="34" r="5" fill="var(--q-ink)" />
                <path d="M28 46 Q40 56 52 46" stroke="var(--q-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
                <circle cx="40" cy="8" r="4" fill="var(--q-yellow)" stroke="var(--q-ink)" strokeWidth="2" />
                <line x1="40" y1="12" x2="40" y2="18" stroke="var(--q-ink)" strokeWidth="2" />
              </svg>
              {isKillSwitchActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-good rounded-full border-2 border-ink" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text leading-tight">
                  Pip
                </h1>
                <span className="px-2 py-0.5 bg-lime/30 border border-lime text-[11px] font-bold text-ink uppercase tracking-wider">
                  Deal Closer
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  AGT-02 / SAL-02
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal">
                Continuous sales velocity assistant: flags quiet proposals nearing decision windows, drafts warm re-engagement outreach, monitors discount margins, and tracks probability-weighted pipeline.
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
              Kill switch is engaged. Automated quiet deal reminders, quote follow-ups, and pipeline velocity scoring are paused.
            </span>
          </div>
        )}
      </section>

      {/* 3. StatusChip Display Section */}
      <section
        className="neo-card p-4 bg-page border-line shadow-card"
        aria-label="Pip Status Overview"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-grid">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Live Sales Pipeline Health Status
            </h2>
            <p className="text-xs text-text font-medium mt-0.5">
              Monitoring deal momentum across all commercial machining and fabrication tenders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status="good"
              label="✓ Pipeline active"
            />

            <StatusChip
              status={quietDeals.length > 0 ? "watch" : "good"}
              label={
                quietDeals.length > 0
                  ? `! ${quietDeals.length} quiet deals needing follow-up`
                  : "✓ All deals current"
              }
            />

            <StatusChip
              status="watch"
              label="● 1 discount exception approval"
            />
          </div>
        </div>

        {/* 4 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Weighted Pipeline Value
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.weightedValue)}
              </span>
              <span className="text-xs font-mono font-bold text-good">Probability Wtd</span>
            </div>
            <p className="text-[11px] text-muted mt-1">$87,900.00 gross active pipeline</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Active Opportunities
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {activeDeals.length} Deals
              </span>
              <span className="text-xs font-mono font-bold text-lime">In Flight</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Proposal & Negotiation stages</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              90-Day Win Rate
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {data.winRate}
              </span>
              <span className="text-xs font-mono font-bold text-good">&gt; 70% Target</span>
            </div>
            <p className="text-[11px] text-muted mt-1">High conversion efficiency</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Quiet Deals Requiring Action
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {quietDeals.length} Deals
              </span>
              <span className="text-xs font-mono font-bold text-watch">&gt; 5d Inactive</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Vanguard & Kinetics tenders</p>
          </div>
        </div>
      </section>

      {/* 4. Pipeline Funnel & Deals Table */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card space-y-4"
        aria-label="Pipeline Table Section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-extrabold text-lg uppercase tracking-tight text-text leading-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-lime" />
              <span>Commercial Pipeline Funnel & Opportunities (SAL-02)</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Review deal velocity, draft customer re-engagements, and keep active tenders moving.
            </p>
          </div>
        </div>

        {/* 2D Funnel Stage Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-2">
          {[
            { stage: "Discovery", count: 1, val: "$45,000.00", prob: "40%" },
            { stage: "Proposal", count: 1, val: "$28,400.00", prob: "70%" },
            { stage: "Negotiation", count: 1, val: "$14,500.00", prob: "85%" },
            { stage: "Closed Won", count: 1, val: "$6,800.00", prob: "100%" },
            { stage: "Closed Lost", count: 0, val: "$0.00", prob: "0%" },
          ].map((fn, idx) => (
            <div key={idx} className="p-3 bg-page border-line space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted block">
                {fn.stage}
              </span>
              <div className="font-display font-black text-sm text-text">
                {fn.val}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted pt-1 border-t border-grid">
                <span>{fn.count} Deals</span>
                <span className="font-mono font-bold">{fn.prob}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Deals Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                <th className="py-2.5 px-3">Opportunity & Customer</th>
                <th className="py-2.5 px-3">Stage & Probability</th>
                <th className="py-2.5 px-3 text-right">Deal Value</th>
                <th className="py-2.5 px-3 text-center">Velocity & Quiet Days</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-page/70 transition-colors">
                  {/* Opportunity & Customer */}
                  <td className="py-3 px-3 align-top max-w-sm">
                    <div className="font-bold text-sm text-text leading-tight">
                      {deal.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted text-xs mt-0.5">
                      <span className="font-semibold text-text">{deal.customer}</span>
                      <span>·</span>
                      <span>{deal.contactPerson}</span>
                    </div>
                  </td>

                  {/* Stage & Probability */}
                  <td className="py-3 px-3 align-top">
                    <span className="px-2 py-0.5 bg-page border border-line font-bold text-[11px] text-text">
                      {deal.stage}
                    </span>
                    <span className="ml-2 font-mono text-muted text-xs">
                      {(deal.probability * 100).toFixed(0)}% prob
                    </span>
                  </td>

                  {/* Deal Value */}
                  <td className="py-3 px-3 align-top font-mono font-bold text-right text-xs text-text">
                    {formatMoney(deal.amount)}
                  </td>

                  {/* Days Quiet */}
                  <td className="py-3 px-3 align-top text-center">
                    {deal.daysQuiet > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border ${
                          deal.needsFollowUp
                            ? "bg-watch/20 text-watch border-watch"
                            : "bg-page border-grid text-muted"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{deal.daysQuiet} days quiet</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-good/20 text-good border border-good text-[11px] font-bold">
                        ✓ Active Today
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                    {deal.needsFollowUp ? (
                      <Button
                        size="sm"
                        variant="lime"
                        onClick={() => setSelectedDeal(deal)}
                        className="text-xs py-1 px-2.5 font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Draft Follow-Up</span>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted">Up to date</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Activity Log & Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Pip Activity Stream */}
        <div className="lg:col-span-7 neo-card p-4 bg-panel border-line shadow-card">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-grid">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text">
                Pip Sales Velocity Stream
              </h3>
              <p className="text-[11px] text-muted">
                Audit trail of quiet deal detections and proposal follow-up alerts.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-page border border-grid text-muted">
              Live Stream
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                time: "09:00",
                event: "Pipeline quiet deal evaluation",
                result: "Flagged Vanguard Aerospace (8d) and Kinetics Robotics (6d) for follow-up",
                type: "watch",
              },
              {
                time: "10:45",
                event: "Personalized outreach drafts generated",
                result: "Prepared commercial re-engagement messages referencing open quotes",
                type: "good",
              },
              {
                time: "14:30",
                event: "Deal closed won: Precision Tooling",
                result: "$6,800.00 custom bit calibration agreement marked won",
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
              Agent Guardrails (AGT-02)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Commercial Representative Sign-off</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Pip drafts outreach messages but never communicates with prospects without sales representative review and delivery approval.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Design Token Conformance</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Pip strictly employs <code className="font-bold">var(--q-lime)</code> (lime design token) for avatar and interface accents per <code>tokens.json</code>.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Margin Floor Enforcement</span>
              <p className="text-[11px] text-muted leading-relaxed">
                Special discounts exceeding 18% automatically require Tier 3 authorization in the Approvals Inbox before commercial quotes can be locked.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Deal Follow-Up Modal */}
      <DealFollowUpModal
        isOpen={Boolean(selectedDeal)}
        onClose={() => setSelectedDeal(null)}
        deal={selectedDeal}
        onSendFollowUp={handleSendFollowUp}
      />
    </div>
  );
};

export default Pip;
