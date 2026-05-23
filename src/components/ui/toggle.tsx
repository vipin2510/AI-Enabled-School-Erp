"use client";
import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3", disabled && "opacity-60 pointer-events-none")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors",
          checked ? "bg-stone-900" : "bg-stone-300"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
            checked ? "translate-x-5" : "translate-x-0.5",
            "mt-0.5"
          )}
        />
      </button>
      {(label || description) && (
        <div className="leading-tight">
          {label && <div className="text-sm font-medium text-stone-900">{label}</div>}
          {description && <div className="text-xs text-stone-500">{description}</div>}
        </div>
      )}
    </label>
  );
}
