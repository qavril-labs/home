import React from "react";
import type { AgentRegistryItem } from "../../types";
import { Power, Shield, Wrench } from "lucide-react";

export interface AgentKillSwitchCardProps {
  agents: AgentRegistryItem[];
  onToggleAgent: (agentId: string) => void;
}

export const AgentKillSwitchCard: React.FC<AgentKillSwitchCardProps> = ({
  agents,
  onToggleAgent,
}) => {
  return (
    <div className="neo-card p-4 bg-panel border-line shadow-card space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-grid">
        <div>
          <h3 className="font-display font-extrabold text-sm uppercase tracking-tight text-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan" />
            <span>Agent Governance & Kill Switches (UAAP Admin)</span>
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            Operational boundary controls reflecting <code>POST /v1/admin/agents/&#123;id&#125;/disable</code>.
          </p>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 bg-page border border-grid text-muted">
          6 Registered Agents
        </span>
      </div>

      {/* Grid of Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-3 border-line transition-all ${
              agent.enabled ? "bg-page shadow-sm" : "bg-panel opacity-60 border-dashed"
            }`}
          >
            {/* Top: Name & Kill Switch */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-ink flex-shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                <div>
                  <h4 className="font-bold text-xs text-text">{agent.name}</h4>
                  <span className="text-[10px] text-muted font-medium">{agent.role}</span>
                </div>
              </div>

              {/* Kill Switch Toggle Button */}
              <button
                type="button"
                onClick={() => onToggleAgent(agent.id)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold border-line shadow-[1px_1px_0_var(--q-ink)] transition-transform active:translate-y-0.5 ${
                  agent.enabled
                    ? "bg-lime text-ink hover:bg-lime/90"
                    : "bg-act text-white hover:bg-act/90"
                }`}
                title={agent.enabled ? "Click to suspend agent" : "Click to resume agent"}
              >
                <Power className="w-2.5 h-2.5" />
                <span>{agent.enabled ? "ON" : "OFF"}</span>
              </button>
            </div>

            {/* Badges: Catalog ID, Max Tier */}
            <div className="flex items-center gap-1.5 mb-2 text-[10px]">
              <span className="px-1.5 py-0.5 bg-panel border border-grid font-mono text-muted">
                {agent.catalogId}
              </span>
              <span className="px-1.5 py-0.5 bg-panel border border-grid font-bold text-text">
                Tier {agent.maxTier} Max
              </span>
              {agent.pendingApprovals > 0 && (
                <span className="px-1.5 py-0.5 bg-yellow/30 border border-yellow font-bold text-ink">
                  {agent.pendingApprovals} Pending
                </span>
              )}
            </div>

            {/* Granted Tools List */}
            <div className="text-[10px] text-muted space-y-0.5 pt-1.5 border-t border-grid">
              <div className="flex items-center gap-1 font-bold">
                <Wrench className="w-2.5 h-2.5" />
                <span>Granted Tools:</span>
              </div>
              <p className="font-mono text-[9px] text-text truncate">
                {agent.toolsGranted.join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
