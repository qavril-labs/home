import React from "react";
import { cn } from "../../lib/utils";

/**
 * A figure tile. It shows the text the API sent, without animating it: KpiTile counts up with floating-point
 * arithmetic, which is not allowed for money (UI contract, section 5).
 */
export const StatTile: React.FC<{
  label: string;
  value: string;
  helper?: string;
  tone?: "panel" | "lime" | "pink" | "yellow";
}> = ({ label, value, helper, tone = "panel" }) => (
  <div
    className={cn(
      "border-line shadow-sm p-4 flex flex-col gap-1",
      tone === "lime" && "bg-lime text-ink",
      tone === "pink" && "bg-pink text-ink",
      tone === "yellow" && "bg-yellow text-ink",
      tone === "panel" && "bg-panel text-text",
    )}
  >
    <span className="text-[11px] font-black uppercase">{label}</span>
    <span className="font-display font-black text-2xl">{value}</span>
    {helper ? <span className="text-xs font-bold opacity-80">{helper}</span> : null}
  </div>
);
