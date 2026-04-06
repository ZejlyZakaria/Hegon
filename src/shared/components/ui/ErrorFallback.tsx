"use client";

import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-1 h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={22} className="text-red-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">Something went wrong</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            {error.message || "An unexpected error occurred. Try again or go back home."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 h-9 rounded-lg bg-zinc-800 border border-white/8 text-zinc-100 text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw size={14} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 h-9 rounded-lg border border-zinc-800 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            <Home size={14} />
            Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="text-[11px] text-zinc-600 font-mono">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
