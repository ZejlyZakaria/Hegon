"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { cn } from "@/shared/utils/utils";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { AwardRibbon } from "@/modules/watching/components/shared/Marks";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { useAwardCategories, useAwardWinners, useOwnedTitles } from "@/modules/watching/hooks/useAwards";
import { buildShelf, coverage, foldEntries, indexOwned, isSeen, ownedFor } from "@/modules/watching/lib/awards";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import type { AwardCategory, AwardCeremony, AwardEntry, WatchingMedia } from "@/modules/watching/types";

/**
 * THE MUSEUM — `/perso/watching/awards`. Your collection meets the canon.
 *
 * Header → your trophy shelf → the canon, category by category (decisions.md 2026-09-15).
 * Two colours do all the talking: GOLD is the world's verdict (the year ribbon on a winner),
 * TEAL is yours (your rating). A title you have finished is in full colour; one you haven't is
 * dimmed. No hero, no statuette, no counters row: the cards already say "12 / 96".
 */

const CEREMONIES: { value: AwardCeremony; label: string }[] = [
  { value: "oscars", label: "Oscars" },
  { value: "emmys", label: "Emmys" },
];

export const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w500${path}` : null);

export function AwardsClient({ userId }: { userId: string }) {
  const [ceremony, setCeremony] = useState<AwardCeremony>("oscars");
  const categoriesQ = useAwardCategories();
  const winnersQ = useAwardWinners(ceremony);
  const ownedQ = useOwnedTitles(userId);

  const categories = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.ceremony === ceremony).sort((a, b) => a.rank - b.rank),
    [categoriesQ.data, ceremony],
  );
  const entries = useMemo(() => foldEntries(winnersQ.data ?? []), [winnersQ.data]);
  const owned = useMemo(() => indexOwned(ownedQ.data ?? []), [ownedQ.data]);
  const shelf = useMemo(() => buildShelf(entries, owned, categories), [entries, owned, categories]);
  const shelfById = useMemo(() => new Map(shelf.map((s) => [s.owned.id, s])), [shelf]);

  const loading = categoriesQ.isLoading || winnersQ.isLoading || ownedQ.isLoading;

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption uppercase text-text-tertiary">Museum</p>
          <h1 className="mt-1 text-xl font-bold text-text-primary">Awards</h1>
          <p className="mt-1 text-xs text-text-tertiary">Your collection meets the canon.</p>
        </div>
        <SegmentedControl items={CEREMONIES} value={ceremony} onChange={setCeremony} size="sm" />
      </div>

      {/* ── Your trophy shelf ── */}
      {loading ? (
        <CarouselSkeleton />
      ) : shelf.length > 0 ? (
        <MediaCarousel
          title="Your trophy shelf"
          subtitle={`${shelf.length} award-winning ${shelf.length === 1 ? "title" : "titles"} you've finished`}
          items={shelf.map((s) => s.owned)}
          mark={(item) => {
            const s = shelfById.get(item.id);
            return s ? <AwardRibbon year={s.entry.year} size="card" /> : null;
          }}
          meta={(item) => {
            const s = shelfById.get(item.id);
            if (!s) return null;
            return (
              <span className="min-w-0 truncate text-xs text-text-secondary" title={s.labels.join(" · ")}>
                {s.labels[0]}
                {s.more > 0 && <span className="text-text-tertiary"> · +{s.more}</span>}
              </span>
            );
          }}
        />
      ) : (
        <section>
          <SectionHeader title="Your trophy shelf" subtitle="Award-winning titles you've finished" />
          <div className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface-1 px-4 py-5">
            <Trophy size={16} className="shrink-0 text-text-tertiary" />
            <p className="text-xs text-text-secondary">Nothing on the shelf yet — finish a winner below and it takes its place here.</p>
          </div>
        </section>
      )}

      {/* ── The canon, category by category ── */}
      <section>
        <SectionHeader title="Categories" subtitle="The canon, category by category — what you've seen, and what's left" />
        {loading ? (
          <CategoriesSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <CategoryCard key={c.key} category={c} entries={entries} owned={owned} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * A category is a LIST the world wrote — so it wears the Lists card (owner, 2026-09-15): same
 * mosaic, same footer, same click. What differs is what the facts differ on: the three most
 * recent winners as the mosaic (yours lit, the rest dimmed), and coverage instead of a count.
 */
function CategoryCard({ category, entries, owned }: { category: AwardCategory; entries: AwardEntry[]; owned: Map<string, WatchingMedia> }) {
  const winners = entries.filter((e) => e.category === category.key && e.won).sort((a, b) => b.year - a.year);
  const { seen, total } = coverage(entries, owned, category.key);
  const pct = total > 0 ? Math.round((seen / total) * 100) : 0;
  const mosaic = winners.slice(0, 3);

  return (
    <Link
      href={`/perso/watching/awards/${category.key}`}
      className="group relative block overflow-hidden rounded-card border border-border-subtle bg-surface-1 transition-colors hover:bg-surface-2"
    >
      <div className="relative flex h-42 gap-0.5 overflow-hidden bg-black">
        {mosaic.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center opacity-15">
            <Trophy size={36} />
          </div>
        ) : (
          mosaic.map((e) => {
            const o = ownedFor(owned, e);
            const src = o?.poster_url ? tmdbImageFor(o.poster_url, 120) : posterUrl(e.poster_path) ? tmdbImageFor(posterUrl(e.poster_path), 120) : null;
            return (
              <div key={e.key} className={cn("relative flex-1 overflow-hidden", !isSeen(o) && "opacity-50")}>
                {src ? (
                  <Image src={src} alt={e.work_title} fill loading="lazy" className="object-cover" sizes="120px" />
                ) : (
                  <div className="h-full w-full bg-zinc-900" />
                )}
              </div>
            );
          })
        )}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/50" />
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-semibold text-text-primary">{category.label}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-text-tertiary">
            <span className="font-medium text-text-secondary">{seen}</span> / {total} watched
          </span>
          <span className="text-micro tabular-nums text-text-tertiary/60">{pct}%</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent-watching-vivid" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-card border border-border-subtle bg-surface-1">
          <div className="flex h-42 gap-0.5 bg-black">
            {[0, 1, 2].map((j) => <div key={j} className="flex-1 bg-surface-2" />)}
          </div>
          <div className="p-3">
            <div className="h-3.5 w-24 rounded bg-surface-2" />
            <div className="mt-2 h-2.5 w-20 rounded bg-surface-2" />
            <div className="mt-2 h-1 w-full rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
