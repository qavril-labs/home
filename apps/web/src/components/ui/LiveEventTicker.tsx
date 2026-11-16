import React, { useState, useEffect } from "react";
import { eventBus } from "../../lib/event-stream";
import { useToast } from "../../context/ToastContext";
import type { DomainEvent } from "../../types";
import {
  Radio,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

export const LiveEventTicker: React.FC = () => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<DomainEvent[]>(() => eventBus.getRecentEvents());
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hasPulse, setHasPulse] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = eventBus.onAny((event) => {
      setEvents((prev) => [event, ...prev.slice(0, 24)]);
      setHasPulse(true);
      setTimeout(() => setHasPulse(false), 1200);
    });

    return () => unsubscribe();
  }, []);

  const handleSimulateEvent = (type: string, data: Record<string, unknown>, producer: string) => {
    const emitted = eventBus.emit({
      type,
      producer,
      data,
    });
    showToast(`Domain Event Emitted: ${emitted.type}`, undefined, "good");
  };

  return (
    <div className="relative" data-testid="live-event-ticker">
      {/* Pill Trigger */}
      <button
        type="button"
        data-testid="live-event-ticker-btn"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-2.5 py-1 text-xs font-bold font-mono border-line shadow-tile transition-all cursor-pointer ${
          hasPulse ? "bg-lime text-ink scale-105" : "bg-panel text-text hover:bg-page"
        }`}
        title="View Real-Time Event Stream (contracts/events.md)"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-good opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-good" />
        </span>
        <span className="hidden sm:inline">Stream:</span>
        <span className="font-bold text-good">{events.length}</span>
        <span className="text-[10px] text-muted">events</span>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded Dropdown Panel */}
      {isExpanded && (
        <div
          data-testid="live-event-dropdown"
          className="absolute right-0 mt-2 w-[380px] sm:w-[460px] bg-panel border-2 border-ink shadow-[6px_6px_0_var(--q-ink)] z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-page border-b-2 border-ink">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-good animate-pulse" />
              <h3 className="font-display font-extrabold text-xs uppercase tracking-tight text-text">
                Live Domain Event Bus (SSE)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted bg-panel px-1.5 py-0.5 border border-ink">
                contracts/events.md
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-panel border border-transparent hover:border-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-muted hover:text-text" />
              </button>
            </div>
          </div>

          {/* Quick Simulation Bar */}
          <div className="p-2.5 bg-page/50 border-b border-grid">
            <span className="text-[10px] font-bold uppercase text-muted block mb-1.5">
              Simulate Reactive Real-Time Events:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="simulate-sale-btn"
                onClick={() =>
                  handleSimulateEvent(
                    "ledger.entry.posted",
                    {
                      reference: `JRN-${Math.floor(1000 + Math.random() * 9000)}`,
                      amount: "1450.00",
                      source: "quick_entry",
                    },
                    "@erp/api"
                  )
                }
                className="p-1 text-[10px] font-bold bg-panel hover:bg-lime hover:text-ink border border-ink text-left transition-colors cursor-pointer"
              >
                + $1,450.00 Quick Sale
              </button>

              <button
                type="button"
                data-testid="simulate-anomaly-btn"
                onClick={() =>
                  handleSimulateEvent(
                    "bot.signal.detected",
                    {
                      botId: "gus",
                      severity: "act",
                      message: "Duplicate invoice anomaly detected on INV-8890 ($1,240.00)",
                    },
                    "services/uaap/guard_gus"
                  )
                }
                className="p-1 text-[10px] font-bold bg-panel hover:bg-pink hover:text-ink border border-ink text-left transition-colors cursor-pointer"
              >
                ! Guard Gus Anomaly
              </button>

              <button
                type="button"
                data-testid="simulate-reorder-btn"
                onClick={() =>
                  handleSimulateEvent(
                    "bot.signal.detected",
                    {
                      botId: "rex",
                      severity: "watch",
                      message: "Aluminum round bar stock below reorder safety point",
                    },
                    "services/uaap/restock_rex"
                  )
                }
                className="p-1 text-[10px] font-bold bg-panel hover:bg-orange hover:text-ink border border-ink text-left transition-colors cursor-pointer"
              >
                ▲ Restock Rex Alert
              </button>

              <button
                type="button"
                data-testid="simulate-period-lock-btn"
                onClick={() =>
                  handleSimulateEvent(
                    "ledger.period.locked",
                    {
                      periodId: "2026-11",
                      closedBy: "chief-financial-officer",
                    },
                    "@erp/api/periods"
                  )
                }
                className="p-1 text-[10px] font-bold bg-panel hover:bg-cyan hover:text-ink border border-ink text-left transition-colors cursor-pointer"
              >
                🔒 Period Closing Lock
              </button>
            </div>
          </div>

          {/* Event Stream List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-2">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted font-medium">
                No domain events received yet. Click a simulation button above or perform an action to watch the stream!
              </div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 bg-page border-line shadow-sm hover:border-ink transition-colors text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[10px] pb-1 border-b border-grid">
                    <span className="font-bold text-good bg-panel px-1.5 py-0.2 border border-ink">
                      {evt.type}
                    </span>
                    <span className="text-muted">{new Date(evt.occurredAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="pt-1.5 flex items-start justify-between gap-2">
                    <div className="font-mono text-[11px] text-text break-all">
                      {JSON.stringify(evt.data)}
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[9px] text-muted font-mono pt-1 border-t border-grid">
                    <span>Producer: {evt.producer}</span>
                    <span>ID: {evt.id.slice(0, 14)}…</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
