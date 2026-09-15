"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SearchInput } from "@/shared/components/ui/search-input";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { cn } from "@/shared/utils/utils";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import { canonStatus, isSeen, ownedFor } from "@/modules/watching/lib/awards";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import { displayTitle } from "@/modules/watching/utils";
import type { AwardCategory, AwardEntry, WatchingMedia } from "@/modules/watching/types";
import { posterUrl } from "./AwardsClient";

/**
 * THE NOMINEES, YEAR BY YEAR — a sliding panel on the category page (owner, 2026-09-16). A nominee
 * only means something next to the others of its year ("who was up against Oppenheimer?"), which
 * a flat grid of five hundred posters cannot say and the timeline says at once: a dot, the year,
 * its five names, the winner marked in gold. Search and a year filter on top, like the watchlist.
 */

const AWARD = "var(--color-award)";

export function NomineesPanel({ open, onClose, category, entries, owned }: {
  open: boolean; onClose: () => void; category: AwardCategory; entries: AwardEntry[]; owned: Map<string, WatchingMedia>;
}) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");

  const years = useMemo(() => [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a), [entries]);
  const yearOptions = useMemo(() => [{ value: "all", label: "All years" }, ...years.map((y) => ({ value: String(y), label: String(y) }))], [years]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (e: AwardEntry) => !needle || e.work_title.toLowerCase().includes(needle) || e.people.some((p) => p.name.toLowerCase().includes(needle));
    const byYear = new Map<number, AwardEntry[]>();
    for (const e of entries) {
      if (year !== "all" && e.year !== Number(year)) continue;
      if (!hit(e)) continue;
      byYear.set(e.year, [...(byYear.get(e.year) ?? []), e]);
    }
    // Winner first, then the others by title.
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([y, es]) => [y, es.sort((a, b) => Number(b.won) - Number(a.won) || a.work_title.localeCompare(b.work_title))] as const);
  }, [entries, q, year]);

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      icon={<Trophy size={15} style={{ color: AWARD }} />}
      title={
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">Nominees</span>
          <span className="truncate text-micro text-text-tertiary">{category.label}</span>
        </div>
      }
    >
      <div className="flex items-center gap-2 px-4 pt-4">
        <SearchInput size="sm" containerClassName="min-w-0 flex-1" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder="Search nominees…" />
        <FilterSelect size="sm" className="w-28" value={year} onChange={setYear} options={yearOptions} aria-label="Year" />
      </div>

      <div className="px-4 py-4">
        {groups.length === 0 && <p className="py-6 text-xs text-text-tertiary">No nominee matches.</p>}
        {groups.map(([y, es], i) => (
          <div key={y} className={cn("relative pl-6", i < groups.length - 1 ? "pb-5" : "pb-0")}>
            {i < groups.length - 1 && <span className="absolute left-[3px] top-2 h-full w-px bg-border-subtle" />}
            <span className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-surface-1" style={{ backgroundColor: AWARD }} />
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-xs font-bold tabular-nums text-text-primary">{y}</p>
              <p className="text-micro tabular-nums text-text-tertiary">{es.length} {es.length === 1 ? "nominee" : "nominees"}</p>
            </div>
            <div className="-mx-2">
              {es.map((e) => <NomineeRow key={e.key} entry={e} owned={ownedFor(owned, e)} portrait={category.portrait} />)}
            </div>
          </div>
        ))}
      </div>
    </SlidingPanel>
  );
}

/** One nominee: the person (portrait categories) or the title; the library's word for it; Winner in gold. */
function NomineeRow({ entry, owned, portrait }: { entry: AwardEntry; owned: WatchingMedia | null; portrait: boolean }) {
  const router = useRouter();
  const person = portrait ? entry.people.find((p) => p.profile_path) ?? entry.people[0] ?? null : null;
  const status = canonStatus(owned);
  const seen = isSeen(owned);
  const film = owned ? displayTitle(owned) : entry.work_title;
  const href = owned ? `/perso/watching/${owned.id}` : entry.work_tmdb_id ? `/perso/watching/discover/${entry.work_type === "film" ? "film" : "serie"}/${entry.work_tmdb_id}` : undefined;
  const poster = person?.profile_path ? tmdbImageFor(posterUrl(person.profile_path), 40) : owned?.poster_url ?? posterUrl(entry.poster_path);

  // A person row is a div (the person opens on click), so the film can be a real link inside it;
  // a title row is the link itself. Never an <a> inside an <a>.
  const personHref = person?.tmdb_id ? `/perso/watching/person/${person.tmdb_id}` : null;
  return (
    <MediaRow
      href={person ? undefined : href}
      onClick={person ? () => { if (personHref) router.push(personHref); else if (href) router.push(href); } : undefined}
      posterUrl={poster}
      title={person ? person.name : film}
      meta={
        <span className="flex min-w-0 items-center gap-1.5 text-micro">
          {person && (
            <>
              {href ? (
                <Link href={href} onClick={(ev) => ev.stopPropagation()} className="truncate text-text-tertiary hover:text-text-primary">{film}</Link>
              ) : (
                <span className="truncate text-text-tertiary">{film}</span>
              )}
              <span className="text-text-tertiary/60">·</span>
            </>
          )}
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dotClass)} />
          <span className={cn("shrink-0", status.textClass)}>{status.label}</span>
        </span>
      }
      right={
        <span className="flex items-center gap-2">
          {seen && owned?.user_rating != null && owned.user_rating > 0 && <ScoreMark value={owned.user_rating} source="mine" />}
          {entry.won && <span className="text-caption uppercase" style={{ color: AWARD }}>Winner</span>}
        </span>
      }
    />
  );
}
