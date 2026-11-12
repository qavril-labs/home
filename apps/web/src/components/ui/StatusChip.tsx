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
      styles: "bg-[#e6f9ed] text-good border-good dark:bg-[#112a1a] dark:text-good",
    },
    watch: {
      defaultLabel: "Worth a look",
      icon: "!",
      styles: "bg-[#fff8e6] text-watch border-watch dark:bg-[#2b220e] dark:text-watch",
    },
    act: {
      defaultLabel: "Needs you",
      icon: "●",
      styles: "bg-[#fdeded] text-act border-act dark:bg-[#331414] dark:text-act",
    },
    idle: {
      defaultLabel: "Waiting for data",
      icon: "…",
      styles: "bg-[#f0edf7] text-idle border-idle dark:bg-[#1a172c] dark:text-idle",
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
