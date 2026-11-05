"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import type { WatchingUpdate } from "../../lib/updates";
import { tmdbImageFor, tmdbImageSrcSet } from "../../lib/tmdb-image";
import { MediaCarousel } from "../shared/MediaCarousel";

function AvailableCard({ update, busy, onOpen, orientation = "backdrop" }: { update: WatchingUpdate; busy: boolean; onOpen: () => void; orientation?: "poster" | "backdrop" }) {
  const continuing = update.media.in_progress && !update.media.paused && !update.media.dropped && !update.media.resume_required;
  const action = continuing ? "Continue watching" : "Resume watching";
  const Icon = continuing ? Play : RotateCcw;
  const availability = update.fullSeason ? update.scope.includes("Part") ? "Full part available" : "Full season available" : update.episodes === 1 ? `EP${update.episodeFrom} available` : `${update.episodes} episodes available`;
  const backdrop = update.media.backdrop_url;
  const poster = orientation === "poster";
  const raw = poster ? update.poster || backdrop : backdrop || update.poster;
  const src = raw?.startsWith("/") ? `https://image.tmdb.org/t/p/w780${raw}` : raw;
  return <article className="group relative min-w-0 origin-bottom transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04]">
    <div className={`relative overflow-hidden bg-surface-2 ${poster ? "aspect-2/3 rounded-tile" : "aspect-video rounded-card"}`}>
      <picture><source srcSet={tmdbImageSrcSet(src, poster ? 170 : 360, poster ? 500 : 1280)} /><Image src={tmdbImageFor(src, poster ? 170 : 360) || "/placeholder.svg"} alt="" fill loading="lazy" sizes={poster ? "42vw" : "20vw"} className={poster || backdrop ? "object-cover" : "object-contain"} /></picture>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-black/95 via-black/60 to-transparent" />
      <Link href={`/perso/watching/${update.media.id}`} aria-label={`View ${update.media.title} · ${update.scope}`} className={`absolute inset-0 ${poster ? "rounded-tile" : "rounded-card"} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-watching-vivid`} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-white">{update.media.title}</h3>
        <p className="text-xs text-white/85">{update.scope}</p>
        <p className="text-caption font-medium text-accent-watching-vivid">{availability}</p>
        {!update.media.want_to_watch && <Button className="pointer-events-auto relative mt-1 max-w-full gap-1 px-2 text-caption [&_svg]:size-3" size="sm" variant="subtle" disabled={busy} onClick={onOpen} aria-label={`${action} ${update.media.title}`}><Icon />{busy ? "Opening…" : action}</Button>}
      </div>
    </div>
  </article>;
}

export function AvailableUpdates({ updates, resuming, onOpen, actions }: { updates: WatchingUpdate[]; resuming: string | null; onOpen: (update: WatchingUpdate) => void; actions?: ReactNode }) {
  const [all, setAll] = useState(false);
  if (!updates.length) return null;
  return <>
    <MediaCarousel title="Available now" subtitle="Recent releases in the stories you follow." items={updates} getItemKey={update => update.id} actions={actions} onSeeAll={updates.length > 5 ? () => setAll(true) : undefined}
      renderItem={(update, orientation) => <AvailableCard update={update} orientation={orientation} busy={resuming === update.media.id} onOpen={() => onOpen(update)} />} />
    <SlidingPanel open={all} onClose={() => setAll(false)} title="Available now" width="gallery"><div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-2">{updates.map(update => <AvailableCard key={update.id} update={update} busy={resuming === update.media.id} onOpen={() => { setAll(false); onOpen(update); }} />)}</div></SlidingPanel>
  </>;
}
