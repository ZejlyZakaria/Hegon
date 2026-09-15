"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Eye, EyeOff, LayoutGrid, Plus } from "lucide-react";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/utils/utils";
import { AwardRibbon, ScoreMark, OVERLAY_CLUSTER, OVERLAY_CIRCLE } from "@/modules/watching/components/shared/Marks";
import { useAwardCategories, useAwardCategoryRows, useOwnedTitles } from "@/modules/watching/hooks/useAwards";
import { canonStatus, foldEntries, indexOwned, isSeen, ownedFor, type CanonBucket } from "@/modules/watching/lib/awards";
import { displayTitle } from "@/modules/watching/utils";
import type { AwardEntry, WatchingMedia } from "@/modules/watching/types";
import { entryImage } from "./AwardsClient";

/**
 * ONE CATEGORY, EVERY YEAR — `/perso/watching/awards/[category]`. The grid of `ListDetail`, because
 * a category is a list the world wrote: the same columns as the Library, most recent first, the
 * gold year ribbon on every winner, your rating under what you've finished, and a "+" on what you
 * haven't (it hands you to the discover page, where the add lives).
 */

type Scope = "winners" | "all";
const SCOPES: { value: Scope; label: string }[] = [
  { value: "winners", label: "Winners" },
  { value: "all", label: "Winners & nominees" },
];
type Bucket = "all" | CanonBucket;
const BUCKETS: { value: Bucket; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <LayoutGrid size={13} /> },
  { value: "watched", label: "Watched", icon: <Eye size={13} /> },
  { value: "want", label: "Want to Watch", icon: <Bookmark size={13} /> },
  { value: "unwatched", label: "Unwatched", icon: <EyeOff size={13} /> },
];

export function AwardCategoryClient({ userId, categoryKey }: { userId: string; categoryKey: string }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("winners");
  const [bucket, setBucket] = useState<Bucket>("all");
  const categoriesQ = useAwardCategories();
  const category = categoriesQ.data?.find((c) => c.key === categoryKey) ?? null;
  const rowsQ = useAwardCategoryRows(category?.ceremony ?? "oscars", category ? category.key : "");
  const ownedQ = useOwnedTitles(userId);

  const owned = useMemo(() => indexOwned(ownedQ.data ?? []), [ownedQ.data]);
  const entries = useMemo(() => {
    const all = foldEntries(rowsQ.data ?? []).sort((a, b) => b.year - a.year || Number(b.won) - Number(a.won));
    const inScope = scope === "winners" ? all.filter((e) => e.won) : all;
    return bucket === "all" ? inScope : inScope.filter((e) => canonStatus(ownedFor(owned, e)).bucket === bucket);
  }, [rowsQ.data, scope, bucket, owned]);
  const winners = useMemo(() => foldEntries(rowsQ.data ?? []).filter((e) => e.won), [rowsQ.data]);
  const seen = winners.filter((e) => isSeen(ownedFor(owned, e))).length;

  const loading = categoriesQ.isLoading || rowsQ.isLoading || ownedQ.isLoading;

  return (
    <div className="flex flex-col">
      {/* ── Contextual topbar — the list detail's, verbatim ── */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-zinc-950 px-4 py-3 sm:px-6">
        <button
          type="button"
          // Back to the ceremony you came from — the Awards page reads it from the URL.
          onClick={() => router.push(`/perso/watching/awards?c=${category?.ceremony ?? "oscars"}`)}
          className="flex shrink-0 items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Back to Awards</span>
          <span className="sm:hidden">Back</span>
        </button>
        <div className="flex-1" />
        {/* Two axes: what the canon says (winners / nominees) and what your library says. */}
        <SegmentedControl items={BUCKETS} value={bucket} onChange={setBucket} size="sm" responsiveLabels />
        <SegmentedControl items={SCOPES} value={scope} onChange={setScope} size="sm" />
      </div>

      <div className="px-4 pt-5 sm:px-6">
        <p className="text-caption uppercase text-text-tertiary">{category?.ceremony === "emmys" ? "Emmys" : "Oscars"}</p>
        <h1 className="mt-1 text-xl font-bold text-text-primary">{category?.label ?? "…"}</h1>
        {!loading && (
          <p className="mt-1 text-xs tabular-nums text-text-tertiary">
            <span className="font-medium text-text-secondary">{seen}</span> of {winners.length} winners watched
            {category?.since ? ` · since ${category.since}` : ""}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 sm:p-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-2/3 rounded-tile bg-surface-2" />
              <div className="mt-2 h-3 w-3/4 rounded bg-surface-2" />
              <div className="mt-1.5 h-2.5 w-1/2 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        // Wikidata is thin on the Emmys — and a category can also miss a sync run. Say so.
        <p className="px-4 py-8 text-xs text-text-tertiary sm:px-6">
          Nothing here yet — Wikidata has no {scope === "winners" ? "winners" : "entries"} for this category, or the last sync missed it.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 sm:p-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {entries.map((e) => (
            <CanonTile key={e.key} entry={e} owned={ownedFor(owned, e)} showPeople={category?.subject === "person"} portrait={!!category?.portrait} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A title of the canon. Every poster in full colour — the mask is on the TAG, not the artwork
 * (owner, 2026-09-15): a winner wears the year tag, gold when you have seen it, dark grey when
 * not; a nominee wears nothing (the year sits in its meta line). Under the poster: the title,
 * then the library's word for it (Watched / Want to Watch / Unwatched…) in the list detail's
 * dot-and-label, and your rating when you have one. Not yours yet → a "+".
 *
 * PORTRAIT categories (owner, 2026-09-15): the prize is the person's, so the tile shows their
 * face and their name, and the film moves to the meta line. The STATE stays the film's — seen or
 * not, your rating — because the film is what the library knows; a dimmed face reads "you haven't
 * seen this performance", which is exactly true. Two doors: the portrait opens the person, the
 * film line opens the film.
 */
function CanonTile({ entry, owned, showPeople, portrait }: { entry: AwardEntry; owned: WatchingMedia | null; showPeople: boolean; portrait: boolean }) {
  const router = useRouter();
  const seen = isSeen(owned);
  const status = canonStatus(owned);
  // The first credited person who HAS a photo — the same pick entryImage makes.
  const person = portrait ? entry.people.find((p) => p.profile_path) ?? entry.people[0] ?? null : null;
  const hasFace = !!person?.profile_path;
  const src = entryImage(entry, owned, portrait, 200);
  const discover = `/perso/watching/discover/${entry.work_type === "film" ? "film" : "serie"}/${entry.work_tmdb_id}`;
  const filmHref = owned ? `/perso/watching/${owned.id}` : discover;
  const open = () => router.push(hasFace && person?.tmdb_id ? `/perso/watching/person/${person.tmdb_id}` : filmHref);

  return (
    <div className="group relative">
      <div className="relative cursor-pointer" onClick={open}>
        <div className={cn(
          "relative aspect-2/3 overflow-hidden rounded-tile bg-zinc-800 transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]",
        )}>
          {src ? (
            <Image
              src={src}
              alt={hasFace ? person!.name : entry.work_title}
              fill
              loading="lazy"
              // The filter sits on the IMAGE, not the tile: the gold tag above it stays gold.
              className="object-cover object-top"
              sizes="(max-width: 768px) 33vw, 200px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-micro text-text-tertiary">{entry.work_title}</div>
          )}
          {entry.won && <AwardRibbon year={entry.year} tone={seen ? "won" : "dim"} size="tile" />}
        </div>
        {hasFace ? (
          <>
            <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-secondary">{person!.name}</p>
            {/* The film is its own door — a real link, so it opens the fiche and not the person. */}
            <Link
              href={filmHref}
              onClick={(ev) => ev.stopPropagation()}
              className="mt-0.5 block truncate text-micro text-text-tertiary transition-colors hover:text-text-primary"
            >
              {owned ? displayTitle(owned) : entry.work_title}{!entry.won ? ` · Nominee ${entry.year}` : entry.work_year ? ` · ${entry.work_year}` : ""}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-secondary">{owned ? displayTitle(owned) : entry.work_title}</p>
            {(!entry.won || (showPeople && entry.people.length > 0)) && (
              <p className="mt-0.5 truncate text-micro text-text-tertiary">
                {[
                  !entry.won ? `Nominee ${entry.year}` : null,
                  showPeople && entry.people.length ? entry.people.map((p) => p.name).join(", ") : null,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        )}
        {/* The library's word for it — the list detail's dot and label, verbatim. */}
        {/* A fixed row height: with a rating the row grew by a pixel or two and the grid's rows
            no longer lined up across tiles. */}
        <div className="mt-1 flex h-4 min-w-0 items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dotClass)} />
          <span className={cn("truncate text-micro leading-none", status.textClass)}>{status.label}</span>
          {seen && owned?.user_rating != null && owned.user_rating > 0 && <ScoreMark value={owned.user_rating} source="mine" className="ml-auto shrink-0" />}
        </div>
      </div>

      {/* Not yours yet → the door to add it. Always visible on touch, revealed on hover with a mouse. */}
      {!owned && (
        <div className={cn(OVERLAY_CLUSTER, "right-2 opacity-100 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100")}>
          <button
            type="button"
            aria-label={`Add ${entry.work_title}`}
            onClick={(e) => { e.stopPropagation(); router.push(discover); }}
            className={cn(OVERLAY_CIRCLE, "text-white/80 transition-colors hover:bg-black/85 hover:text-white")}
          >
            <Plus size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
