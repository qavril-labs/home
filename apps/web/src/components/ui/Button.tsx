import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "lime" | "yellow" | "ghost" | "dark" | "pink" | "violet" | "cyan";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "lime", size = "md", children, ...props }, ref) => {
    const variantStyles = {
      lime: "bg-lime text-ink hover:bg-[#b8f52f]",
      yellow: "bg-yellow text-ink hover:bg-[#ebd039]",
      pink: "bg-pink text-white hover:bg-[#eb4294]",
      violet: "bg-violet text-white hover:bg-[#7b5cf5]",
      cyan: "bg-cyan text-ink hover:bg-[#2bd2e8]",
      dark: "bg-ink text-white hover:bg-[#232136]",
      ghost: "bg-transparent text-text border-line hover:bg-grid",
    }[variant];

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs font-semibold",
      md: "px-5 py-2.5 text-sm font-bold",
      lg: "px-6 py-3.5 text-base font-bold",
    }[size];

    return (
      <button
        ref={ref}
        className={cn("neo-btn", variantStyles, sizeStyles, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
