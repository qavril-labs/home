import React, { useState, useEffect, useRef } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { eventBus } from "../../lib/event-stream";
import { sound } from "../../lib/sound-effects";
import {
  Zap,
  Play,
  Sparkles,
  Bot,
  Activity,
  Lock,
} from "lucide-react";

export interface AutopilotLogEntry {
  id: string;
  timestamp: string;
  agentName: string;
  agentColor: string;
  catalogId: string;
  actionText: string;
  tier: 1 | 2;
  status: "auto_executed" | "staged_for_review" | "prevented";
}

export interface AutopilotMissionControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToInbox?: () => void;
}

export const AutopilotMissionControlDrawer: React.FC<AutopilotMissionControlDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToInbox,
}) => {
  const { showToast } = useToast();
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Autopilot States
  const [autopilotMode, setAutopilotMode] = useState<"manual" | "supervised" | "full">("supervised");
  const [tier1Limit, setTier1Limit] = useState<number>(2500);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(98);
  const [actionCount, setActionCount] = useState<number>(38);
  const [hoursSaved] = useState<number>(4.2);
  const [isSimulatingCascade, setIsSimulatingCascade] = useState<boolean>(false);

  // Live Terminal Logs
  const [logs, setLogs] = useState<AutopilotLogEntry[]>([
    {
      id: "log-1",
      timestamp: "13:30:12",
      agentName: "Guard Gus",
      agentColor: "yellow",
      catalogId: "AI-04",
      actionText: "Scanned 14 incoming vouchers: 0 duplicate anomalies detected (99.8% confidence).",
      tier: 1,
      status: "auto_executed",
    },
    {
      id: "log-2",
      timestamp: "13:32:45",
      agentName: "Ticket Tess",
      agentColor: "lime",
      catalogId: "AGT-05",
      actionText: "Auto-dispatched warranty resolution for Nexus Precision Tools (#BRG-440 spindle replacement).",
      tier: 1,
      status: "auto_executed",
    },
    {
      id: "log-3",
      timestamp: "13:35:10",
      agentName: "Ledger Lou",
      agentColor: "cyan",
      catalogId: "AGT-03",
      actionText: "Balanced all 142 journals across 4 currency books; verified bank feed reconciliation.",
      tier: 1,
      status: "auto_executed",
    },
    {
      id: "log-4",
      timestamp: "13:38:00",
      agentName: "Restock Rex",
      agentColor: "orange",
      catalogId: "AGT-04",
      actionText: "Staged replenishment PO-2026-004 ($3,420.00) for Industrial Supply Co (exceeds $2,500 limit).",
      tier: 2,
      status: "staged_for_review",
    },
  ]);

  // Subscribe to real-time events to append live logs
  useEffect(() => {
    const unsubscribe = eventBus.onAny((event) => {
      const time = new Date(event.occurredAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      let agent = "Autopilot Agent";
      let color = "lime";
      let catalog = "PLT-07";

      if (event.producer.includes("guard_gus")) {
        agent = "Guard Gus";
        color = "yellow";
        catalog = "AI-04";
      } else if (event.producer.includes("ledger_lou")) {
        agent = "Ledger Lou";
        color = "cyan";
        catalog = "AGT-03";
      } else if (event.producer.includes("ticket_tess")) {
        agent = "Ticket Tess";
        color = "lime";
        catalog = "AGT-05";
      } else if (event.producer.includes("onboard_ola")) {
        agent = "Onboard Ola";
        color = "violet";
        catalog = "HRM-10";
      } else if (event.producer.includes("restock_rex")) {
        agent = "Restock Rex";
        color = "orange";
        catalog = "AGT-04";
      }

      const newLog: AutopilotLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: time,
        agentName: agent,
        agentColor: color,
        catalogId: catalog,
        actionText: `Processed event [${event.type}] autonomously under tenant isolation.`,
        tier: 1,
        status: "auto_executed",
      };

      setLogs((prev) => [...prev.slice(-30), newLog]);
      setActionCount((c) => c + 1);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  // Simulate 5-Event Autonomous Chain Reaction
  const handleSimulateSwarmCascade = () => {
    if (isSimulatingCascade) return;
    setIsSimulatingCascade(true);
    sound.playAutopilotPing();

    const steps = [
      {
        delay: 300,
        type: "doc.extracted",
        producer: "services/uaap/doc_extract_fields",
        log: "Visual OCR captured Supplier Bill #INV-99382 ($3,639.75) with 99.4% bounding box confidence.",
        agent: "Document Intelligence",
        color: "cyan",
        catalog: "AI-01",
      },
      {
        delay: 1100,
        type: "bot.signal.detected",
        producer: "services/uaap/guard_gus",
        log: "Guard Gus verified cryptographic SHA-256 hash: zero duplicate bills or anomalous line items found.",
        agent: "Guard Gus",
        color: "yellow",
        catalog: "AI-04",
      },
      {
        delay: 2000,
        type: "bot.action.drafted",
        producer: "services/uaap/restock_rex",
        log: "Restock Rex cross-checked warehouse stock: allocated incoming items to bin A-12 and updated safety buffers.",
        agent: "Restock Rex",
        color: "orange",
        catalog: "AGT-04",
      },
      {
        delay: 2900,
        type: "support.ticket.resolved",
        producer: "services/uaap/ticket_tess",
        log: "Ticket Tess auto-dispatched warranty confirmation to customer portal with tracked tracking link.",
        agent: "Ticket Tess",
        color: "lime",
        catalog: "AGT-05",
      },
      {
        delay: 3800,
        type: "ledger.entry.posted",
        producer: "services/uaap/ledger_lou",
        log: "Ledger Lou balanced balanced debits and credits across USD/EUR/GBP/JPY ledger outbox with zero imbalance.",
        agent: "Ledger Lou",
        color: "cyan",
        catalog: "AGT-03",
      },
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        eventBus.emit({
          type: step.type,
          producer: step.producer,
          data: { cascadeStep: index + 1, message: step.log },
        });

        sound.playAutopilotPing();

        if (index === steps.length - 1) {
          setIsSimulatingCascade(false);
          sound.playSuccessChime();
          showToast("Autopilot Swarm Cascade completed: 5 collaborative actions executed cleanly.", undefined, "good");
        }
      }, step.delay);
    });
  };

  const handleClearLogs = () => {
    setLogs([]);
    showToast("Telemetry logs cleared", undefined, "good");
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Autonomous Autopilot Mission Control (PLT-07 / AGT-01)"
      description="Zero-touch operations engine · Continuous agent swarm collaboration & auto-execution policies"
    >
      <div className="space-y-6 pb-6 text-xs" data-testid="autopilot-mission-control">
        {/* Autopilot Status Strip */}
        <div className="p-4 bg-page border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime border border-ink shadow-[2px_2px_0_var(--q-ink)] flex items-center justify-center text-ink shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm uppercase">
                  {autopilotMode === "full"
                    ? "Full Swarm Autopilot"
                    : autopilotMode === "supervised"
                    ? "Supervised Autopilot"
                    : "Manual Mode"}
                </span>
                <span className="w-2 h-2 rounded-full bg-good animate-ping" />
              </div>
              <p className="text-[11px] text-muted">
                {autopilotMode === "full"
                  ? "All 8 bots cooperate autonomously. Tier 1 auto-executed; Tier 2/3 routed to Dual-Control."
                  : autopilotMode === "supervised"
                  ? "Tier 1 actions auto-executed up to $" + tier1Limit.toLocaleString() + " at >" + confidenceThreshold + "% confidence."
                  : "All proposals paused; requires human manual sign-off."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              data-testid="mode-manual-btn"
              onClick={() => {
                setAutopilotMode("manual");
                sound.playClick();
              }}
              className={`px-3 py-1.5 font-bold font-mono border-line transition-all cursor-pointer ${
                autopilotMode === "manual" ? "bg-panel text-ink border-2" : "bg-page text-muted"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              data-testid="mode-supervised-btn"
              onClick={() => {
                setAutopilotMode("supervised");
                sound.playClick();
              }}
              className={`px-3 py-1.5 font-bold font-mono border-line transition-all cursor-pointer ${
                autopilotMode === "supervised"
                  ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted"
              }`}
            >
              Supervised
            </button>
            <button
              type="button"
              data-testid="mode-full-btn"
              onClick={() => {
                setAutopilotMode("full");
                sound.playClick();
              }}
              className={`px-3 py-1.5 font-bold font-mono border-line transition-all cursor-pointer ${
                autopilotMode === "full"
                  ? "bg-violet text-panel shadow-[2px_2px_0_var(--q-ink)]"
                  : "bg-page text-muted"
              }`}
            >
              Full Swarm
            </button>
          </div>
        </div>

        {/* Real-time KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="neo-card p-3 bg-panel" data-testid="stat-action-count">
            <span className="text-[10px] font-bold uppercase text-muted block">Actions Auto-Executed</span>
            <div className="font-display font-black text-2xl text-good mt-1">{actionCount}</div>
            <span className="text-[10px] text-muted">Today across 8 bots</span>
          </div>

          <div className="neo-card p-3 bg-panel">
            <span className="text-[10px] font-bold uppercase text-muted block">Human Admin Saved</span>
            <div className="font-display font-black text-2xl text-text mt-1">{hoursSaved} Hrs</div>
            <span className="text-[10px] text-muted">Estimated time saved</span>
          </div>

          <div className="neo-card p-3 bg-panel">
            <span className="text-[10px] font-bold uppercase text-muted block">Policy Adherence</span>
            <div className="font-display font-black text-2xl text-good mt-1">100%</div>
            <span className="text-[10px] text-muted">Zero unauthorized breaches</span>
          </div>

          <div className="neo-card p-3 bg-panel">
            <span className="text-[10px] font-bold uppercase text-muted block">Dual-Control Tier</span>
            <div className="font-display font-black text-xl text-text mt-1 flex items-center gap-1">
              <Lock className="w-4 h-4 text-pink" />
              <span>Tier 2 & 3</span>
            </div>
            <span className="text-[10px] text-muted">Mandatory human sign-off</span>
          </div>
        </div>

        {/* 8-Agent Swarm Live Matrix */}
        <div className="neo-card p-4 bg-panel space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-grid">
            <span className="text-xs font-display font-extrabold uppercase flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-violet" />
              <span>Active Agent Workforce (8 Cooperating Sentinels)</span>
            </span>
            <span className="text-[10px] font-mono text-good font-bold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              Swarm Synchronized
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { name: "Ledger Lou", role: "Month-End Checker", catalog: "AGT-03", color: "cyan", action: "Reconciling journals" },
              { name: "Chase Chloe", role: "Payment Reminders", catalog: "FIN-14", color: "pink", action: "Cadence scheduled" },
              { name: "Forecast Finn", role: "Cash Forecaster", catalog: "AIS-02", color: "violet", action: "Runway: 36+ mo" },
              { name: "Guard Gus", role: "Anomaly Sentinel", catalog: "AI-04", color: "yellow", action: "Auditing duplicates" },
              { name: "Pip", role: "Deal Closer", catalog: "AGT-02", color: "lime", action: "Pacing active" },
              { name: "Restock Rex", role: "Replenishment", catalog: "AGT-04", color: "orange", action: "Buffers monitored" },
              { name: "Ticket Tess", role: "Customer Support", catalog: "AGT-05", color: "lime", action: "Warranty linked" },
              { name: "Onboard Ola", role: "People & Talent", catalog: "HRM-10", color: "violet", action: "Access staged" },
            ].map((agent, i) => (
              <div key={i} className="p-2.5 bg-page border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-text">{agent.name}</span>
                  <span className="w-2 h-2 rounded-full bg-good animate-pulse" />
                </div>
                <div className="text-[10px] font-mono text-muted">{agent.catalog}</div>
                <div className="text-[10px] text-muted truncate">{agent.action}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Policy Safeguard Thresholds */}
        <div className="p-4 bg-page border-line space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lime" />
              <span>Autopilot Safety Thresholds (AGT-01 Policy Enforcement)</span>
            </span>
            <span className="text-xs font-mono text-text">Hard Limits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                Max Auto-Execution Amount (Tier 1 Limit):
              </label>
              <div className="flex items-center gap-2">
                {[500, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setTier1Limit(amt);
                      sound.playClick();
                    }}
                    className={`px-3 py-1 font-mono text-xs font-bold border-line cursor-pointer ${
                      tier1Limit === amt ? "bg-lime text-ink shadow-[2px_2px_0_var(--q-ink)]" : "bg-panel text-muted"
                    }`}
                  >
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                Minimum AI Confidence Score:
              </label>
              <div className="flex items-center gap-2">
                {[95, 98, 99.5].map((conf) => (
                  <button
                    key={conf}
                    type="button"
                    onClick={() => {
                      setConfidenceThreshold(conf);
                      sound.playClick();
                    }}
                    className={`px-3 py-1 font-mono text-xs font-bold border-line cursor-pointer ${
                      confidenceThreshold === conf ? "bg-cyan text-ink shadow-[2px_2px_0_var(--q-ink)]" : "bg-panel text-muted"
                    }`}
                  >
                    {conf}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Autonomous Telemetry Feed (Terminal View) */}
        <div className="neo-card p-4 bg-panel space-y-3" data-testid="autopilot-terminal">
          <div className="flex items-center justify-between pb-2 border-b border-grid">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow" />
              <span className="w-2.5 h-2.5 rounded-full bg-good" />
              <span className="font-mono font-bold text-xs ml-2 text-text">
                Live Swarm Telemetry Terminal (SSE + Outbox Bus)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearLogs}
                className="text-[10px] py-0.5 px-2"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Terminal Logs Container */}
          <div className="p-3 bg-ink text-panel font-mono text-[11px] h-48 overflow-y-auto space-y-2 border border-ink shadow-inner">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-muted shrink-0">[{log.timestamp}]</span>
                <span
                  className={`font-bold shrink-0 px-1 text-[10px] ${
                    log.agentColor === "lime"
                      ? "text-lime"
                      : log.agentColor === "yellow"
                      ? "text-yellow"
                      : log.agentColor === "violet"
                      ? "text-violet"
                      : log.agentColor === "pink"
                      ? "text-pink"
                      : "text-cyan"
                  }`}
                >
                  ⚡ {log.agentName} ({log.catalogId}):
                </span>
                <span className="text-panel flex-1">{log.actionText}</span>
                <span
                  className={`text-[9px] uppercase font-bold px-1 border ${
                    log.status === "auto_executed"
                      ? "border-good text-good"
                      : log.status === "staged_for_review"
                      ? "border-yellow text-yellow"
                      : "border-pink text-pink"
                  }`}
                >
                  {log.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Action Controls & Simulation Trigger */}
        <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-muted">
            Want to see all 8 bots collaborate? Trigger a live 5-event autonomous chain reaction.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onNavigateToInbox && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  onClose();
                  onNavigateToInbox();
                }}
              >
                View Approvals Inbox
              </Button>
            )}

            <Button
              variant="lime"
              size="md"
              data-testid="simulate-cascade-btn"
              onClick={handleSimulateSwarmCascade}
              disabled={isSimulatingCascade}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              <span>{isSimulatingCascade ? "Running Swarm Cascade…" : "Simulate Swarm Cascade (5 Events)"}</span>
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
