"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/utils/utils";
import { AwardRibbon } from "@/modules/watching/components/shared/Marks";
import { useAwardCategories, useAwardsForWork } from "@/modules/watching/hooks/useAwards";
import { useImdbId } from "@/modules/watching/hooks/useImdbId";
import { useOmdbRatings } from "@/modules/watching/hooks/useOmdbRatings";
import { foldEntries, portraitKeys } from "@/modules/watching/lib/awards";
import { displayTitle } from "@/modules/watching/utils";
import type { AwardCategory, AwardEntry, WatchingMedia } from "@/modules/watching/types";

/**
 * ACCOLADES — what the canon says about THIS title (owner, 2026-09-16).
 *
 * The card says the summary, the panel says the detail — the module's own pattern (achievements →
 * "why", watchlist → See all): Game of Thrones has 160 Emmy lines, and a right rail is not where
 * they go. On the fiche: one block, "12 Emmys · 41 nominations", the best wins on one line, and
 * the whole block is the door. OMDb's totals ("59 Emmys in all · 396 wins worldwide" — Creative
 * Arts, Globes, BAFTAs, everything) sit UNDER the canon's line as context, named for what they
 * are, so two Emmy counts never read as a contradiction. Nominations are counted as such: a win
 * is never counted twice.
 *
 * In the panel: a timeline, one stop per ceremony year; under it one HEADER per category
 * (WINNER / NOMINEE) and one line per person, a dot each — no forced wrap, we own the lines
 * (owner). The person opens their page, the category its list, the year its ceremony.
 *
 * The canon does not depend on possession — the discover page shows the same block.
 */

const AWARD = "var(--color-award)";
type Scope = "all" | "won" | "nominee";
const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "won", label: "Winners" },
  { value: "nominee", label: "Nominees" },
];

const ceremonyWord = (c: "oscars" | "emmys", n: number) => (c === "oscars" ? (n === 1 ? "Oscar" : "Oscars") : n === 1 ? "Emmy" : "Emmys");

/** OMDb's one string — "Won 59 Primetime Emmys. 396 wins & 655 nominations total." — as context. */
function omdbContext(raw: string): string | null {
  const wins = raw.match(/(\d+)\s+wins?/i)?.[1];
  const noms = raw.match(/(\d+)\s+nomination/i)?.[1];
  const headline = raw.match(/^\s*(?:Won|Nominated for)\s+(\d+)\s+(Primetime Emmys?|Oscars?|BAFTA[^.]*|Golden Globes?)/i);
  const parts: string[] = [];
  if (headline) parts.push(`${headline[1]} ${headline[2].replace(/^Primetime /, "")} in all`);
  if (wins) parts.push(`${wins} ${wins === "1" ? "win" : "wins"} worldwide`);
  else if (noms) parts.push(`${noms} nominations worldwide`);
  return parts.length ? parts.join(" · ") : null;
}

export function Accolades({ media }: { media: WatchingMedia }) {
  const kind = media.type === "film" ? "film" : "serie";
  const rowsQ = useAwardsForWork(kind, media.tmdb_id || null);
  const categoriesQ = useAwardCategories();
  // Same cached queries the Details card uses — no extra request.
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: omdb } = useOmdbRatings(imdbId, !!imdbId);
  const [open, setOpen] = useState(false);

  const cats = useMemo(() => new Map((categoriesQ.data ?? []).map((c) => [c.key, c])), [categoriesQ.data]);
  const entries = useMemo(() => foldEntries(rowsQ.data ?? [], portraitKeys(categoriesQ.data ?? [])), [rowsQ.data, categoriesQ.data]);
  const wins = useMemo(
    () => entries.filter((e) => e.won).sort((a, b) => (cats.get(a.category)?.rank ?? 99) - (cats.get(b.category)?.rank ?? 99) || b.year - a.year),
    [entries, cats],
  );
  const nominations = entries.filter((e) => !e.won).length;
  const context = omdb?.awards ? omdbContext(omdb.awards) : null;
  if (entries.length === 0 && !context) return null;

  // "12 Emmys · 41 nominations" — per ceremony when both series are present (a TV film).
  const winsBy = { oscars: wins.filter((e) => e.ceremony === "oscars").length, emmys: wins.filter((e) => e.ceremony === "emmys").length };
  const summary = [
    winsBy.oscars > 0 && `${winsBy.oscars} ${ceremonyWord("oscars", winsBy.oscars)}`,
    winsBy.emmys > 0 && `${winsBy.emmys} ${ceremonyWord("emmys", winsBy.emmys)}`,
    nominations > 0 && `${nominations} ${nominations === 1 ? "nomination" : "nominations"}`,
  ].filter(Boolean).join(" · ");
  const label = (e: AwardEntry) => cats.get(e.category)?.label ?? e.category;
  // Distinct categories, best first, "×N" when a series won the same one several years.
  const distinct = (() => {
    const counts = new Map<string, number>();
    for (const w of wins) counts.set(label(w), (counts.get(label(w)) ?? 0) + 1);
    return [...counts.entries()];
  })();
  const hasCanon = entries.length > 0;

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <Trophy size={15} className="shrink-0" style={{ color: AWARD }} />
        <p className="flex-1 text-sm font-semibold text-text-primary">Accolades</p>
        {hasCanon && <ChevronRight size={14} className="shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary" />}
      </div>
      {hasCanon && <p className="mt-1 text-xs tabular-nums text-text-secondary">{summary}</p>}
      {wins.length > 0 && (
        <p className="mt-2 flex min-w-0 items-center gap-1.5 text-micro text-text-tertiary">
          <AwardRibbon year={wins[0].year} size="card" inline />
          <span className="truncate">
            {distinct.slice(0, 3).map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(" · ")}
            {distinct.length > 3 && <span className="text-text-tertiary/70"> · +{distinct.length - 3}</span>}
          </span>
        </p>
      )}
      {context && <p className={cn("text-micro tabular-nums text-text-tertiary", hasCanon ? "mt-2" : "mt-1")}>{context}</p>}
    </>
  );

  // No canon behind it → no door: a plain block with OMDb's line (a Golden Globe, a BAFTA).
  if (!hasCanon) return <div className="rounded-card border border-border-subtle bg-surface-1 p-4 sm:px-5">{body}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full rounded-card border border-border-subtle bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2 sm:px-5"
      >
        {body}
      </button>
      <AccoladesPanel open={open} onClose={() => setOpen(false)} media={media} entries={entries} cats={cats} />
    </>
  );
}

/** A category header + its people, one per line. */
interface CategoryGroup { category: string; won: boolean; entries: AwardEntry[] }

function AccoladesPanel({ open, onClose, media, entries, cats }: { open: boolean; onClose: () => void; media: WatchingMedia; entries: AwardEntry[]; cats: Map<string, AwardCategory> }) {
  const [scope, setScope] = useState<Scope>("all");
  const wins = entries.filter((e) => e.won).length;
  const groups = useMemo(() => {
    const kept = entries.filter((e) => scope === "all" || (scope === "won" ? e.won : !e.won));
    const by = new Map<string, { ceremony: "oscars" | "emmys"; year: number; season: number | null; cats: Map<string, CategoryGroup> }>();
    for (const e of kept) {
      const k = `${e.ceremony}|${e.year}`;
      const g = by.get(k) ?? { ceremony: e.ceremony, year: e.year, season: e.season_number || null, cats: new Map() };
      const ck = `${e.category}|${e.won ? "W" : "N"}`;
      const cg = g.cats.get(ck) ?? { category: e.category, won: e.won, entries: [] };
      cg.entries.push(e); g.cats.set(ck, cg); by.set(k, g);
    }
    const rank = (c: string) => cats.get(c)?.rank ?? 99;
    return [...by.values()]
      .sort((a, b) => b.year - a.year || a.ceremony.localeCompare(b.ceremony))
      .map((g) => ({ ...g, list: [...g.cats.values()].sort((a, b) => Number(b.won) - Number(a.won) || rank(a.category) - rank(b.category)) }));
  }, [entries, scope, cats]);

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      width="wide"
      icon={<Trophy size={15} style={{ color: AWARD }} />}
      title={
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-text-primary">Accolades</span>
            <span className="truncate text-micro text-text-tertiary">{displayTitle(media)}</span>
          </div>
          <p className="mt-0.5 text-micro tabular-nums text-text-tertiary">{wins} {wins === 1 ? "win" : "wins"} · {entries.length - wins} {entries.length - wins === 1 ? "nomination" : "nominations"}</p>
        </div>
      }
    >
      <div className="px-4 pt-4">
        <SegmentedControl items={SCOPES} value={scope} onChange={setScope} size="sm" />
      </div>
      <div className="px-4 py-4">
        {groups.length === 0 && <p className="py-6 text-xs text-text-tertiary">Nothing in this view.</p>}
        {groups.map((g, i) => (
          <div key={`${g.ceremony}${g.year}`} className={cn("relative pl-6", i < groups.length - 1 ? "pb-5" : "pb-0")}>
            {i < groups.length - 1 && <span className="absolute left-[3px] top-2 h-full w-px bg-border-subtle" />}
            <span className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-surface-1" style={{ backgroundColor: g.list.some((c) => c.won) ? AWARD : "var(--color-award-dim)" }} />
            <div className="mb-2 flex items-baseline justify-between gap-3">
              {/* The stop is the ceremony — and its door. */}
              <Link href={`/perso/watching/awards/ceremony/${g.ceremony}/${g.year}`} className="text-xs font-bold tabular-nums text-text-primary transition-colors hover:text-accent-watching-vivid">
                {g.ceremony === "oscars" ? "Oscars" : "Emmys"} {g.year}{g.season ? <span className="font-medium text-text-tertiary"> · S{g.season}</span> : null}
              </Link>
              <p className="text-micro tabular-nums text-text-tertiary">
                {g.list.filter((c) => c.won).reduce((n, c) => n + c.entries.length, 0)} won · {g.list.filter((c) => !c.won).reduce((n, c) => n + c.entries.length, 0)} nominated
              </p>
            </div>
            <div className="space-y-2.5">
              {g.list.map((c) => {
                // One name per line. Co-credits of one nomination (writers) are still one entry
                // with several people — they get their lines too.
                const people = c.entries.flatMap((e) => e.people);
                return (
                  <div key={`${c.category}${c.won}`} className="text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("w-14 shrink-0 text-caption uppercase", c.won ? "" : "text-text-tertiary")} style={c.won ? { color: AWARD } : undefined}>
                        {c.won ? "Winner" : "Nominee"}
                      </span>
                      <Link href={`/perso/watching/awards/${c.category}`} className="min-w-0 truncate font-medium text-text-primary transition-colors hover:text-accent-watching-vivid">
                        {cats.get(c.category)?.label ?? c.category}
                      </Link>
                    </div>
                    {people.length > 0 && (
                      <ul className="mt-1 space-y-0.5 pl-16">
                        {people.map((p, j) => (
                          <li key={`${p.tmdb_id ?? p.name}${j}`} className="flex items-center gap-2 text-text-secondary">
                            <span className="h-1 w-1 shrink-0 rounded-full bg-text-tertiary/70" />
                            {p.tmdb_id ? (
                              <Link href={`/perso/watching/person/${p.tmdb_id}`} className="truncate transition-colors hover:text-text-primary">{p.name}</Link>
                            ) : (
                              <span className="truncate">{p.name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SlidingPanel>
  );
}
