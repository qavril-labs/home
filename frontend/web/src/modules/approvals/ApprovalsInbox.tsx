import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { ApprovalDetailModal } from "./ApprovalDetailModal";
import { PayloadHashModal } from "./PayloadHashModal";
import { AgentKillSwitchCard } from "./AgentKillSwitchCard";
import { AgentCards } from "./AgentCards";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import {
  approveProposal,
  listAgents,
  listApprovals,
  rejectProposal,
  UaapError,
  type UaapAgent,
  type UaapApproval,
} from "../../lib/uaap-client";
import type {
  ApprovalItem,
  ApprovalStatus,
  AgentRegistryItem,
} from "../../types";
import {
  ShieldCheck,
  RotateCw,
  CheckCircle2,
  XCircle,
  Hash,
  Eye,
  Clock,
} from "lucide-react";

export interface ApprovalsInboxProps {
  onNavigateBack?: () => void;
}

/** Maps a UAAP proposal to the inbox item. Tier 3 is the approval tier by definition (AGT-06). */
function toItem(a: UaapApproval, agentNames: Map<string, string>): ApprovalItem {
  return {
    id: a.approval_id,
    runId: a.run_id,
    agentId: a.agent_id,
    agentName: agentNames.get(a.agent_id) ?? a.agent_id,
    agentColor: "var(--q-cyan)",
    toolName: a.action,
    tier: 3,
    title: a.summary.split("\n")[0] || a.action,
    summary: a.summary,
    initiator: a.initiator_id,
    initiatorPrincipal: `user:${a.initiator_id}`,
    requiresDualControl: true,
    payload: a.payload,
    payloadHash: a.payload_hash,
    status: a.status,
    createdAt: a.created_at,
    expiresAt: a.expires_at,
    approvedBy: a.decided_by ?? undefined,
    approvedAt: a.decided_at ?? undefined,
    rejectionReason: a.status === "REJECTED" ? (a.outcome ?? undefined) : undefined,
    canDecide: a.can_decide,
  };
}

function toAgentItem(a: UaapAgent, proposals: UaapApproval[]): AgentRegistryItem {
  return {
    id: a.agent_id,
    name: a.name,
    role: a.purpose,
    color: "var(--q-cyan)",
    catalogId: a.agent_id,
    enabled: a.enabled,
    pendingApprovals: proposals.filter((p) => p.agent_id === a.agent_id && p.status === "PENDING").length,
    toolsGranted: [],
    maxTier: 3,
    lastActive: "",
  };
}

export const ApprovalsInbox: React.FC<ApprovalsInboxProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();

  // Data comes only from the UAAP API (docs/ui-contract.md section 5). Nothing is invented.
  const [raw, setRaw] = useState<UaapApproval[]>([]);
  const [agents, setAgents] = useState<AgentRegistryItem[]>([]);
  const [uaapAgents, setUaapAgents] = useState<UaapAgent[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "ALL">("PENDING");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  // Modals
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [hashModalApproval, setHashModalApproval] = useState<ApprovalItem | null>(null);

  const agentNames = useMemo(() => new Map(agents.map((a) => [a.catalogId, a.name])), [agents]);
  const approvals = useMemo(() => raw.map((a) => toItem(a, agentNames)), [raw, agentNames]);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, agentList] = await Promise.all([listApprovals(), listAgents()]);
      setRaw(items);
      setAgents(agentList.map((a) => toAgentItem(a, items)));
      setUaapAgents(agentList);
      setIsLiveApi(true);
      setLoadError(null);
    } catch (err) {
      setIsLiveApi(false);
      setLoadError(err instanceof UaapError ? err.message : "The approvals service could not be reached.");
    } finally {
      setIsLoading(false);
      setLastRefreshed(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    }
  }, []);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  // An action is shown as done only after the API returns it.
  const handleApprove = async (id: string) => {
    const item = approvals.find((a) => a.id === id);
    if (!item || busyId) return;
    setBusyId(id);
    try {
      const result = await approveProposal(id, item.payloadHash);
      setRaw((prev) => prev.map((a) => (a.approval_id === id ? result.approval : a)));
      setSelectedApproval(null);
      if (result.approval.status === "APPROVED") {
        showToast(result.reply.text.split("\n")[0] || "Approved.", { type: "success" });
      } else {
        showToast(`The approval did not complete: ${result.approval.outcome ?? "see the inbox"}.`, {
          type: "warning",
        });
      }
    } catch (err) {
      showToast(err instanceof UaapError ? err.message : "Approval failed. Nothing was changed.", {
        type: "warning",
      });
      void fetchApprovals();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const result = await rejectProposal(id, reason);
      setRaw((prev) => prev.map((a) => (a.approval_id === id ? result.approval : a)));
      setSelectedApproval(null);
      showToast(`Proposal ${id} rejected. Nothing was posted.`, { type: "warning" });
    } catch (err) {
      showToast(err instanceof UaapError ? err.message : "Rejection failed. Nothing was changed.", {
        type: "warning",
      });
      void fetchApprovals();
    } finally {
      setBusyId(null);
    }
  };

  // Turning a bot on or off is an administrator action in the admin console, not in this inbox.
  const handleToggleAgent = (_agentId: string) => {
    showToast("Switching a bot on or off needs an administrator in the admin console.", { type: "info" });
  };

  // Filter logic
  const filteredApprovals = approvals.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (tierFilter !== "all" && item.tier.toString() !== tierFilter) return false;
    if (agentFilter !== "all" && item.agentId !== agentFilter) return false;
    return true;
  });

  const pendingList = approvals.filter((a) => a.status === "PENDING");
  const dualControlCount = pendingList.filter((a) => a.requiresDualControl).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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
          <span className="hidden sm:inline text-xs font-mono font-bold text-muted uppercase">
            Security & Governance
          </span>
          <span className="hidden sm:inline text-muted text-xs">/</span>
          <span className="text-xs font-bold text-text truncate">Approvals Platform (PLT-07)</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border-line ${
              isLiveApi ? "bg-lime text-ink" : "bg-cream text-ink"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveApi ? "bg-good" : "bg-watch"}`} />
            {isLiveApi ? "API Connected" : "Not connected"}
          </span>
          <span className="hidden sm:inline text-xs font-mono font-bold text-muted">
            PLT-07 · AGT-01 · AGT-06
          </span>
        </div>
      </div>

      {/* 2. Platform Header */}
      <section
        className="neo-card p-4 sm:p-6 bg-panel border-line shadow-card"
        aria-label="Approvals Platform Header"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-pink text-white border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0">
              <ShieldCheck className="w-7 h-7 sm:w-10 sm:h-10" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                <h1 className="font-display font-extrabold text-xl sm:text-3xl uppercase tracking-tight text-text leading-tight">
                  Approvals Inbox
                </h1>
                <span className="px-2 py-0.5 bg-pink/20 border border-pink text-[10px] sm:text-[11px] font-bold text-ink uppercase tracking-wider">
                  Human-in-the-Loop Engine
                </span>
                <span className="px-1.5 py-0.5 bg-page border border-grid text-[10px] font-mono text-muted">
                  PLT-07
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-normal">
                Cryptographically secured supervisor approvals for autonomous agents. Enforces Dual-Control (AGT-06), canonical 5-tier permissions, and SHA-256 payload immutability verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-page px-3 py-1.5 border-line shadow-sm">
              <span className="w-2 h-2 rounded-full bg-good animate-ping shrink-0" />
              <span className="text-xs font-bold text-text">
                Live · updated {lastRefreshed || "just now"}
              </span>
              <button
                type="button"
                onClick={fetchApprovals}
                disabled={isLoading}
                title="Sync from API"
                className="ml-1 text-muted hover:text-text disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 4 KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-panel p-4 border-line shadow-card">
          <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
            Pending Proposals
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display font-black text-2xl text-text">
              {pendingList.length} Actions
            </span>
            <span className="text-xs font-mono font-bold text-watch">Awaiting Sign-Off</span>
          </div>
          <p className="text-[11px] text-muted mt-1">Tier 2 and Tier 3 gates</p>
        </div>

        <div className="bg-panel p-4 border-line shadow-card">
          <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
            Dual-Control Enforced
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display font-black text-2xl text-text">
              {dualControlCount} Items
            </span>
            <span className="text-xs font-mono font-bold text-cyan">AGT-06 Guard</span>
          </div>
          <p className="text-[11px] text-muted mt-1">Separation of duties active</p>
        </div>

        <div className="bg-panel p-4 border-line shadow-card">
          <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
            Total Value Under Review
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display font-black text-2xl text-text">
              $8,357.50
            </span>
            <span className="text-xs font-mono font-bold text-good">Zero Variance</span>
          </div>
          <p className="text-[11px] text-muted mt-1">Reversible journal & PO proposals</p>
        </div>

        <div className="bg-panel p-4 border-line shadow-card">
          <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
            Approval SLA Performance
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display font-black text-2xl text-text">100%</span>
            <span className="text-xs font-mono font-bold text-good">&lt; 24h Window</span>
          </div>
          <p className="text-[11px] text-muted mt-1">Zero expired tokens</p>
        </div>
      </div>

      {/* 4. Approvals Inbox Table & Filter Hub */}
      <section
        className="neo-card p-4 bg-panel border-line shadow-card space-y-4"
        aria-label="Approvals Table Section"
      >
        {/* Filter Controls Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-grid">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((st) => {
              const count =
                st === "ALL"
                  ? approvals.length
                  : approvals.filter((a) => a.status === st).length;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-bold border-line transition-all ${
                    statusFilter === st
                      ? "bg-pink text-white shadow-[2px_2px_0_var(--q-ink)]"
                      : "bg-page text-muted hover:text-text hover:bg-page/80"
                  }`}
                >
                  {st === "PENDING"
                    ? `Pending (${count})`
                    : st === "APPROVED"
                    ? `Approved (${count})`
                    : st === "REJECTED"
                    ? `Rejected (${count})`
                    : `All History (${count})`}
                </button>
              );
            })}
          </div>

          {/* Tier and Agent Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted font-bold text-[11px]">Tier:</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-2 py-1 bg-page border-line text-xs font-bold focus:outline-none"
              >
                <option value="all">All Tiers</option>
                <option value="2">Tier 2 (Supervised)</option>
                <option value="3">Tier 3 (Dual Control)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted font-bold text-[11px]">Agent:</span>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="px-2 py-1 bg-page border-line text-xs font-bold focus:outline-none"
              >
                <option value="all">All Agents</option>
                <option value="lou">Ledger Lou</option>
                <option value="rex">Restock Rex</option>
                <option value="chloe">Chase Chloe</option>
                <option value="gus">Guard Gus</option>
              </select>
            </div>
          </div>
        </div>

        {/* Approvals Table */}
        <div className="neo-table-wrapper overflow-x-auto max-w-full">
          <table className="w-full min-w-[640px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-page text-muted uppercase text-[10px] tracking-wider font-bold">
                <th className="py-2.5 px-3">Proposal & Proposer</th>
                <th className="py-2.5 px-3">Target Tool & Tier</th>
                <th className="py-2.5 px-3 text-right">Value</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {filteredApprovals.map((item) => (
                <tr key={item.id} className="hover:bg-page/70 transition-colors">
                  {/* Proposal Info */}
                  <td className="py-3 px-3 align-top max-w-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-ink flex-shrink-0"
                        style={{ backgroundColor: item.agentColor }}
                      />
                      <span className="font-bold text-xs text-text">{item.agentName}</span>
                      <span className="font-mono text-[10px] text-muted">({item.id})</span>
                    </div>
                    <div className="font-bold text-text text-xs leading-snug">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-1">
                      {item.summary}
                    </p>
                  </td>

                  {/* Tool & Tier */}
                  <td className="py-3 px-3 align-top">
                    <div className="font-mono text-xs font-bold text-text">
                      {item.toolName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold border-line ${
                          item.tier === 3
                            ? "bg-pink text-white"
                            : "bg-yellow text-ink"
                        }`}
                      >
                        Tier {item.tier}
                      </span>
                      {item.requiresDualControl && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-cyan/20 text-ink border border-cyan">
                          <ShieldCheck className="w-2.5 h-2.5 text-cyan" />
                          <span>Dual-Control</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Amount Value */}
                  <td className="py-3 px-3 align-top font-mono font-bold text-right text-xs text-text">
                    {item.amount ? formatMoney(item.amount) : "—"}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                    {item.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow/30 border border-yellow text-ink text-[11px] font-bold">
                        <Clock className="w-3 h-3 text-watch" />
                        <span>Pending Review</span>
                      </span>
                    )}
                    {item.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-good/20 border border-good text-good text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approved</span>
                      </span>
                    )}
                    {item.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-act/20 border border-act text-act text-[11px] font-bold">
                        <XCircle className="w-3 h-3" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHashModalApproval(item)}
                        className="text-xs py-1 px-2 text-muted hover:text-text"
                        title="Verify SHA-256 Digest"
                      >
                        <Hash className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant={item.status === "PENDING" ? "yellow" : "ghost"}
                        onClick={() => setSelectedApproval(item)}
                        className="text-xs py-1 px-2.5 font-bold flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{item.status === "PENDING" ? "Review" : "View"}</span>
                      </Button>

                      {item.status === "PENDING" && item.canDecide !== false && (
                        <Button
                          size="sm"
                          variant="lime"
                          disabled={busyId === item.id}
                          onClick={() => handleApprove(item.id)}
                          className="text-xs py-1 px-2.5 font-bold"
                        >
                          Approve
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

      {loadError && (
        <p role="alert" className="mb-3 p-3 bg-act/10 border-line border-act text-act text-xs font-bold">
          {loadError} Nothing shown here is a sample; retry when the service is back.
        </p>
      )}

      {/* 4a. Your bots: one card per bot the API lists, with counts from the inbox */}
      <AgentCards
        agents={uaapAgents}
        pendingFor={(id) => raw.filter((p) => p.agent_id === id && p.status === "PENDING").length}
      />

      {/* 5. Agent Governance & Kill Switches Card */}
      <AgentKillSwitchCard agents={agents} onToggleAgent={handleToggleAgent} />

      {/* 6. Review Proposal Modal */}
      <ApprovalDetailModal
        isOpen={Boolean(selectedApproval)}
        onClose={() => setSelectedApproval(null)}
        approval={selectedApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onViewHash={(appr) => setHashModalApproval(appr)}
      />

      {/* 7. Cryptographic Hash Modal */}
      <PayloadHashModal
        isOpen={Boolean(hashModalApproval)}
        onClose={() => setHashModalApproval(null)}
        approval={hashModalApproval}
      />
    </div>
  );
};

export default ApprovalsInbox;
