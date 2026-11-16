import type { DomainEvent } from "../types";

export type EventHandler<T = any> = (event: DomainEvent<T>) => void;

class RealTimeEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private wildcardListeners: Set<EventHandler> = new Set();
  private eventHistory: DomainEvent<any>[] = [];
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private connectionStatusListeners: Set<(connected: boolean) => void> = new Set();

  constructor() {
    this.initSse();
  }

  private initSse() {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    try {
      const apiBase = (window as any).ERP_CONFIG?.apiBase || "http://localhost:3002";
      // Optional live SSE endpoint if backend is running
      this.eventSource = new EventSource(`${apiBase}/v1/events/stream`);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
      };

      this.eventSource.onmessage = (msg) => {
        try {
          const parsed: DomainEvent = JSON.parse(msg.data);
          this.emit(parsed, false);
        } catch {
          // ignore heartbeat or non-json message
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch {
      this.isConnected = false;
      this.notifyStatus(false);
    }
  }

  private notifyStatus(status: boolean) {
    this.connectionStatusListeners.forEach((fn) => fn(status));
  }

  public subscribeConnectionStatus(callback: (connected: boolean) => void): () => void {
    this.connectionStatusListeners.add(callback);
    callback(this.isConnected);
    return () => this.connectionStatusListeners.delete(callback);
  }

  public on<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  public onAny(handler: EventHandler): () => void {
    this.wildcardListeners.add(handler);
    return () => {
      this.wildcardListeners.delete(handler);
    };
  }

  public emit<T = Record<string, unknown>>(
    eventOrPayload: DomainEvent<T> | { type: string; data: T; producer?: string; correlationId?: string },
    recordInHistory: boolean = true
  ): DomainEvent<T> {
    const fullEvent: DomainEvent<T> = "id" in eventOrPayload && "occurredAt" in eventOrPayload
      ? (eventOrPayload as DomainEvent<T>)
      : {
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          tenantId: "apex-prod-01",
          type: eventOrPayload.type,
          version: 1,
          occurredAt: new Date().toISOString(),
          producer: eventOrPayload.producer || "@erp/web",
          correlationId: eventOrPayload.correlationId || `corr-${Date.now()}`,
          data: eventOrPayload.data,
        };

    if (recordInHistory) {
      this.eventHistory.unshift(fullEvent);
      if (this.eventHistory.length > 50) {
        this.eventHistory.pop();
      }
    }

    // Notify specific type handlers
    const handlers = this.listeners.get(fullEvent.type);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(fullEvent);
        } catch (e) {
          console.error(`Error in event handler for ${fullEvent.type}:`, e);
        }
      });
    }

    // Notify wildcard handlers
    this.wildcardListeners.forEach((fn) => {
      try {
        fn(fullEvent);
      } catch (e) {
        console.error("Error in wildcard event handler:", e);
      }
    });

    return fullEvent;
  }

  public getRecentEvents(): DomainEvent[] {
    return [...this.eventHistory];
  }

  public clearHistory(): void {
    this.eventHistory = [];
  }
}

export const eventBus = new RealTimeEventBus();
