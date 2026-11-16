import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ArrowRight,
  Sun,
  Moon,
  Plus,
  FileSpreadsheet,
  Users,
  Package,
  LayoutDashboard,
  Bot,
  MessageSquare,
  Sparkles,
  Send,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { initialConversationalTurns } from "../../lib/api-mock";
import type { ConversationalTurn } from "../../types";

export interface CommandItem {
  id: string;
  title: string;
  category: "Actions" | "Navigation" | "Theme";
  icon: React.ReactNode;
  onSelect: () => void;
}

export interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onOpenQuickEntry: (kind: "sale" | "expense") => void;
  onOpenContactDrawer: () => void;
  onOpenItemDrawer: () => void;
  onOpenOcrDrawer?: () => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenQuickEntry,
  onOpenContactDrawer,
  onOpenItemDrawer,
  onOpenOcrDrawer,
}) => {
  const [mode, setMode] = useState<"commands" | "ai09">("commands");
  const [query, setQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [turns, setTurns] = useState<ConversationalTurn[]>(initialConversationalTurns);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  const commands: CommandItem[] = [
    {
      id: "sale",
      title: "Record a sale",
      category: "Actions",
      icon: <Plus className="w-4 h-4 text-series-in" />,
      onSelect: () => {
        onOpenQuickEntry("sale");
        onClose();
      },
    },
    {
      id: "expense",
      title: "Record an expense",
      category: "Actions",
      icon: <Plus className="w-4 h-4 text-series-out" />,
      onSelect: () => {
        onOpenQuickEntry("expense");
        onClose();
      },
    },
    {
      id: "new-contact",
      title: "Add new customer or supplier (MDM-01)",
      category: "Actions",
      icon: <Users className="w-4 h-4 text-pink" />,
      onSelect: () => {
        onOpenContactDrawer();
        onClose();
      },
    },
    {
      id: "new-item",
      title: "Add new product item (MDM-02)",
      category: "Actions",
      icon: <Package className="w-4 h-4 text-cyan" />,
      onSelect: () => {
        onOpenItemDrawer();
        onClose();
      },
    },
    {
      id: "scan-ocr",
      title: "Scan Supplier Bill / Invoice (AI-01 OCR Inspector)",
      category: "Actions",
      icon: <FileSpreadsheet className="w-4 h-4 text-lime" />,
      onSelect: () => {
        onOpenOcrDrawer?.();
        onClose();
      },
    },
    {
      id: "nav-dash",
      title: "Go to Dashboard",
      category: "Navigation",
      icon: <LayoutDashboard className="w-4 h-4 text-muted" />,
      onSelect: () => {
        onNavigate("dashboard");
        onClose();
      },
    },
    {
      id: "nav-approvals",
      title: "Go to Approvals Inbox (PLT-07 / AGT-01)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-pink" />,
      onSelect: () => {
        onNavigate("approvals");
        onClose();
      },
    },
    {
      id: "nav-ledger-lou",
      title: "Go to Ledger Lou · Month-End Checker (AGT-03)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-cyan" />,
      onSelect: () => {
        onNavigate("ledger-lou");
        onClose();
      },
    },
    {
      id: "nav-chase-chloe",
      title: "Go to Chase Chloe · AR & Invoicing (FIN-14)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-yellow" />,
      onSelect: () => {
        onNavigate("chase-chloe");
        onClose();
      },
    },
    {
      id: "nav-restock-rex",
      title: "Go to Restock Rex · Inventory Replenishment (AGT-04)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-orange" />,
      onSelect: () => {
        onNavigate("restock-rex");
        onClose();
      },
    },
    {
      id: "nav-guard-gus",
      title: "Go to Guard Gus · Anomaly Sentinel (AI-04)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-pink" />,
      onSelect: () => {
        onNavigate("guard-gus");
        onClose();
      },
    },
    {
      id: "nav-forecast-finn",
      title: "Go to Forecast Finn · Cash River Forecaster (AIS-02)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-violet" />,
      onSelect: () => {
        onNavigate("forecast-finn");
        onClose();
      },
    },
    {
      id: "nav-pip",
      title: "Go to Pip · Deal Closer & Pipeline (AGT-02)",
      category: "Navigation",
      icon: <Bot className="w-4 h-4 text-lime" />,
      onSelect: () => {
        onNavigate("pip");
        onClose();
      },
    },
    {
      id: "nav-packs",
      title: "Go to Industry Pack Agents · GAR & FMCG (TX-01, DS-01)",
      category: "Navigation",
      icon: <Sparkles className="w-4 h-4 text-cyan" />,
      onSelect: () => {
        onNavigate("packs");
        onClose();
      },
    },
    {
      id: "nav-contacts",
      title: "Go to Contacts Directory",
      category: "Navigation",
      icon: <Users className="w-4 h-4 text-muted" />,
      onSelect: () => {
        onNavigate("contacts");
        onClose();
      },
    },
    {
      id: "nav-items",
      title: "Go to Products & Items (MDM-02)",
      category: "Navigation",
      icon: <Package className="w-4 h-4 text-muted" />,
      onSelect: () => {
        onNavigate("items");
        onClose();
      },
    },
    {
      id: "nav-inventory",
      title: "Go to Inventory & Warehouses (INV-01 / INV-02)",
      category: "Navigation",
      icon: <Package className="w-4 h-4 text-violet" />,
      onSelect: () => {
        onNavigate("inventory");
        onClose();
      },
    },
    {
      id: "nav-crm",
      title: "Go to CRM Pipeline & Quotes (SAL-01 / SAL-02)",
      category: "Navigation",
      icon: <Sparkles className="w-4 h-4 text-lime" />,
      onSelect: () => {
        onNavigate("crm");
        onClose();
      },
    },
    {
      id: "nav-bank",
      title: "Go to Bank & Cash Reconciliation (FIN-04)",
      category: "Navigation",
      icon: <FileSpreadsheet className="w-4 h-4 text-cyan" />,
      onSelect: () => {
        onNavigate("bank");
        onClose();
      },
    },
    {
      id: "nav-import",
      title: "Go to CSV Import Tool",
      category: "Navigation",
      icon: <FileSpreadsheet className="w-4 h-4 text-muted" />,
      onSelect: () => {
        onNavigate("import");
        onClose();
      },
    },
    {
      id: "theme-toggle",
      title: `Switch to ${theme === "light" ? "dark" : "light"} mode`,
      category: "Theme",
      icon: theme === "light" ? <Moon className="w-4 h-4 text-yellow" /> : <Sun className="w-4 h-4 text-yellow" />,
      onSelect: () => {
        toggleTheme();
        onClose();
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, mode, onClose]);

  useEffect(() => {
    if (mode === "ai09") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns, mode]);

  const handleSendChat = (textToSend?: string) => {
    const raw = (textToSend !== undefined ? textToSend : chatInput).trim();
    if (!raw) return;

    const userTurn: ConversationalTurn = {
      id: `turn-u-${Date.now()}`,
      role: "user",
      text: raw,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setChatInput("");

    // Deterministic co-pilot dispatch based on ERP catalog queries
    setTimeout(() => {
      const q = raw.toLowerCase();
      let botResponse: ConversationalTurn;

      if (q.includes("cash") || q.includes("runway") || q.includes("burn") || q.includes("finn")) {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: "Forecast Finn reports current ledger cash is $42,150.00 with a monthly burn of $14,200.00 (14.2 months runway). The 30-day projected cash reaches $48,750.00 and 90-day liquidity is $53,350.00. No cashout risks detected across conservative and expected scenarios.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "Forecast Finn", catalogId: "AIS-02", color: "var(--q-violet)", tier: 1 },
          provenanceRef: "LEDGER-STORE-v1.0 · CALC-FINN-30D",
          actionLink: { label: "Open Forecast Finn River", targetTab: "forecast-finn" },
        };
      } else if (q.includes("overdue") || q.includes("invoice") || q.includes("chloe") || q.includes("receivable")) {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: "Chase Chloe found 3 overdue debtor invoices totaling $8,489.75. Oldest is Delta Dynamics LLC ($3,639.75, 14 days overdue). Reminder drafts are ready for 1-click dispatch.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "Chase Chloe", catalogId: "FIN-14", color: "var(--q-yellow)", tier: 2 },
          provenanceRef: "SAL-04-INVOICE-v1.0",
          actionLink: { label: "Review Overdue Invoices", targetTab: "chase-chloe" },
        };
      } else if (q.includes("stock") || q.includes("reorder") || q.includes("rex") || q.includes("inventory")) {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: "Restock Rex reports 3 items below safety reorder threshold (Aluminum Round Bar, Synthetic Coolant, Hex Bolts) and 1 stockout (Titanium Grade 5 Billet). Draft PO-2026-004 ($3,417.50) is awaiting approval.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "Restock Rex", catalogId: "AGT-04", color: "var(--q-orange)", tier: 3 },
          provenanceRef: "INV-STORE-v1.0 · PO-2026-004",
          actionLink: { label: "View Restock Rex Bins", targetTab: "restock-rex" },
        };
      } else if (q.includes("garment") || q.includes("tech pack") || q.includes("cost") || q.includes("pack") || q.includes("fmcg")) {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: "Industry Pack agents active: GAR08 Style ST-402 cost sheet is READY at $18.45 manufacturing cost ($29.76 wholesale). Style ST-519 is PARTIAL due to missing FIDLOCK buckle rate. FMCG06 reports 2 batches near expiry (Lot LOT-OAT-882A with 14d left, LOT-KMB-410C with 5d left). FMCG12 reports 1 blocking label requirement under EU-1169.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "Industry Pack SDK", catalogId: "TX-01 / DS-01", color: "var(--q-cyan)", tier: 2 },
          provenanceRef: "CFG-FAB-2026-04 · RULE-FMCG06-SL-v2.1",
          actionLink: { label: "Open Industry Packs Hub", targetTab: "packs" },
        };
      } else if (q.includes("approval") || q.includes("dual") || q.includes("kill") || q.includes("audit")) {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: "Approvals Platform has 3 pending proposals under review totaling $7,847.25. Dual-Control enforcement is active (approver != initiator). All 6 registered agent kill switches are operational.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "Approval Agent", catalogId: "PLT-07", color: "var(--q-pink)", tier: 3 },
          provenanceRef: "PLT-07-APPROVALS-v1.0",
          actionLink: { label: "Go to Approvals Inbox", targetTab: "approvals" },
        };
      } else if (q.includes("ocr") || q.includes("scan") || q.includes("receipt") || q.includes("capture") || q.includes("doc")) {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: "Document Intelligence (AI-01 / PLT-11) is active. Precision Supplies Ltd bill (INV-99382 for $3,639.75) is extracted with 99.4% confidence and SHA-256 provenance hash. Open the visual inspector to verify bounding boxes.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "Document Intelligence", catalogId: "AI-01", color: "var(--q-cyan)", tier: 2 },
          provenanceRef: "DOC-EXTRACT-v1.0 · SHA-256:4a8b79...",
          actionLink: { label: "Inspect Bills (FIN-03)", targetTab: "payables" },
        };
      } else {
        botResponse = {
          id: `turn-a-${Date.now()}`,
          role: "assistant",
          text: `AI-09 query received for "${raw}". All Core SaaS records (Sales, Purchases, Ledger, Forecasts, Packs) are indexed and verifiable against contracts/openapi.yaml. Use the quick action button to inspect relevant module.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agentBadge: { name: "AI-09 Co-Pilot", catalogId: "AI-09", color: "var(--q-lime)", tier: 1 },
          provenanceRef: "UAAP-DISPATCHER-v1.0",
          actionLink: { label: "View Dashboard Overview", targetTab: "dashboard" },
        };
      }

      setTurns((prev) => [...prev, botResponse]);
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[620px] bg-panel border-line shadow-card overflow-hidden flex flex-col max-h-[82vh]">
        {/* Top Header Mode Toggle */}
        <div className="flex items-center justify-between border-b-2 border-ink bg-page px-3 py-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="commandbar-tab-actions"
              onClick={() => setMode("commands")}
              className={`px-3 py-1 text-xs font-bold uppercase transition-all ${
                mode === "commands"
                  ? "bg-lime text-ink border border-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "text-muted hover:text-text"
              }`}
            >
              Actions (Ctrl+K)
            </button>
            <button
              type="button"
              data-testid="commandbar-tab-ai09"
              onClick={() => setMode("ai09")}
              className={`px-3 py-1 text-xs font-bold uppercase flex items-center gap-1.5 transition-all ${
                mode === "ai09"
                  ? "bg-pink text-ink border border-ink shadow-[2px_2px_0_var(--q-ink)]"
                  : "text-muted hover:text-text"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI-09 Operations Chat</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="commandbar-close-btn"
            onClick={onClose}
            aria-label="Close command palette"
            className="text-[10px] bg-panel border border-ink px-1.5 py-0.5 text-muted font-mono hover:bg-page hover:text-text cursor-pointer"
          >
            ESC to close
          </button>
        </div>

        {/* MODE 1: COMMAND SEARCH */}
        {mode === "commands" && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b-line bg-page">
              <Search className="w-5 h-5 text-muted" />
              <input
                ref={inputRef}
                type="text"
                data-testid="commandbar-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onClose();
                  }
                }}
                placeholder="Type a command or jump to screen… (or switch to AI-09 Chat)"
                className="w-full bg-transparent border-none outline-none text-sm font-bold text-text placeholder:text-muted"
              />
            </div>

            <div className="max-h-[380px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted font-semibold">
                  No matching actions found for "{query}"
                </div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    data-testid={`command-${item.id}`}
                    onClick={item.onSelect}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-lime hover:text-ink text-left text-xs font-bold transition-colors group cursor-pointer border border-transparent hover:border-ink mb-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 bg-page border border-ink shadow-[1px_1px_0_var(--q-ink)] group-hover:bg-panel">
                        {item.icon}
                      </div>
                      <span>{item.title}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* MODE 2: AI-09 CONVERSATIONAL OPERATIONS */}
        {mode === "ai09" && (
          <div className="flex flex-col flex-1 overflow-hidden" data-testid="commandbar-ai09-panel">
            {/* Chat Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[360px] bg-page/40">
              {turns.map((turn) => {
                const isAssistant = turn.role === "assistant";
                return (
                  <div
                    key={turn.id}
                    className={`flex flex-col ${isAssistant ? "items-start" : "items-end"}`}
                  >
                    {isAssistant && turn.agentBadge && (
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold">
                        <span
                          className="px-1.5 py-0.2 border border-ink text-ink font-mono text-[10px]"
                          style={{ backgroundColor: turn.agentBadge.color }}
                        >
                          {turn.agentBadge.catalogId} · {turn.agentBadge.name}
                        </span>
                        <span className="text-[10px] font-mono text-muted">
                          Tier {turn.agentBadge.tier}
                        </span>
                        <span className="text-[10px] text-muted font-mono">
                          {turn.timestamp}
                        </span>
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] p-3 text-xs leading-relaxed border-line shadow-tile ${
                        isAssistant
                          ? "bg-panel text-text"
                          : "bg-lime text-ink font-semibold ml-auto"
                      }`}
                    >
                      <p>{turn.text}</p>

                      {isAssistant && turn.provenanceRef && (
                        <div className="mt-2 pt-1.5 border-t border-grid flex items-center justify-between text-[10px] text-muted font-mono">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-good" />
                            Provenance: {turn.provenanceRef}
                          </span>
                        </div>
                      )}

                      {isAssistant && turn.actionLink && (
                        <div className="mt-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onNavigate(turn.actionLink!.targetTab);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-page hover:bg-lime hover:text-ink border border-ink transition-colors cursor-pointer"
                          >
                            <span>{turn.actionLink.label}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-3 py-1.5 bg-page border-t border-b border-grid flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-muted font-bold self-center">Ask:</span>
              <button
                type="button"
                onClick={() => handleSendChat("What is our 30-day cash forecast?")}
                className="px-2 py-0.5 bg-panel border border-ink hover:bg-lime hover:text-ink transition-colors cursor-pointer"
              >
                30d Cash Runway
              </button>
              <button
                type="button"
                onClick={() => handleSendChat("Show me overdue debtor invoices")}
                className="px-2 py-0.5 bg-panel border border-ink hover:bg-yellow hover:text-ink transition-colors cursor-pointer"
              >
                Overdue Invoices
              </button>
              <button
                type="button"
                onClick={() => handleSendChat("Check stock levels and low inventory items")}
                className="px-2 py-0.5 bg-panel border border-ink hover:bg-orange hover:text-ink transition-colors cursor-pointer"
              >
                Stock Reorders
              </button>
              <button
                type="button"
                onClick={() => handleSendChat("Summarize Industry Pack costing and shelf life status")}
                className="px-2 py-0.5 bg-panel border border-ink hover:bg-cyan hover:text-ink transition-colors cursor-pointer"
              >
                Packs (GAR &amp; FMCG)
              </button>
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2 p-3 bg-panel"
            >
              <input
                type="text"
                data-testid="ai09-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask AI-09 about figures, drafts, or ledger status…"
                className="flex-1 bg-page px-3 py-2 text-xs font-bold text-text border-line outline-none focus:border-ink placeholder:text-muted"
              />
              <button
                type="submit"
                data-testid="ai09-send-btn"
                className="px-3.5 py-2 bg-pink text-ink font-bold text-xs uppercase border-line shadow-tile hover:brightness-105 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
