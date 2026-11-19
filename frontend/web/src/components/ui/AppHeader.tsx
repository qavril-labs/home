import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "./Button";
import { Moon, Sun, Search, Menu } from "lucide-react";

export interface AppHeaderProps {
  workspaceName?: string;
  activeTab?: string;
  syncStatus?: "connected" | "connecting" | "disconnected";
  onOpenCommandBar?: () => void;
  onSignOut?: () => void;
  onToggleSidebar?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  workspaceName = "Apex Production",
  activeTab = "dashboard",
  syncStatus = "connected",
  onOpenCommandBar,
  onSignOut,
  onToggleSidebar,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 w-full bg-panel border-b-line shadow-sm">
      <div className="w-full px-3 sm:px-6 h-16 flex items-center justify-between min-w-0">
        {/* Left: Mobile Sidebar Toggle + Brand indicator for small viewports */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-cream text-text focus:outline-none shrink-0"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex md:hidden items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="w-7 h-7 rounded-none bg-lime border-line flex items-center justify-center font-display font-black text-ink text-sm shadow-[1.5px_1.5px_0_var(--q-ink)] shrink-0">
              Q
            </span>
            <span className="hidden min-[360px]:inline font-display font-black text-xs sm:text-sm tracking-tight uppercase truncate">
              QAVRIL<span className="text-pink">/</span>LABS
            </span>
          </div>

          {/* Breadcrumb indicator on desktop */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono">
            <span className="text-muted uppercase">Workspace</span>
            <span className="text-muted">/</span>
            <span className="font-bold text-text uppercase tracking-wide">
              {activeTab.replace(/-/g, " ")}
            </span>
          </div>
        </div>

        {/* Right: Search, Workspace Selector, Theme Toggle, Sign Out */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Quick search shortcut trigger */}
          <button
            onClick={onOpenCommandBar}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs font-semibold bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-cream text-muted shrink-0"
            title="Open quick command palette (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-text" />
            <span className="hidden sm:inline text-text">Search actions</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-panel border border-ink text-text font-mono">
              Ctrl+K
            </kbd>
          </button>

          {/* Workspace badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-page border-line shadow-[2px_2px_0_var(--q-ink)]">
            <span className="w-2 h-2 rounded-full bg-good animate-pulse"></span>
            <span className="text-xs font-bold text-text truncate max-w-[130px]">
              {workspaceName}
            </span>
          </div>

          {/* Realtime DB Sync badge */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold border-line shadow-[2px_2px_0_var(--q-ink)] ${
              syncStatus === "connected"
                ? "bg-lime text-ink"
                : syncStatus === "connecting"
                ? "bg-yellow text-ink"
                : "bg-pink text-white"
            }`}
            title={`Database Realtime Sync: ${syncStatus.toUpperCase()}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === "connected"
                  ? "bg-good animate-pulse"
                  : syncStatus === "connecting"
                  ? "bg-watch animate-ping"
                  : "bg-bad"
              }`}
            />
            <span>
              {syncStatus === "connected"
                ? "REALTIME DB SYNC"
                : syncStatus === "connecting"
                ? "CONNECTING DB..."
                : "OFFLINE / RECONNECTING"}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-panel border-line shadow-[2px_2px_0_var(--q-ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--q-ink)] transition-all cursor-pointer shrink-0"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4 text-ink" />
            ) : (
              <Sun className="w-4 h-4 text-yellow" />
            )}
          </button>

          {/* Sign Out (Desktop / Tablet) */}
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
    </header>
  );
};
