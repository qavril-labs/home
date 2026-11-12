import React, { useState, useEffect, useRef } from "react";
import { Search, ArrowRight, Sun, Moon, Plus, FileSpreadsheet, Users, Package, LayoutDashboard, Bot } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

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
}

export const CommandBar: React.FC<CommandBarProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenQuickEntry,
  onOpenContactDrawer,
  onOpenItemDrawer,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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
      title: "Go to Products & Items",
      category: "Navigation",
      icon: <Package className="w-4 h-4 text-muted" />,
      onSelect: () => {
        onNavigate("items");
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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] bg-panel border-line shadow-card overflow-hidden">
        {/* Input box */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-line bg-page">
          <Search className="w-5 h-5 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search actions… (Escape to close)"
            className="w-full bg-transparent border-none outline-none text-sm font-bold text-text placeholder:text-muted"
          />
          <kbd className="text-[10px] bg-panel border border-ink px-1.5 py-0.5 text-muted font-mono">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted font-semibold">
              No matching actions found for "{query}"
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
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
      </div>
    </div>
  );
};
