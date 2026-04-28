"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { FallbackProps } from "react-error-boundary";

export function WatchingError({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Unable to load watching data
          </h2>
          <p className="text-sm text-text-tertiary leading-relaxed">
            {error instanceof Error ? error.message : "Something went wrong while fetching your media. Please try again."}
          </p>
        </div>

        {/* Retry button */}
        <button
          type="button"
          onClick={resetErrorBoundary}
          className={cn(
            "flex items-center gap-2 px-4 h-9 rounded-lg",
            "bg-surface-2 border border-border-subtle text-text-primary text-sm font-medium",
            "hover:bg-surface-3 hover:border-border-default transition-all"
          )}
        >
          <RefreshCw size={15} />
          <span>Try again</span>
        </button>
      </div>
    </div>
  );
}