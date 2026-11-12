import React, { useEffect, useState, useRef } from "react";
import { cn } from "../../lib/utils";
import { formatMoney } from "../../lib/currency";

export interface KpiTileProps {
  label: string;
  value: string; // Decimal string from API, e.g. "42150.00"
  variant?: "lime" | "yellow" | "panel" | "cyan" | "pink";
  currencySymbol?: string;
  helperText?: string;
  className?: string;
}

export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  variant = "panel",
  currencySymbol = "$",
  helperText,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const targetNum = parseFloat(value || "0") || 0;
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayValue(targetNum);
      prevTargetRef.current = targetNum;
      return;
    }

    const start = prevTargetRef.current;
    const end = targetNum;
    const duration = 600; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevTargetRef.current = end;
      }
    };

    const handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, [value, targetNum]);

  const bgStyles = {
    panel: "bg-panel text-text",
    lime: "bg-lime text-ink",
    yellow: "bg-yellow text-ink",
    cyan: "bg-cyan text-ink",
    pink: "bg-pink text-white",
  }[variant];

  return (
    <div
      className={cn(
        "neo-card flex flex-col justify-between p-4 transition-transform hover:-translate-y-0.5",
        bgStyles,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted opacity-90">
          {label}
        </span>
      </div>

      <div className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight leading-none my-1">
        {formatMoney(displayValue, currencySymbol)}
      </div>

      {helperText && (
        <p className="text-[11px] text-muted opacity-80 mt-1 font-medium leading-tight">
          {helperText}
        </p>
      )}
    </div>
  );
};
