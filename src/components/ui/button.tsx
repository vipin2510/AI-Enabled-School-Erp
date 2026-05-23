"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => {
  const styles: Record<Variant, string> = {
    primary:   "bg-stone-900 text-stone-50 hover:bg-stone-800",
    secondary: "bg-stone-100 text-stone-900 hover:bg-stone-200 border border-stone-200",
    ghost:     "text-stone-700 hover:bg-stone-100",
    danger:    "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        styles[variant],
        className
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";
