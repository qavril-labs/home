import React, { useState, useEffect } from "react";
import { sound } from "../../lib/sound-effects";
import { offlineQueue } from "../../lib/offline-queue";
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Truck,
  Wifi,
} from "lucide-react";

export interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenOfflineDrawer: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  onOpenOfflineDrawer,
}) => {
  const [pendingCount, setPendingCount] = useState<number>(() => offlineQueue.getPendingCount());

  useEffect(() => {
    return offlineQueue.subscribe((q) => {
      setPendingCount(q.filter((a) => a.syncStatus === "pending").length);
    });
  }, []);

  const navItems = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "approvals", label: "Approvals", icon: Sparkles },
    { id: "logistics", label: "Logistics", icon: Truck },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-panel border-t-2 border-ink shadow-[0_-2px_0_var(--q-ink)] flex items-center justify-around h-16 px-2 select-none"
      data-testid="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`mobile-nav-${item.id}`}
            onClick={() => {
              sound.playClick();
              onNavigate(item.id);
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all cursor-pointer ${
              isActive
                ? "text-ink border-t-2 border-lime -mt-[2px] bg-lime/10"
                : "text-muted hover:text-text"
            }`}
          >
            <Icon className={`w-4 h-4 mb-0.5 ${isActive ? "text-lime" : ""}`} />
            <span>{item.label}</span>
          </button>
        );
      })}

      {/* Offline Queue Quick Action */}
      <button
        type="button"
        data-testid="mobile-nav-offline-btn"
        onClick={() => {
          sound.playClick();
          onOpenOfflineDrawer();
        }}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold text-muted hover:text-text relative cursor-pointer"
        title="Offline Queue & Synchronization"
      >
        <div className="relative">
          <Wifi className="w-4 h-4 mb-0.5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-yellow text-ink font-mono font-black text-[9px] border border-ink rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        <span>Offline</span>
      </button>
    </nav>
  );
};
