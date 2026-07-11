"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { cn } from "@/shared/utils/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  placeholder?: string;
  /** Set the width here (e.g. "w-36"); everything else is locked. */
  className?: string;
  /** "sm" = 32px (beside a SegmentedControl sm), "md" = 36px (page toolbars). */
  size?: "sm" | "md";
  "aria-label"?: string;
}

/**
 * The one filter/sort dropdown in HEGON. The raw Radix `Select` needs its surface, border,
 * hover and focus classes re-declared at every call site — which is exactly why no two
 * dropdowns in the app looked alike. Here the look is locked; the caller only chooses the
 * data and the width.
 */
export function FilterSelect<T extends string>({
  value, onChange, options, placeholder, className, size = "md", ...rest
}: FilterSelectProps<T>) {
  const h = size === "sm" ? "h-8" : "h-9";

  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        aria-label={rest["aria-label"]}
        className={cn(
          h,
          "border-border-subtle bg-surface-2 text-xs text-text-secondary transition-colors",
          "hover:bg-surface-3 hover:text-text-primary focus:ring-0 focus:ring-offset-0",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-border-strong bg-surface-3 text-text-secondary">
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="text-xs focus:bg-surface-2 focus:text-text-primary"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
