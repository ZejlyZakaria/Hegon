"use client";

import { Eye } from "lucide-react";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";

// Slim, app-wide strip shown only to the read-only demo account.
export function DemoBanner() {
  const isDemo = useIsDemo();
  if (!isDemo) return null;

  return (
    <div
      className="flex shrink-0 items-center justify-center gap-2 border-b border-border-subtle px-4 py-1.5 text-xs text-text-secondary"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-accent-watching) 22%, var(--color-surface-1))" }}
    >
      <Eye size={13} style={{ color: "var(--color-accent-watching-vivid)" }} />
      <span>
        You&apos;re exploring a{" "}
        <strong className="font-semibold text-text-primary">read-only demo</strong>{" "}
        of HEGON — changes aren&apos;t saved.
      </span>
    </div>
  );
}
