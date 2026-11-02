"use client";

import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/shared/components/ui/panel";
import { ScoreMark } from "../shared/Marks";
import { tmdbImageFor, tmdbImageSrcSet } from "../../lib/tmdb-image";

export interface InsightTitle {
  id: string;
  title: string;
  poster_url: string | null;
  rating: number;
  meta: string;          // the year (for #1) or the TMDB score (for the gem)
  metaLogo?: string;     // shown before `meta` — names the source instead of saying "World"
}

export interface PersonInsightsData {
  // "Your #3 most-watched actor" — null when you've seen too few for it to mean anything.
  // `count` is the number the rank is built from, shown so a shared rank is verifiable.
  rank: { position: number; noun: string; count: number; tiedWith: string[] } | null;
  best: InsightTitle | null;       // your highest-rated title with them
  hiddenGem: InsightTitle | null;  // where you and the world disagree most, in your favour
}

/** Full-width highlights use the existing80px poster rung, not half-width40px cells. */
function TitleHighlight({ label, title, world }: { label: string; title: InsightTitle; world?: InsightTitle | null }) {
  return <Link href={`/perso/watching/${title.id}`} aria-label={`Open ${title.title}`} className="group -mx-2 flex min-w-0 items-center gap-3 rounded-control p-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent-watching-vivid">
    <div className="relative aspect-2/3 w-(--poster-sm) shrink-0 overflow-hidden rounded-tile bg-surface-2 ring-1 ring-border-subtle">
      <picture>
        {title.poster_url && <source srcSet={tmdbImageSrcSet(title.poster_url,80,500)} />}
        <Image src={tmdbImageFor(title.poster_url,80) ?? "/placeholder.svg"} alt="" fill loading="lazy" sizes="80px" className="object-cover" />
      </picture>
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-micro font-medium leading-snug text-text-tertiary">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent-watching-vivid">{title.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-label">
        <ScoreMark value={title.rating} source="mine" />
        {!title.metaLogo && title.meta && <span className="text-text-tertiary">{title.meta}</span>}
      </div>
      {world?.meta && <p className="mt-1 flex items-center gap-1.5 text-micro text-text-tertiary">
        {world.metaLogo ? <Image src={world.metaLogo} alt="TMDB" width={22} height={9} className="h-2.25 w-auto" /> : <span>TMDB</span>}
        <span>{world.meta}</span>
      </p>}
    </div>
  </Link>;
}

export function PersonInsights({ data }: { data: PersonInsightsData }) {
  const { rank, best, hiddenGem } = data;
  if (!rank && !best && !hiddenGem) return null;
  const same = best && hiddenGem && best.id === hiddenGem.id;
  const tie = rank?.tiedWith ?? [];
  return <Panel title="Your highlights">
    {rank && <div className="flex items-center gap-3 pb-3">
      <span className="shrink-0 text-3xl font-semibold tracking-tight tabular-nums text-accent-watching-vivid">#{rank.position}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-primary">Most-watched {rank.noun}</p>
        <p className="mt-1 text-micro leading-relaxed text-text-tertiary">{rank.count} {rank.count === 1 ? "title" : "titles"} · Across your library</p>
        {tie.length > 0 && <p className="mt-1 text-micro leading-relaxed text-text-tertiary">Tied with {tie[0]}{tie.length > 1 ? ` and ${tie.length - 1} more` : ""}</p>}
      </div>
    </div>}
    {(best || hiddenGem) && <div className="space-y-2">
      {best && <TitleHighlight label={same ? "Highest rated · Hidden gem" : "Highest rated"} title={best} world={same ? hiddenGem : null} />}
      {hiddenGem && !same && <TitleHighlight label="Hidden gem" title={hiddenGem} world={hiddenGem} />}
    </div>}
  </Panel>;
}
