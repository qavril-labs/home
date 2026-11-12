import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  featured?: boolean;
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, subtitle, action, featured = false, hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "neo-card",
          featured ? "neo-card-featured" : "",
          hoverable ? "neo-card-hover" : "",
          className
        )}
        {...props}
      >
        {(title || action || subtitle) && (
          <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-grid">
            <div>
              {title && (
                <h2 className="text-[1.15rem] font-bold font-display uppercase tracking-tight text-text leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-muted mt-1 leading-normal">{subtitle}</p>
              )}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
