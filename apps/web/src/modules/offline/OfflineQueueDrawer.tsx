import React, { useState, useEffect } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { StatusChip } from "../../components/ui/StatusChip";
import { useToast } from "../../context/ToastContext";
import { offlineQueue } from "../../lib/offline-queue";
import type { QueuedOfflineAction } from "../../types";
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Plus,
  Clock,
  ShieldCheck,
} from "lucide-react";

export interface OfflineQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineQueueDrawer: React.FC<OfflineQueueDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueuedOfflineAction[]>(() => offlineQueue.getQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    return offlineQueue.subscribe((q) => setQueue(q));
  }, []);

  const pendingCount = queue.filter((a) => a.syncStatus === "pending").length;

  const handleSimulateOfflineEntry = () => {
    offlineQueue.enqueue({
      actionType: "quick_sale",
      payload: {
        customer: "Delta Dynamics LLC",
        amount: "850.00",
        items: "Standard Carbide Endmill Set (10 pcs)",
        offlineRecordedAt: new Date().toISOString(),
      },
    });

    showToast("Recorded $850.00 field sale to offline local queue", undefined, "good");
  };

  const handleFlushQueue = async () => {
    setIsSyncing(true);
    setTimeout(async () => {
      const res = await offlineQueue.flush();
      setIsSyncing(false);
      showToast(
        `Synchronized ${res.syncedCount} queued transaction(s) to General Ledger & Event Bus`,
        undefined,
        "good"
      );
    }, 450);
  };

  const handleClear = () => {
    offlineQueue.clear();
    showToast("Offline queue cleared", undefined, "good");
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Mobile & Offline Operations Queue (PLT-19)"
      description="Field operations buffer · Local-first transaction queue with conflict-free event sync"
    >
      <div className="space-y-6 pb-6 text-xs" data-testid="offline-queue-drawer">
        {/* Status Strip */}
        <div className="p-4 bg-page border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow border border-ink shadow-[2px_2px_0_var(--q-ink)] flex items-center justify-center text-ink shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm uppercase">
                  Local-First Indexed Buffer
                </span>
                <span className="w-2 h-2 rounded-full bg-good animate-ping" />
              </div>
              <p className="text-[11px] text-muted">
                {pendingCount > 0
                  ? `${pendingCount} transaction(s) waiting for outbox synchronization.`
                  : "All local transactions synchronized to primary ledger."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="lime"
              size="sm"
              data-testid="simulate-offline-entry-btn"
              onClick={handleSimulateOfflineEntry}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Simulate Offline Sale
            </Button>
          </div>
        </div>

        {/* Queue Items List */}
        <div className="neo-card p-4 bg-panel space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-grid">
            <span className="font-display font-black text-xs uppercase tracking-tight">
              Queued Transactions ({queue.length})
            </span>
            {queue.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-[10px] py-0.5 px-2 text-pink"
              >
                Clear All
              </Button>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="p-6 bg-page border-line text-center space-y-2">
              <WifiOff className="w-8 h-8 text-muted mx-auto" />
              <p className="font-bold text-xs">No pending offline actions</p>
              <p className="text-[11px] text-muted max-w-xs mx-auto">
                Actions captured in warehouses, vehicles, or field sites without signal will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  data-testid={`offline-item-${item.id}`}
                  className="p-3 bg-page border-line flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] bg-panel px-1.5 py-0.5 border border-ink uppercase">
                        {item.actionType.replace("_", " ")}
                      </span>
                      <span className="text-[11px] font-bold text-text">
                        {(item.payload as any).customer || (item.payload as any).items || item.id}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <div>
                    <StatusChip
                      status={item.syncStatus === "synced" ? "good" : "watch"}
                      label={item.syncStatus.toUpperCase()}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flush Button */}
        <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted">
            <ShieldCheck className="w-4 h-4 text-good shrink-0" />
            <span className="text-[11px]">
              Sync flushes directly into the transactional event bus under tenant isolation.
            </span>
          </div>

          <Button
            variant="lime"
            size="md"
            data-testid="flush-offline-queue-btn"
            onClick={handleFlushQueue}
            disabled={isSyncing || pendingCount === 0}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Synchronizing to Ledger…" : `Sync All (${pendingCount} Pending)`}</span>
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
