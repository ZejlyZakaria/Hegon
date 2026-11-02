"use client";

import { Hint } from "@/shared/components/ui/tooltip";
import type { WatchProviderInfo } from "../../hooks/useWatchProviders";

/** Provider logos belong beneath the personal actions, not in another full card. */
export function WhereToWatch({ providers }: { providers?: WatchProviderInfo | null }) {
  if (!providers?.flatrate.length) return null;
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2">
    <span className="text-xs text-white/55">Where to watch</span>
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Streaming providers">
      {providers.flatrate.map(p => <li key={p.id}><Hint label={`${p.name}${providers.region ? ` (${providers.region})` : ""}`}>
        {providers.link ? <a href={providers.link} target="_blank" rel="noopener noreferrer" aria-label={`Check ${p.name} availability`} className="flex size-11 items-center justify-center rounded-control transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.logo_url ? <img src={p.logo_url} alt="" loading="lazy" className="size-8 rounded-control object-cover"/> : <span className="text-xs text-white">{p.name}</span>}
        </a> : <span className="flex size-11 items-center justify-center" aria-label={p.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="size-8 rounded-control object-cover"/> : <span className="text-xs text-white">{p.name}</span>}
        </span>}
      </Hint></li>)}
    </ul>
  </div>;
}
