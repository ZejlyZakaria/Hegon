"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/utils/utils";
import { AwardRibbon, ScoreMark, OVERLAY_CLUSTER, OVERLAY_CIRCLE } from "@/modules/watching/components/shared/Marks";
import { useAwardCategories, useAwardCategoryRows, useOwnedTitles } from "@/modules/watching/hooks/useAwards";
import { foldEntries, indexOwned, isSeen, ownedFor } from "@/modules/watching/lib/awards";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import { displayTitle } from "@/modules/watching/utils";
import type { AwardEntry, WatchingMedia } from "@/modules/watching/types";
import { posterUrl } from "./AwardsClient";

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

export function AwardCategoryClient({ userId, categoryKey }: { userId: string; categoryKey: string }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("winners");
  const categoriesQ = useAwardCategories();
  const category = categoriesQ.data?.find((c) => c.key === categoryKey) ?? null;
  const rowsQ = useAwardCategoryRows(category?.ceremony ?? "oscars", category ? category.key : "");
  const ownedQ = useOwnedTitles(userId);

  const owned = useMemo(() => indexOwned(ownedQ.data ?? []), [ownedQ.data]);
  const entries = useMemo(() => {
    const all = foldEntries(rowsQ.data ?? []).sort((a, b) => b.year - a.year || Number(b.won) - Number(a.won));
    return scope === "winners" ? all.filter((e) => e.won) : all;
  }, [rowsQ.data, scope]);
  const winners = useMemo(() => foldEntries(rowsQ.data ?? []).filter((e) => e.won), [rowsQ.data]);
  const seen = winners.filter((e) => isSeen(ownedFor(owned, e))).length;

  const loading = categoriesQ.isLoading || rowsQ.isLoading || ownedQ.isLoading;

  return (
    <div className="flex flex-col">
      {/* ── Contextual topbar — the list detail's, verbatim ── */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-zinc-950 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/perso/watching/awards")}
          className="flex shrink-0 items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Back to Awards</span>
          <span className="sm:hidden">Back</span>
        </button>
        <div className="flex-1" />
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
      ) : (
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 sm:p-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {entries.map((e) => (
            <CanonTile key={e.key} entry={e} owned={ownedFor(owned, e)} showPeople={category?.subject === "person"} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A title of the canon. Finished = full colour + your rating; not finished = dimmed + a "+".
 * Winner = the gold year ribbon; a nominee wears nothing (the year sits in its meta line).
 */
function CanonTile({ entry, owned, showPeople }: { entry: AwardEntry; owned: WatchingMedia | null; showPeople: boolean }) {
  const router = useRouter();
  const seen = isSeen(owned);
  const src = owned?.poster_url
    ? tmdbImageFor(owned.poster_url, 200) || owned.poster_url
    : tmdbImageFor(posterUrl(entry.poster_path), 200);
  const discover = `/perso/watching/discover/${entry.work_type === "film" ? "film" : "serie"}/${entry.work_tmdb_id}`;
  const open = () => router.push(owned ? `/perso/watching/${owned.id}` : discover);

  return (
    <div className="group relative">
      <div className="relative cursor-pointer" onClick={open}>
        <div className={cn(
          "relative aspect-2/3 overflow-hidden rounded-tile bg-zinc-800 transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]",
          !seen && "opacity-60 transition-opacity group-hover:opacity-90",
        )}>
          {src ? (
            <Image src={src} alt={entry.work_title} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 33vw, 200px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-micro text-text-tertiary">{entry.work_title}</div>
          )}
          {entry.won && (
            <div className="absolute left-2 top-0 z-10">
              <AwardRibbon year={entry.year} size="tile" />
            </div>
          )}
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-secondary">{owned ? displayTitle(owned) : entry.work_title}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {seen && owned?.user_rating != null && owned.user_rating > 0 && <ScoreMark value={owned.user_rating} source="mine" className="shrink-0" />}
          <span className="truncate text-micro text-text-tertiary">
            {[
              !entry.won ? `Nominee ${entry.year}` : entry.work_year ?? null,
              showPeople && entry.people.length ? entry.people.map((p) => p.name).join(", ") : null,
            ].filter(Boolean).join(" · ")}
          </span>
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
