import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { AgentAssistanceBanner } from "../../components/ui/AgentAssistanceBanner";
import { AnomalyInspectionModal } from "./AnomalyInspectionModal";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  initialGuardGusData,
  initialAnomalyFindings,
} from "../../lib/api-mock";
import type {
  GuardGusData,
  AnomalyFinding,
} from "../../types";
import {
  Power,
  RotateCw,
  AlertTriangle,
  ShieldCheck,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface GuardGusProps {
  onNavigateBack?: () => void;
}

export const GuardGus: React.FC<GuardGusProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();

  // State
  const [data] = useState<GuardGusData>(initialGuardGusData);
  const [findings, setFindings] = useState<AnomalyFinding[]>(initialAnomalyFindings);
  const [selectedFinding, setSelectedFinding] = useState<AnomalyFinding | null>(null);
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
        ? "Guard Gus resumed: Continuous anomaly surveillance and duplicate bill scans are active."
        : "Guard Gus kill switch engaged: Outlier scans and audit alerts are paused.",
      { type: nextState ? "success" : "warning" }
    );
  };

  // Quarantine Handler
  const handleQuarantine = (id: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "quarantined" } : f))
    );
    showToast(`Record ${id} quarantined and blocked from automated posting.`, {
      type: "warning",
      undoAction: () => {
        setFindings((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "flagged" } : f))
        );
        showToast(`Quarantine lifted for ${id}.`, { type: "info" });
      },
    });
  };

  // Dismiss Handler
  const handleDismiss = (id: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "dismissed" } : f))
    );
    showToast(`Anomaly ${id} marked as legitimate and dismissed.`, {
      type: "info",
    });
  };

  const activeFlagged = findings.filter((f) => f.status === "flagged");
  const quarantinedCount = findings.filter((f) => f.status === "quarantined").length;

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
          <span className="text-xs font-bold text-text">Guard Gus (AI-04)</span>
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
            Agent Card: AI-04 · AUD-01
          </span>
        </div>
      </div>

      {/* 2. Bot Header with Gus Avatar, Role, Kill Switch, and Live Pulse */}
      <section
        className="neo-card p-6 bg-panel border-line shadow-card"
        aria-label="Guard Gus Agent Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Avatar & Identity */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar strictly following design/tokens.json: bot.guard-gus (pink token #ff4fa3) */}
            <div className="w-16 h-16 bg-pink text-white border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <polygon points="40,6 70,22 70,58 40,74 10,58 10,22" fill="var(--q-pink)" stroke="var(--q-ink)" strokeWidth="3" />
                <circle cx="32" cy="38" r="6" fill="var(--q-ink)" />
                <circle cx="48" cy="38" r="6" fill="var(--q-ink)" />
                <circle cx="34" cy="36" r="2" fill="white" />
                <circle cx="50" cy="36" r="2" fill="white" />
                <path d="M32 50 Q40 56 48 50" stroke="var(--q-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
              {isKillSwitchActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-good rounded-full border-2 border-ink" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-text leading-tight break-words">
                  Guard Gus
                </h1>
                <span className="px-2 py-0.5 bg-pink/20 border border-pink text-[11px] font-bold text-ink uppercase tracking-wider">
                  Anomaly Sentinel
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  AI-04 / AUD-01
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal break-words">
                Continuous anomaly & fraud sentinel: intercepts duplicate vendor bills, identifies uncharacteristic discount margin breaches, audits post-closing journal entries, and protects ledger integrity.
              </p>
            </div>
          </div>

          {/* Right: Kill Switch & Live Indicator */}
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

        {/* Kill Switch Alert Banner when suspended */}
        {!isKillSwitchActive && (
          <div className="mt-4 p-3 bg-cream border-line flex items-center gap-3 text-xs text-ink font-semibold shadow-sm">
            <AlertTriangle className="w-4 h-4 text-act flex-shrink-0" />
            <span>
              Kill switch is engaged. Automated duplicate invoice comparisons, margin anomaly scans, and quarantine gates are paused.
            </span>
          </div>
        )}
      </section>

      {/* 3. StatusChip Display Section */}
      <section
        className="neo-card p-4 bg-page border-line shadow-card"
        aria-label="Guard Gus Status Overview"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-grid">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted break-words">
              Live Anomaly & Audit Sentinel Status
            </h2>
            <p className="text-xs text-text font-medium mt-0.5 break-words">
              Real-time heuristic evaluation of transactional outliers and duplicate claims.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status="good"
              label="✓ Zero fraud detected"
            />

            <StatusChip
              status={activeFlagged.length > 0 ? "watch" : "good"}
              label={
                activeFlagged.length > 0
                  ? `! ${activeFlagged.length} anomalies flagged`
                  : "✓ 0 anomalies flagged"
              }
            />

            <StatusChip
              status={activeFlagged.length > 0 ? "act" : "good"}
              label={
                activeFlagged.length > 0
                  ? "● 1 audit inspection required"
                  : "✓ All items reviewed"
              }
            />
          </div>
        </div>

        {/* 4 Mini KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Active Anomaly Flags
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {activeFlagged.length} Outliers
              </span>
              <span className="text-xs font-mono font-bold text-watch">Under Review</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">1 duplicate bill, 1 margin breach</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Quarantined Records
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {quarantinedCount} Record
              </span>
              <span className="text-xs font-mono font-bold text-good">Intercepted</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">Post-period closed journal blocked</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Exposure Value Blocked
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                {formatMoney(data.exposureBlocked)}
              </span>
              <span className="text-xs font-mono font-bold text-pink">Saved</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">Prevented duplicate cash outflow</p>
          </div>

          <div className="bg-panel p-3 border-line shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
              Confidence Score Average
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display font-black text-lg text-text">
                96.7%
              </span>
              <span className="text-xs font-mono font-bold text-good">High Precision</span>
            </div>
            <p className="text-[11px] text-muted mt-1 break-words">Zero hallucinations tolerated</p>
          </div>
        </div>
      </section>

      {/* 3b. Proactive Copilot Human-In-The-Loop Task Assistance */}
      {findings.filter((f) => f.status === "flagged").length > 0 && isKillSwitchActive && (
        <AgentAssistanceBanner
          botName="Guard Gus"
          catalogId="AI-04 / AUD-01"
          accentColor="pink"
          taskSummary="High-Confidence Duplicate Supplier Invoice Quarantined"
          recommendation="Gus detected a $3,450.00 supplier invoice from Steel Dynamics Corp with duplicate billing line items matching INV-8890. Gus recommends human inspection to verify potential double payment risk before releasing or quarantining the voucher."
          evidencePoints={[
            "Flag: Duplicate Bill Match (96% confidence)",
            "Voucher: INV-8921 vs INV-8890",
            "Guardrail: Human sign-off required to quarantine or clear",
          ]}
          primaryActionLabel="Inspect Duplicate Match"
          onPrimaryAction={() => {
            const openFinding = findings.find((f) => f.status === "flagged");
            if (openFinding) {
              setSelectedFinding(openFinding);
            }
          }}
          secondaryActionLabel="Acknowledge Audit Queue"
          onSecondaryAction={() => {
            showToast("Audit finding flagged for controller review.", { type: "info" });
          }}
        />
      )}

      {/* 4. Anomaly Findings Table */}
      <section
        className="neo-card p-4 bg-panel border-line shadow-card space-y-4"
        aria-label="Anomaly Findings Table"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-extrabold text-lg uppercase tracking-tight text-text leading-tight break-words">
              Flagged Outliers & Anomaly Queue (AI-04)
            </h2>
            <p className="text-xs text-muted mt-0.5 break-words">
              Inspect suspicious transactions, confirm legitimate exceptions, or enforce quarantine.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                <th className="py-2.5 px-3">Finding Title & Rule</th>
                <th className="py-2.5 px-3">Suspected Record / Entity</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {findings.map((item) => (
                <tr key={item.id} className="hover:bg-page/70 transition-colors">
                  {/* Finding Title & Rule */}
                  <td className="py-3 px-3 align-top max-w-sm break-words">
                    <div className="font-bold text-sm text-text leading-tight">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 bg-page border border-grid text-muted">
                        {item.rule.replace("_", " ")}
                      </span>
                      <span className="font-mono text-[10px] text-muted">({item.id})</span>
                    </div>
                  </td>

                  {/* Suspected Record & Entity */}
                  <td className="py-3 px-3 align-top break-words">
                    <div className="font-mono font-bold text-xs text-text">
                      {item.suspectedRef}
                    </div>
                    <div className="font-medium text-xs text-muted mt-0.5">
                      {item.partyName}
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-3 align-top font-mono font-bold text-right text-xs text-text break-words">
                    {formatMoney(item.amount)}
                  </td>

                  {/* Confidence */}
                  <td className="py-3 px-3 align-top text-center break-words">
                    <span className="px-2 py-0.5 bg-page border border-line font-mono font-bold text-xs text-text">
                      {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                    {item.status === "flagged" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow/30 border border-yellow text-ink text-[11px] font-bold">
                        <AlertTriangle className="w-3 h-3 text-watch" />
                        <span>Flagged</span>
                      </span>
                    )}
                    {item.status === "quarantined" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-act/20 border border-act text-act text-[11px] font-bold">
                        <XCircle className="w-3 h-3" />
                        <span>Quarantined</span>
                      </span>
                    )}
                    {item.status === "dismissed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-good/20 border border-good text-good text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Dismissed</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant={item.status === "flagged" ? "pink" : "ghost"}
                        onClick={() => setSelectedFinding(item)}
                        className="text-xs py-1 px-2.5 font-bold flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Button>

                      {item.status === "flagged" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleQuarantine(item.id)}
                          className="text-xs py-1 px-2 text-act hover:bg-act/10"
                        >
                          Quarantine
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Activity Log & Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Gus Activity Stream */}
        <div className="lg:col-span-7 neo-card p-4 bg-panel border-line shadow-card">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-grid">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text break-words">
                Gus Anomaly Activity Stream
              </h3>
              <p className="text-[11px] text-muted break-words">
                Audit trail of ledger inspections, duplicate detections, and policy enforcement events.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-page border border-grid text-muted">
              Live Stream
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                time: "09:30",
                event: "Duplicate bill detection triggered",
                result: "Flagged Steel Corp invoice INV-8921 (98% match with INV-8890)",
                type: "act",
              },
              {
                time: "11:00",
                event: "Quote discount margin audit",
                result: "Vanguard Aerospace quote Q-2026-092 flagged for 25% discount breach",
                type: "watch",
              },
              {
                time: "14:15",
                event: "Closed period posting interception",
                result: "Journal entry JRN-8119 successfully quarantined from October 2026 books",
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
                  <p className="text-[11px] text-muted mt-0.5 break-words">{feed.result}</p>
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

        {/* Right: Guardrails Card */}
        <div className="lg:col-span-5 neo-card p-4 bg-panel border-line shadow-card space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-grid">
            <ShieldCheck className="w-4 h-4 text-good" />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text break-words">
              Agent Guardrails (AI-04)
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Zero Fabricated Accusations</span>
              <p className="text-[11px] text-muted leading-relaxed break-words">
                Gus never raises hypothetical fraud warnings. Every finding cites exact ledger records, timestamps, and verifiable mathematical variance.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Design Token Conformance</span>
              <p className="text-[11px] text-muted leading-relaxed break-words">
                Gus strictly employs <code className="font-bold">var(--q-pink)</code> (pink design token) for avatar and interface accents per <code>tokens.json</code>.
              </p>
            </div>

            <div className="p-2.5 bg-page border-line">
              <span className="font-bold text-text block mb-0.5">Supervised Quarantine</span>
              <p className="text-[11px] text-muted leading-relaxed break-words">
                Records are placed in quarantine for supervisor inspection rather than deleted, guaranteeing non-destructive ledger governance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Inspection Modal */}
      <AnomalyInspectionModal
        isOpen={Boolean(selectedFinding)}
        onClose={() => setSelectedFinding(null)}
        finding={selectedFinding}
        onQuarantine={handleQuarantine}
        onDismiss={handleDismiss}
      />
    </div>
  );
};

export default GuardGus;
