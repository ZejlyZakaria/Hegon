"use client";

import Link from "next/link";
import Image from "next/image";
import { Gem, Star, Trophy } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { SectionHeader } from "@/shared/components/ui/section-header";

const AMBER = "#fbbf24";

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
  rank: { position: number; noun: string; tiedWith: string[] } | null;
  best: InsightTitle | null;       // your highest-rated title with them
  hiddenGem: InsightTitle | null;  // where you and the world disagree most, in your favour
}

// A title cell — same shape as the Stats "Top Picks" cell, half-width so #1 and the gem
// sit side by side and neither leaves a hole.
function TitleCell({ label, icon, t }: { label: string; icon: React.ReactNode; t: InsightTitle }) {
  return (
    <Link href={`/perso/watching/${t.id}`} className="group min-w-0 rounded-control p-2 transition-colors hover:bg-surface-2">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
        {icon} {label}
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <div className="relative aspect-2/3 w-(--poster-xs) shrink-0 overflow-hidden rounded-md bg-surface-2 ring-1 ring-border-subtle">
          {t.poster_url && (
            <Image src={t.poster_url} alt="" fill unoptimized loading="lazy" sizes="36px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-text-primary transition-colors group-hover:text-accent-watching-vivid">
            {t.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums text-amber-300">
              <Star size={9} style={{ color: AMBER, fill: AMBER }} /> {t.rating}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-text-tertiary">
              {t.metaLogo && (
                <Image src={t.metaLogo} alt="TMDB" width={22} height={9} className="h-2.25 w-auto opacity-70" />
              )}
              <span className="truncate tabular-nums">{t.meta}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Where this person sits in YOUR library, and the two titles that define your relationship
// with them. No invented score, no opaque weights.
export function PersonInsights({ data, firstName }: { data: PersonInsightsData; firstName: string }) {
  const { rank, best, hiddenGem } = data;
  if (!rank && !best && !hiddenGem) return null;

  const tie = rank?.tiedWith ?? [];
  const tieLine =
    tie.length === 0
      ? "across your whole library"
      : `Tied with ${tie[0]}${tie.length > 1 ? ` and ${tie.length - 1} more` : ""}`;

  return (
    <section>
      <SectionHeader title={`Your ${firstName}`} />
      <div className="surface-quiet rounded-card p-4">
        {rank && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-watching/25 ring-1 ring-accent-watching-vivid/25">
              <Trophy size={15} className="text-accent-watching-vivid" />
            </div>
            <p className="min-w-0 text-xs leading-relaxed text-text-secondary">
              Your{" "}
              <span className="text-sm font-bold tabular-nums text-text-primary">#{rank.position}</span>{" "}
              most-watched {rank.noun}
              <span className="block truncate text-[11px] text-text-tertiary">{tieLine}</span>
            </p>
          </div>
        )}

        {rank && (best || hiddenGem) && <div className="my-3 h-px bg-border-subtle" />}

        {(best || hiddenGem) && (
          <div className={cn("-mx-2 grid gap-1", best && hiddenGem ? "grid-cols-2" : "grid-cols-1")}>
            {best && (
              <TitleCell label="Your #1" icon={<Trophy size={10} className="text-amber-300" />} t={best} />
            )}
            {hiddenGem && (
              <TitleCell label="Hidden gem" icon={<Gem size={10} className="text-accent-watching-vivid" />} t={hiddenGem} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
