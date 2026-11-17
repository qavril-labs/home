import type { QueuedOfflineAction } from "../types";
import { liveApi, readLiveSession } from "./live-api";
import { eventBus } from "./event-stream";
import { sound } from "./sound-effects";

const STORAGE_KEY = "qavril-offline-queue";

class OfflineQueueManager {
  private queue: QueuedOfflineAction[] = [];
  private listeners: Set<(queue: QueuedOfflineAction[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // ignore
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.queue]));
  }

  public subscribe(callback: (queue: QueuedOfflineAction[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.queue]);
    return () => this.listeners.delete(callback);
  }

  public getQueue(): QueuedOfflineAction[] {
    return [...this.queue];
  }

  public getPendingCount(): number {
    return this.queue.filter((a) => a.syncStatus === "pending").length;
  }

  public enqueue(action: Omit<QueuedOfflineAction, "id" | "timestamp" | "syncStatus" | "retryCount">): QueuedOfflineAction {
    const item: QueuedOfflineAction = {
      id: `off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      syncStatus: "pending",
      retryCount: 0,
      ...action,
    };

    this.queue.unshift(item);
    this.saveToStorage();
    sound.playClick();
    return item;
  }

  public async flush(): Promise<{ syncedCount: number }> {
    sound.playAutopilotPing();
    const pending = this.queue.filter((a) => a.syncStatus === "pending");

    let syncedCount = 0;
    for (const item of pending) {
      if (item.actionType === "pos_sale") {
        if (await this.sendSale(item)) syncedCount += 1;
        continue;
      }
      // Emit corresponding domain event
      eventBus.emit({
        type: `offline.${item.actionType}.synced`,
        producer: "@erp/offline-shell",
        data: item.payload,
      });
      item.syncStatus = "synced";
      syncedCount += 1;
    }

    this.saveToStorage();
    if (syncedCount > 0) {
      sound.playSuccessChime();
    }
    return { syncedCount };
  }

  /**
   * Sends a till sale to the server. A sale the server keeps for review counts as sent, because it is stored and
   * someone will decide it. A sale the server refuses stays in the queue with the reason, so nothing is lost.
   */
  private async sendSale(item: QueuedOfflineAction): Promise<boolean> {
    const session = readLiveSession();
    if (!session) {
      item.syncStatus = "pending";
      item.errorMessage = "Sign in to send this sale.";
      return false;
    }
    item.syncStatus = "syncing";
    try {
      const response = await liveApi.syncSales(session.token, item.payload.body as Record<string, unknown>);
      const result = response.results[0];
      if (result && result.status !== "REJECTED") {
        item.syncStatus = "synced";
        item.errorMessage = undefined;
        return true;
      }
      item.syncStatus = "failed";
      item.errorMessage = result ? result.reasons.join("; ") : "The server did not return a result for this sale.";
      return false;
    } catch (error) {
      item.retryCount += 1;
      item.syncStatus = "pending";
      item.errorMessage = error instanceof Error ? error.message : "The sale could not be sent.";
      return false;
    }
  }

  public clear() {
    this.queue = [];
    this.saveToStorage();
  }
}

export const offlineQueue = new OfflineQueueManager();
