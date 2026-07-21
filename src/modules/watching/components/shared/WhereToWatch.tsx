"use client";

import { Hint } from "@/shared/components/ui/tooltip";
import type { WatchProviderInfo } from "../../hooks/useWatchProviders";

/**
 * Where you can actually watch this — a quiet, separated strip.
 *
 * Extracted from the StatusCard because the discover page needs the SAME thing, and the discover
 * page is precisely where it matters most: on a title you already own the question is "where did I
 * leave off", but on one you don't, "can I even watch this tonight?" is half the decision. It was
 * missing there, which is the wrong way round.
 *
 * Extracted rather than copied. This module's signature bug is two copies of one rule drifting
 * apart; a second hand-written provider strip would have been the next instance.
 */
export function WhereToWatch({ providers }: { providers?: WatchProviderInfo | null }) {
  if (!providers || providers.flatrate.length === 0) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="text-caption uppercase tracking-wide text-white/45">Where to watch</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {providers.flatrate.slice(0, 6).map((p) =>
          p.logo_url ? (
            <Hint key={p.id} label={p.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.logo_url}
                alt={p.name}
                className="h-8 w-8 rounded-control object-cover ring-1 ring-white/15"
              />
            </Hint>
          ) : null,
        )}
      </div>
    </div>
  );
}
