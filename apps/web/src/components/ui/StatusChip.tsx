import React from "react";
import { cn } from "../../lib/utils";
import type { StatusType } from "../../types";

export interface StatusChipProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, label, className }) => {
  const configs = {
    good: {
      defaultLabel: "All good",
      icon: "✓",
      styles: "bg-panel text-good border-good",
    },
    watch: {
      defaultLabel: "Worth a look",
      icon: "!",
      styles: "bg-panel text-watch border-watch",
    },
    act: {
      defaultLabel: "Needs you",
      icon: "●",
      styles: "bg-panel text-act border-act",
    },
    idle: {
      defaultLabel: "Waiting for data",
      icon: "…",
      styles: "bg-panel text-idle border-idle",
    },
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border-2 rounded-full select-none",
        configs.styles,
        className
      )}
    >
      <span aria-hidden="true" className="font-mono text-xs">
        {configs.icon}
      </span>
      <span>{label || configs.defaultLabel}</span>
    </span>
  );
};
