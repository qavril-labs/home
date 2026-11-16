import React from "react";
import { Bot, CheckCircle2, ArrowRight, Sparkles, X } from "lucide-react";

export interface PendingAction {
  id: string;
  agentName: string;
  agentRole: string;
  avatarColor: string;
  type: "collections_reminder" | "reconciliation_match" | "fraud_anomaly" | "reorder_alert";
  title: string;
  detail: string;
  confidence: number;
  impactAmount?: string;
  suggestedAction: string;
  timestamp: string;
  onApprove: () => void;
  onDismiss: () => void;
}

export interface AgentFlightDeckProps {
  actions: PendingAction[];
  onApproveAll: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onNavigateToAgent: (agentId: string) => void;
}

export const AgentFlightDeck: React.FC<AgentFlightDeckProps> = ({
  actions,
  onApproveAll,
  isOpen,
  onToggleOpen,
  onNavigateToAgent,
}) => {
  if (actions.length === 0) return null;

  return (
    <aside
      aria-label="Agent flight deck recommendations"
      className="fixed bottom-4 right-4 z-40 max-w-xl w-[calc(100vw-2rem)] select-none transition-all duration-200"
    >
      {/* Dock Bar / Collapsed Header */}
      <div className="bg-ink text-panel border-line shadow-card p-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-3 text-left focus:outline-none flex-1 min-w-0"
        >
          <div className="relative flex items-center justify-center w-8 h-8 bg-lime text-ink border border-ink font-mono font-black text-sm shrink-0">
            <Sparkles className="w-4 h-4 animate-spin text-ink" style={{ animationDuration: "8s" }} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-good border border-ink animate-pulse" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-xs uppercase tracking-wide text-yellow">
                Agent Flight Deck
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-panel text-ink font-black">
                {actions.length} ACTIONS QUEUED
              </span>
            </div>
            <span className="text-[11px] text-muted truncate">
              Autonomous bots prepared live database recommendations
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onApproveAll}
            className="px-2.5 py-1 text-xs font-mono font-bold bg-lime text-ink border border-ink hover:bg-yellow shadow-[2px_2px_0_var(--q-ink)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Approve All ({actions.length})
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1 hover:bg-surface text-panel hover:text-white border border-transparent hover:border-surface"
            aria-label={isOpen ? "Minimize flight deck" : "Expand flight deck"}
          >
            {isOpen ? <X className="w-4 h-4" /> : <Bot className="w-4 h-4 text-cyan" />}
          </button>
        </div>
      </div>

      {/* Expanded Actions Tray */}
      {isOpen && (
        <div className="bg-panel border-x-line border-b-line shadow-2xl max-h-96 overflow-y-auto divide-y-line">
          {actions.map((act) => (
            <div key={act.id} className="p-3 bg-page hover:bg-panel transition-colors flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-black uppercase text-ink border border-ink ${act.avatarColor}`}
                  >
                    {act.agentName}
                  </span>
                  <span className="text-[10px] font-mono text-muted">{act.agentRole}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1 bg-panel border border-ink font-bold text-good">
                    {act.confidence}% MATCH
                  </span>
                  {act.impactAmount && (
                    <span className="text-[11px] font-mono font-bold text-text">
                      {act.impactAmount}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-text leading-tight">{act.title}</p>
                <p className="text-[11px] text-muted mt-0.5 font-mono">{act.detail}</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateToAgent(act.agentName.toLowerCase().replace(/\s+/g, "-"))}
                  className="text-[10px] font-mono text-muted hover:text-text underline flex items-center gap-1"
                >
                  Inspect details <ArrowRight className="w-3 h-3" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={act.onDismiss}
                    className="px-2 py-0.5 text-[11px] font-mono text-muted hover:text-ink hover:bg-grid border border-transparent hover:border-line"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={act.onApprove}
                    className="px-2.5 py-1 text-xs font-mono font-black bg-yellow text-ink border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-lime active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {act.suggestedAction}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
