import type { QueuedOfflineAction } from "../types";
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

    pending.forEach((item) => {
      // Emit corresponding domain event
      eventBus.emit({
        type: `offline.${item.actionType}.synced`,
        producer: "@erp/offline-shell",
        data: item.payload,
      });
      item.syncStatus = "synced";
    });

    this.saveToStorage();
    if (pending.length > 0) {
      sound.playSuccessChime();
    }
    return { syncedCount: pending.length };
  }

  public clear() {
    this.queue = [];
    this.saveToStorage();
  }
}

export const offlineQueue = new OfflineQueueManager();
