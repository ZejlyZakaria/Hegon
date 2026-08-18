/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Check, ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useTeamArtwork, useSetTeamFanart } from "../../hooks/useTeamArtwork";

// The team backdrop picker — the backdrops-only twin of Watching's ImageGallery. No poster tab (a
// club has a crest, not a poster) and no upload; just the fanart/banner TheSportsDB offers, one of
// which becomes the hero backdrop. Same grammar: teal→lime "Current" ring, click to set, spinner
// while it writes.
export function TeamArtworkGallery({ externalId }: { externalId: string }) {
  const { data, isLoading } = useTeamArtwork(externalId, true);
  const setFanart = useSetTeamFanart(externalId);
  const [pending, setPending] = useState<string | null>(null);

  const backdrops = data?.backdrops ?? [];
  const current = data?.current ?? null;

  const choose = async (url: string) => {
    if (url === current) return;
    setPending(url);
    try {
      await setFanart.mutateAsync(url);
      toast("Backdrop updated.");
    } catch (err) {
      if (!isDemoReadOnlyError(err)) toast.error("Failed to update.");
    } finally {
      setPending(null);
    }
  };

  const gridClass = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]";

  if (isLoading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-video w-full animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    );
  }

  if (backdrops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <ImageOff size={28} className="text-text-tertiary" />
        <p className="text-sm text-text-secondary">TheSportsDB has no backdrops for this club.</p>
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {backdrops.map((b) => {
        const isCurrent = b.url === current;
        const isPending = pending === b.url;
        return (
          <button
            key={b.url}
            type="button"
            onClick={() => choose(b.url)}
            aria-label={isCurrent ? "Current backdrop" : "Set as backdrop"}
            className={cn(
              "group relative aspect-video w-full overflow-hidden rounded-card border transition-transform duration-300 ease-out",
              isCurrent
                ? "cursor-default border-transparent ring-2 ring-accent-sports"
                : "border-border-subtle hover:z-10 hover:scale-[1.03]",
            )}
          >
            <img src={b.url} alt={b.label} loading="lazy" className="h-full w-full object-cover" />

            {isCurrent && (
              <span className="on-artwork absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full">
                <Check size={13} className="text-accent-sports" />
              </span>
            )}

            {!isCurrent && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <span className="mb-2 text-micro font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                  {isPending ? "Setting…" : "Set as backdrop"}
                </span>
              </div>
            )}

            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 size={18} className="animate-spin text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
