"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";

export interface SearchInputProps extends React.ComponentProps<"input"> {
  /** Width / positioning of the wrapper (e.g. "w-48", "flex-1"). */
  containerClassName?: string;
  /** When provided, a clear (✕) button appears while the field has a value. */
  onClear?: () => void;
}

/**
 * The one canonical search field for the whole app. Same look everywhere:
 * leading Search icon, tokenised field surface, uniform hover (surface-2),
 * focus = border shift (no glow), optional clear button. Width is set by the
 * caller via `containerClassName`; everything else is locked for consistency.
 */
export function SearchInput({
  className,
  containerClassName,
  onClear,
  value,
  ...props
}: SearchInputProps) {
  const hasValue = value != null && value !== "";

  return (
    <div className={cn("relative flex items-center", containerClassName)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 text-text-tertiary"
      />
      <input
        type="text"
        data-slot="search-input"
        value={value}
        className={cn(
          "h-9 w-full rounded-control border border-border-default bg-surface-2 py-0 pl-8 text-sm",
          onClear ? "pr-8" : "pr-3",
          "text-text-primary placeholder:text-text-tertiary",
          "transition-[background-color,border-color] duration-150 ease-out",
          "hover:bg-surface-3 focus:border-border-focus focus:outline-none",
          className,
        )}
        {...props}
      />
      {onClear && hasValue && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 flex text-text-tertiary transition-colors duration-150 ease-out hover:text-text-secondary"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
