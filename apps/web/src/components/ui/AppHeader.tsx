import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "./Button";
import { Moon, Sun, Search, Sparkles } from "lucide-react";

export interface AppHeaderProps {
  workspaceName?: string;
  activeTab?: string;
  onNavigate?: (tab: string) => void;
  onOpenCommandBar?: () => void;
  onSignOut?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  workspaceName = "Apex Production",
  activeTab = "dashboard",
  onNavigate,
  onOpenCommandBar,
  onSignOut,
}) => {
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "ledger-lou", label: "Ledger Lou (AGT-03)" },
    { id: "contacts", label: "Contacts (MDM-01)" },
    { id: "items", label: "Items (MDM-02)" },
    { id: "import", label: "CSV Import (PLT-14)" },
    { id: "gallery", label: "Component Gallery" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-panel border-b-line shadow-sm">
      <div className="max-w-[1240px] mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-6">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.("dashboard");
            }}
            className="flex items-center gap-2 group text-text no-underline select-none"
          >
            <span className="w-8 h-8 rounded-none bg-lime border-line flex items-center justify-center font-display font-black text-ink text-lg shadow-[2px_2px_0_var(--q-ink)] group-hover:scale-105 transition-transform">
              Q
            </span>
            <span className="font-display font-extrabold text-lg tracking-tight uppercase">
              QAVRIL<span className="text-pink">/</span>LABS
            </span>
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.(item.id)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-lime text-ink border-2 border-ink shadow-[2px_2px_0_var(--q-ink)] -translate-y-0.5"
                      : "text-text hover:bg-grid border-2 border-transparent"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Search, Workspace Selector, Theme Toggle, Sign Out */}
        <div className="flex items-center gap-2.5">
          {/* Quick search shortcut trigger */}
          <button
            onClick={onOpenCommandBar}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs font-semibold bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-cream text-muted"
            title="Open quick command palette (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-text" />
            <span className="hidden lg:inline text-text">Search actions</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-panel border border-ink text-text font-mono">
              Ctrl+K
            </kbd>
          </button>

          {/* Workspace badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-page border-line shadow-[2px_2px_0_var(--q-ink)]">
            <span className="w-2 h-2 rounded-full bg-good animate-pulse"></span>
            <span className="text-xs font-bold text-text truncate max-w-[130px]">
              {workspaceName}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
            className="w-9 h-9 flex items-center justify-center bg-panel border-line shadow-[2px_2px_0_var(--q-ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--q-ink)] transition-all cursor-pointer"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4 text-ink" />
            ) : (
              <Sun className="w-4 h-4 text-yellow" />
            )}
          </button>

          {/* Sign Out */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="hidden sm:inline-flex"
          >
            Sign out
          </Button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-grid bg-page">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
              activeTab === item.id
                ? "bg-lime text-ink border border-ink shadow-[1px_1px_0_var(--q-ink)]"
                : "text-muted hover:text-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
