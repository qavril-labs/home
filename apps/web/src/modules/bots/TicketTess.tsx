import React, { useState, useEffect, useCallback } from "react";
import { StatusChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/currency";
import { eventBus } from "../../lib/event-stream";
import { initialMockSupportTickets } from "../../lib/api-mock";
import type { SupportTicket } from "../../types";
import {
  Power,
  RotateCw,
  ShieldCheck,
  UserCheck,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";

export interface TicketTessProps {
  onNavigateBack?: () => void;
}

export const TicketTess: React.FC<TicketTessProps> = ({ onNavigateBack }) => {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>(initialMockSupportTickets);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [draftReplyText, setDraftReplyText] = useState<string>("");

  const refreshTickets = useCallback(() => {
    setIsLoading(true);
    const now = new Date();
    setLastUpdated(
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    );

    setTimeout(() => {
      setIsLoading(false);
      setIsLiveApi(false);
    }, 250);
  }, []);

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);

  const handleToggleKillSwitch = () => {
    const next = !isKillSwitchActive;
    setIsKillSwitchActive(next);
    showToast(
      next
        ? "Ticket Tess resumed: Autonomous ticket triage & resolution drafting active."
        : "Ticket Tess kill switch engaged: Autonomous support responses suspended.",
      undefined,
      next ? "good" : "act"
    );
  };

  const handleOpenReview = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setDraftReplyText(ticket.draftedReply || "");
    setIsReviewModalOpen(true);
  };

  const handleApproveReply = () => {
    if (!selectedTicket) return;

    // Emit support.ticket.resolved domain event
    eventBus.emit({
      type: "support.ticket.resolved",
      producer: "services/uaap/ticket_tess",
      data: {
        ticketId: selectedTicket.id,
        customerId: selectedTicket.customerId,
        customerName: selectedTicket.customerName,
        channel: selectedTicket.inquiryChannel,
        sentiment: selectedTicket.sentiment,
      },
    });

    setTickets((prev) =>
      prev.map((t) =>
        t.id === selectedTicket.id
          ? { ...t, status: "resolved", draftedReply: draftReplyText }
          : t
      )
    );

    setIsReviewModalOpen(false);
    showToast(
      `Dispatched resolution reply for ${selectedTicket.ticketNumber} to ${selectedTicket.customerName}`,
      undefined,
      "good"
    );
  };

  const handleEscalate = () => {
    if (!selectedTicket) return;

    eventBus.emit({
      type: "support.ticket.escalated",
      producer: "services/uaap/ticket_tess",
      data: {
        ticketId: selectedTicket.id,
        customerName: selectedTicket.customerName,
        priority: selectedTicket.priority,
      },
    });

    setTickets((prev) =>
      prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: "escalated" } : t))
    );

    setIsReviewModalOpen(false);
    showToast(
      `Escalated ticket ${selectedTicket.ticketNumber} to Senior Technical Support Lead`,
      undefined,
      "watch"
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" data-testid="ticket-tess-page">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="text-xs font-bold text-muted hover:text-text flex items-center gap-1 transition-colors cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          )}
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-mono font-bold text-muted uppercase">
            Agents & Autopilot
          </span>
          <span className="text-muted text-xs">/</span>
          <span className="text-xs font-bold text-text">Ticket Tess (AGT-05)</span>
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
            Agent Card: AGT-05 · SAL-11
          </span>
        </div>
      </div>

      {/* 2. Bot Header Banner */}
      <section className="neo-card p-6 bg-panel border-line shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {/* Tess Avatar: Lime #d4ff00 */}
            <div className="w-16 h-16 bg-lime text-ink border-line shadow-[3px_3px_0_var(--q-ink)] flex items-center justify-center select-none flex-shrink-0 relative">
              <svg className="w-12 h-12" viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="32" fill="var(--q-lime)" stroke="var(--q-ink)" strokeWidth="3" />
                <rect x="26" y="28" width="28" height="24" rx="4" fill="var(--q-ink)" />
                <circle cx="34" cy="40" r="3" fill="var(--q-lime)" />
                <circle cx="46" cy="40" r="3" fill="var(--q-lime)" />
                <path d="M33 34 L47 34" stroke="var(--q-lime)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-good opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-good border border-ink"></span>
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-text">
                  Ticket Tess
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 bg-page border-line font-bold text-muted">
                  AGT-05 · SAL-11 / SAL-12
                </span>
                <StatusChip
                  status={isKillSwitchActive ? "good" : "act"}
                  label={isKillSwitchActive ? "Active Sentinel" : "Kill Switch Engaged"}
                />
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl">
                Autonomous customer support & service desk co-pilot. Ingests omnichannel support inquiries, verifies customer warranty status and sales ledger provenance, and drafts context-aware resolution responses.
              </p>
            </div>
          </div>

          {/* Kill Switch & Refresh */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refreshTickets}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-bold bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-panel flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{lastUpdated ? `Sync: ${lastUpdated}` : "Sync"}</span>
            </button>

            <button
              type="button"
              data-testid="tess-kill-switch-btn"
              onClick={handleToggleKillSwitch}
              className={`px-3 py-2 text-xs font-bold border-line shadow-[2px_2px_0_var(--q-ink)] flex items-center gap-1.5 transition-all cursor-pointer ${
                isKillSwitchActive
                  ? "bg-good/20 text-good hover:bg-danger/20 hover:text-pink"
                  : "bg-danger text-panel"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isKillSwitchActive ? "Kill Switch: Active" : "Disengaged"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Open Queue
          </span>
          <div className="font-display font-black text-2xl text-text mt-1">
            {tickets.filter((t) => t.status !== "resolved").length} Tickets
          </div>
          <span className="text-[10px] font-mono text-muted">2 Drafted Resolutions</span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Avg First Response SLA
          </span>
          <div className="font-display font-black text-2xl text-text mt-1">
            4m 12s
          </div>
          <span className="text-[10px] font-mono text-good font-bold">98.4% within SLA</span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Resolution Confidence
          </span>
          <div className="font-display font-black text-2xl text-good mt-1">
            99.2%
          </div>
          <span className="text-[10px] font-mono text-muted">Knowledge Base match</span>
        </div>

        <div className="neo-card p-4 bg-panel">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
            Escalation Rate
          </span>
          <div className="font-display font-black text-2xl text-text mt-1">
            1.8%
          </div>
          <span className="text-[10px] font-mono text-muted">Human hand-off required</span>
        </div>
      </div>

      {/* 4. Active Support Queue */}
      <div className="neo-card p-5 bg-panel space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-grid">
          <div>
            <h2 className="font-display font-black text-lg uppercase tracking-tight">
              Inbound Support Queue & Draft Resolutions
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Review AI-drafted responses backed by customer order history and warranty terms.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-muted bg-page px-2 py-1 border-line">
            SAL-11 / SAL-12 Omnichannel
          </span>
        </div>

        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              data-testid={`ticket-row-${ticket.id}`}
              className="p-4 bg-page border-line space-y-3 hover:border-ink transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-panel px-2 py-0.5 border border-ink">
                    {ticket.ticketNumber}
                  </span>
                  <span className="font-bold text-sm text-text">{ticket.customerName}</span>
                  <span className="text-xs font-mono px-2 py-0.5 border border-ink bg-panel uppercase">
                    {ticket.inquiryChannel}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 uppercase border border-ink ${
                      ticket.sentiment === "frustrated"
                        ? "bg-danger/20 text-pink"
                        : ticket.sentiment === "positive"
                        ? "bg-good/20 text-good"
                        : "bg-panel text-muted"
                    }`}
                  >
                    Sentiment: {ticket.sentiment}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <StatusChip
                    status={
                      ticket.status === "resolved"
                        ? "good"
                        : ticket.status === "escalated"
                        ? "act"
                        : "watch"
                    }
                    label={ticket.status.toUpperCase()}
                  />
                </div>
              </div>

              {/* Subject & Inquiry */}
              <div>
                <h3 className="font-bold text-xs text-text">{ticket.subject}</h3>
                <p className="text-xs text-muted mt-1 bg-panel p-2.5 border-line font-mono text-[11px] leading-relaxed">
                  "{ticket.inquiryText}"
                </p>
              </div>

              {/* Context bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-grid text-xs">
                <div className="flex items-center gap-4 text-muted text-[11px]">
                  <span>
                    Warranty:{" "}
                    <strong
                      className={
                        ticket.warrantyStatus === "active"
                          ? "text-good"
                          : ticket.warrantyStatus === "expired"
                          ? "text-pink"
                          : "text-text"
                      }
                    >
                      {ticket.warrantyStatus.replace("_", " ").toUpperCase()}
                    </strong>
                  </span>
                  {ticket.relatedOrderAmount && (
                    <span>
                      Lifetime Invoiced:{" "}
                      <strong className="text-text font-mono font-bold">
                        {formatMoney(ticket.relatedOrderAmount)}
                      </strong>
                    </span>
                  )}
                  <span>
                    Confidence:{" "}
                    <strong className="text-good font-mono font-bold">
                      {(ticket.confidenceScore * 100).toFixed(1)}%
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {ticket.status === "drafted" && (
                    <Button
                      variant="lime"
                      size="sm"
                      data-testid={`review-ticket-${ticket.id}`}
                      onClick={() => handleOpenReview(ticket)}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Review & Dispatch Reply
                    </Button>
                  )}
                  {ticket.status === "resolved" && (
                    <span className="text-xs font-mono text-good font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolved & Dispatched
                    </span>
                  )}
                  {ticket.status === "escalated" && (
                    <span className="text-xs font-mono text-pink font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      Assigned to Support Lead
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Review & Dispatch Modal */}
      {selectedTicket && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title={`Review Support Draft · ${selectedTicket.ticketNumber}`}
          description={`Customer: ${selectedTicket.customerName} · Inquiry Channel: ${selectedTicket.inquiryChannel.toUpperCase()}`}
          primaryActionLabel="Approve & Dispatch Reply"
          primaryActionVariant="lime"
          onPrimaryAction={handleApproveReply}
          secondaryActionLabel="Cancel"
          onSecondaryAction={() => setIsReviewModalOpen(false)}
        >
          <div className="space-y-4 text-xs" data-testid="tess-review-modal">
            <div className="p-3 bg-page border-line space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted block">
                Customer Message ({selectedTicket.customerName}):
              </span>
              <p className="font-mono text-text text-[11px] leading-relaxed">
                {selectedTicket.inquiryText}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-muted">
                  AI-Drafted Response (Verified with Warranty & Catalog):
                </label>
                <span className="font-mono text-[10px] text-good font-bold">
                  {(selectedTicket.confidenceScore * 100).toFixed(1)}% Match
                </span>
              </div>
              <textarea
                value={draftReplyText}
                onChange={(e) => setDraftReplyText(e.target.value)}
                rows={4}
                className="w-full p-2.5 bg-panel border-line font-mono text-xs text-text focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>

            <div className="p-3 bg-panel border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-good" />
                <span className="text-[11px] text-muted">
                  Statutory terms and warranty SLA validated against ERP contracts.
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEscalate}
                className="text-pink hover:bg-danger/10"
              >
                Escalate to Human
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
