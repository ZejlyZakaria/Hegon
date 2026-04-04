"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { FallbackProps } from "react-error-boundary";

export function F1Error({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-100">
            Unable to load F1 data
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            {error instanceof Error ? error.message : "Something went wrong while fetching F1 data. Please try again."}
          </p>
        </div>

        {/* Retry button */}
        <button
          type="button"
          onClick={resetErrorBoundary}
          className={cn(
            "flex items-center gap-2 px-4 h-9 rounded-lg",
            "bg-zinc-800 border border-white/8 text-zinc-100 text-sm font-medium",
            "hover:bg-zinc-700 hover:border-white/12 transition-all"
          )}
        >
          <RefreshCw size={15} />
          <span>Try again</span>
        </button>
      </div>
    </div>
  );
}