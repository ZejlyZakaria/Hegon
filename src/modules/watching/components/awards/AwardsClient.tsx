"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy } from "lucide-react";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { AwardRibbon } from "@/modules/watching/components/shared/Marks";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { useAwardCategories, useAwardWinners, useOwnedTitles } from "@/modules/watching/hooks/useAwards";
import { buildShelf, coverage, foldEntries, indexOwned, ownedFor } from "@/modules/watching/lib/awards";
import { TrophyShelfPanel } from "./TrophyShelfPanel";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import type { AwardCategory, AwardCeremony, AwardEntry, WatchingMedia } from "@/modules/watching/types";

/**
 * THE MUSEUM — `/perso/watching/awards`. Your collection meets the canon.
 *
 * Your trophy shelf → the canon, category by category (decisions.md 2026-09-15; the page header
 * went on the owner's second pass — the shelf IS the opening). Two colours do all the talking:
 * GOLD is the world's verdict (the year tag on a winner), TEAL is yours (your rating). No hero,
 * no statuette, no counters row: the cards already say "12 / 96".
 *
 * The ceremony lives in the URL (`?c=emmys`) so the browser's Back from a category page lands on
 * the ceremony you left, not on the default.
 */

const CEREMONIES: { value: AwardCeremony; label: string }[] = [
  { value: "oscars", label: "Oscars" },
  { value: "emmys", label: "Emmys" },
];

export const posterUrl = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w500${path}` : null);

/**
 * The image a canon entry shows. A portrait category (Best Actor) shows the PERSON — the prize is
 * theirs — and falls back to the poster when TMDB has no photo of them; every other category shows
 * the work, preferring the library's own poster (a custom upload, the owner's pick) when owned.
 */
export function entryImage(e: AwardEntry, o: WatchingMedia | null, portrait: boolean, cssPx: number): string | null {
  const face = portrait ? e.people.find((p) => p.profile_path)?.profile_path ?? null : null;
  if (face) return tmdbImageFor(posterUrl(face), cssPx);
  if (o?.poster_url) return tmdbImageFor(o.poster_url, cssPx) || o.poster_url;
  return tmdbImageFor(posterUrl(e.poster_path), cssPx);
}

export function AwardsClient({ userId }: { userId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const ceremony: AwardCeremony = params.get("c") === "emmys" ? "emmys" : "oscars";
  const setCeremony = (c: AwardCeremony) => router.replace(`/perso/watching/awards?c=${c}`, { scroll: false });
  const [shelfOpen, setShelfOpen] = useState(false);
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
      {/* ── Your trophy shelf — the opening; the ceremony switch sits in its header ── */}
      {loading ? (
        <CarouselSkeleton />
      ) : shelf.length > 0 ? (
        <MediaCarousel
          title="Your trophy shelf"
          subtitle={`${shelf.length} award-winning ${shelf.length === 1 ? "title" : "titles"} you've seen`}
          items={shelf.map((s) => s.owned)}
          actions={<SegmentedControl items={CEREMONIES} value={ceremony} onChange={setCeremony} size="sm" />}
          onSeeAll={() => setShelfOpen(true)}
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
          <SectionHeader
            title="Your trophy shelf"
            subtitle="Award-winning titles you've seen"
            actions={<SegmentedControl items={CEREMONIES} value={ceremony} onChange={setCeremony} size="sm" />}
          />
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

      <TrophyShelfPanel open={shelfOpen} onClose={() => setShelfOpen(false)} shelf={shelf} ceremony={ceremony} />
    </div>
  );
}

/**
 * A category is a LIST the world wrote — so it wears the Lists card (owner, 2026-09-15): same
 * mosaic, same footer, same click. What differs is what the facts differ on: the three most
 * recent winners as the mosaic — in full colour, the mask is the category page's job (owner) —
 * and coverage instead of a count.
 */
function CategoryCard({ category, entries, owned }: { category: AwardCategory; entries: AwardEntry[]; owned: Map<string, WatchingMedia> }) {
  const winners = entries.filter((e) => e.category === category.key && e.won).sort((a, b) => b.year - a.year);
  const { seen, total } = coverage(entries, owned, category.key);
  const pct = total > 0 ? Math.round((seen / total) * 100) : 0;
  // Three DIFFERENT faces or posters: a show that wins five years running (Modern Family, The
  // Pitt) would otherwise fill the whole mosaic with itself.
  const mosaic: AwardEntry[] = [];
  const shown = new Set<string>();
  for (const e of winners) {
    const k = category.portrait ? (e.people.find((p) => p.profile_path)?.name ?? e.key) : `${e.work_type}:${e.work_tmdb_id ?? e.work_title}`;
    if (shown.has(k)) continue;
    shown.add(k); mosaic.push(e);
    if (mosaic.length === 3) break;
  }

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
            const src = entryImage(e, o, category.portrait, 120);
            return (
              <div key={e.key} className="relative flex-1 overflow-hidden">
                {src ? (
                  <Image src={src} alt={e.work_title} fill loading="lazy" className="object-cover object-top" sizes="120px" />
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
