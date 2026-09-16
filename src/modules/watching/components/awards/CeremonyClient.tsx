"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { AwardRibbon, ScoreMark } from "@/modules/watching/components/shared/Marks";
import { AddMark } from "@/modules/watching/components/shared/AddMark";
import { useAwardCategories, useAwardCeremonies, useAwardYear, useOwnedTitles } from "@/modules/watching/hooks/useAwards";
import { canonStatus, indexOwned, isSeen, ownedFor } from "@/modules/watching/lib/awards";
import { displayTitle } from "@/modules/watching/utils";
import type { AwardCategory, AwardCeremony, AwardCeremonyRow, AwardEntry, WatchingMedia } from "@/modules/watching/types";
import { entryImage } from "./AwardsClient";

/**
 * ONE CEREMONY, EVERY CATEGORY — `/perso/watching/awards/ceremony/[ceremony]/[year]`. The door the
 * year tag opens, and the page "This year" points to (owner, 2026-09-16).
 *
 * Two moments of the same page. BEFORE the ceremony: the nominees, a countdown, what you've seen of
 * them — the run-up. AFTER: the winner leads each category with the gold tag, the nominees follow.
 * The rows are the nominees' own order; nothing here is a ranking.
 */

export const ordinal = (n: number) => { const r = n % 100; return r >= 11 && r <= 13 ? `${n}th` : `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`; };
// Wikidata numbers every Oscar ceremony but not the Emmys: the 1st was 1949, so the year says it.
export const ceremonyName = (c: AwardCeremony, edition: number | null, year: number) =>
  c === "oscars" ? (edition ? `${ordinal(edition)} Academy Awards` : `Academy Awards ${year}`) : `${ordinal(edition ?? year - 1948)} Primetime Emmy Awards`;
export const daysUntil = (iso: string) => Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000);
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function CeremonyClient({ userId, ceremony, year }: { userId: string; ceremony: AwardCeremony; year: number }) {
  const router = useRouter();
  const categoriesQ = useAwardCategories();
  const ceremoniesQ = useAwardCeremonies();
  const rowsQ = useAwardYear(ceremony, year);
  const ownedQ = useOwnedTitles(userId);

  const info: AwardCeremonyRow | null = ceremoniesQ.data?.find((c) => c.ceremony === ceremony && c.year === year) ?? null;
  const categories = useMemo(() => (categoriesQ.data ?? []).filter((c) => c.ceremony === ceremony).sort((a, b) => a.rank - b.rank), [categoriesQ.data, ceremony]);
  const owned = useMemo(() => indexOwned(ownedQ.data ?? []), [ownedQ.data]);
  const entries = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const byCategory = useMemo(() => {
    const m = new Map<string, AwardEntry[]>();
    for (const e of entries) m.set(e.category, [...(m.get(e.category) ?? []), e]);
    for (const es of m.values()) es.sort((a, b) => Number(b.won) - Number(a.won) || a.work_title.localeCompare(b.work_title));
    return m;
  }, [entries]);

  const days = info?.held_on ? daysUntil(info.held_on) : null;
  const upcoming = days != null && days >= 0;
  const seen = entries.filter((e) => isSeen(ownedFor(owned, e))).length;
  const loading = categoriesQ.isLoading || rowsQ.isLoading || ownedQ.isLoading;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-zinc-950 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => router.push(`/perso/watching/awards?c=${ceremony}`)}
          className="flex shrink-0 items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Back to Awards</span>
          <span className="sm:hidden">Back</span>
        </button>
      </div>

      <div className="px-4 pt-5 sm:px-6">
        <p className="text-caption uppercase text-text-tertiary">{ceremony === "emmys" ? "Emmys" : "Oscars"} · {year}</p>
        <h1 className="mt-1 text-xl font-bold text-text-primary">{ceremonyName(ceremony, info?.edition ?? null, year)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-text-tertiary">
          {info?.held_on && (
            <span className="flex items-center gap-1.5">
              <CalendarClock size={12} />
              {fmtDate(info.held_on)}
              {upcoming && <span className="font-semibold" style={{ color: "var(--color-award)" }}>· {days === 0 ? "tonight" : days === 1 ? "tomorrow" : `in ${days} days`}</span>}
            </span>
          )}
          {!loading && entries.length > 0 && (
            <span>· <span className="font-medium text-text-secondary">{seen}</span> of {entries.length} {upcoming ? "nominees" : "titles"} seen</span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6 p-4 sm:p-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-3 h-3.5 w-40 rounded bg-surface-2" />
              <div className="flex gap-3">{Array.from({ length: 5 }, (_, j) => <div key={j} className="aspect-2/3 w-28 shrink-0 rounded-tile bg-surface-2" />)}</div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="px-4 py-8 text-xs text-text-tertiary sm:px-6">No nominees yet for this ceremony.</p>
      ) : (
        <div className="space-y-7 p-4 sm:p-6">
          {categories.filter((c) => byCategory.has(c.key)).map((c) => (
            <CategoryRow key={c.key} category={c} entries={byCategory.get(c.key)!} owned={owned} upcoming={upcoming} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ category, entries, owned, upcoming }: { category: AwardCategory; entries: AwardEntry[]; owned: Map<string, WatchingMedia>; upcoming: boolean }) {
  const seen = entries.filter((e) => isSeen(ownedFor(owned, e))).length;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Link href={`/perso/watching/awards/${category.key}`} className="text-title text-text-primary transition-colors hover:text-accent-watching-vivid">{category.label}</Link>
        <span className="text-micro tabular-nums text-text-tertiary">{seen} of {entries.length} seen</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {entries.map((e) => <NomineeTile key={e.key} entry={e} owned={ownedFor(owned, e)} portrait={category.portrait} upcoming={upcoming} />)}
      </div>
    </section>
  );
}

/** A nominee, compact: face or poster, the gold tag if it won (never before the ceremony), status. */
function NomineeTile({ entry, owned, portrait, upcoming }: { entry: AwardEntry; owned: WatchingMedia | null; portrait: boolean; upcoming: boolean }) {
  const router = useRouter();
  const seen = isSeen(owned);
  const status = canonStatus(owned);
  const person = portrait ? entry.people.find((p) => p.profile_path) ?? entry.people[0] ?? null : null;
  const hasFace = !!person?.profile_path;
  const src = entryImage(entry, owned, portrait, 112);
  const filmHref = owned ? `/perso/watching/${owned.id}` : entry.work_tmdb_id ? `/perso/watching/discover/${entry.work_type === "film" ? "film" : "serie"}/${entry.work_tmdb_id}` : null;
  const open = () => {
    if (hasFace && person?.tmdb_id) router.push(`/perso/watching/person/${person.tmdb_id}`);
    else if (filmHref) router.push(filmHref);
  };
  return (
    <div className={cn("group w-28 shrink-0", (filmHref || (hasFace && person?.tmdb_id)) && "cursor-pointer")} onClick={open}>
      <div className="relative aspect-2/3 overflow-hidden rounded-tile bg-zinc-800 transition-transform duration-300 ease-out group-hover:scale-[1.04]">
        {src ? (
          <Image src={src} alt={hasFace ? person!.name : entry.work_title} fill loading="lazy" className="object-cover object-top" sizes="112px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-micro text-text-tertiary">{entry.work_title}</div>
        )}
        {entry.won && !upcoming && <AwardRibbon year={entry.year} tone={seen ? "won" : "dim"} size="card" />}
        {!owned && entry.work_tmdb_id && <AddMark tmdbId={entry.work_tmdb_id} type={entry.work_type} title={entry.work_title} />}
        {!hasFace && !!entry.season_number && (
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-2 pt-6">
            <span className="text-xs font-bold text-white">S{entry.season_number}</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-secondary">{hasFace ? person!.name : owned ? displayTitle(owned) : entry.work_title}</p>
      {hasFace && <p className="truncate text-micro text-text-tertiary">{owned ? displayTitle(owned) : entry.work_title}</p>}
      <div className="mt-1 flex h-4 min-w-0 items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dotClass)} />
        <span className={cn("truncate text-micro leading-4", status.textClass)}>{status.label}</span>
        {seen && owned?.user_rating != null && owned.user_rating > 0 && <ScoreMark value={owned.user_rating} source="mine" className="ml-auto shrink-0" />}
      </div>
    </div>
  );
}
