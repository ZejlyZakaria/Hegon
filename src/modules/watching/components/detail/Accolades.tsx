"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/utils/utils";
import { useAwardCategories, useAwardsForWork } from "@/modules/watching/hooks/useAwards";
import { useImdbId } from "@/modules/watching/hooks/useImdbId";
import { useOmdbRatings } from "@/modules/watching/hooks/useOmdbRatings";
import { externalAwardSummary, featuredAccolade } from "../../lib/accolade-summary";
import { displayTitle } from "@/modules/watching/utils";
import type { AwardCategory, AwardEntry, WatchingMedia } from "@/modules/watching/types";

/** Tracked wins and nominations lead; broader external totals remain separate context. */
const AWARD = "var(--color-award)";
type Scope = "all" | "won" | "nominee";
const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "won", label: "Winners" },
  { value: "nominee", label: "Nominees" },
];

export function Accolades({ media }: { media: WatchingMedia }) {
  const kind = media.type === "film" ? "film" : "serie";
  const rowsQ = useAwardsForWork(kind, media.tmdb_id || null);
  const categoriesQ = useAwardCategories();
  // Same cached queries the Details card uses — no extra request.
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: omdb } = useOmdbRatings(imdbId, !!imdbId);
  const [open, setOpen] = useState(false);

  const cats = useMemo(() => new Map((categoriesQ.data ?? []).map((c) => [c.key, c])), [categoriesQ.data]);
  const entries = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const wins=entries.filter(e=>e.won);
  const nominations=entries.length-wins.length;
  const external=externalAwardSummary(omdb?.awards);
  const hasCanon=entries.length>0;
  const featured=featuredAccolade(entries,cats);
  if(!hasCanon && !external) return null;
  const counters:{value:number;label:string;won:boolean}[]=[];
  for(const ceremony of ["oscars","emmys"] as const) {
    const value=wins.filter(e=>e.ceremony===ceremony).length;
    if(value) counters.push({value,label:ceremony==="oscars" ? `Oscar ${value===1 ? "win":"wins"}`:`Emmy ${value===1 ? "win":"wins"}`,won:true});
  }
  if(nominations) counters.push({value:nominations,label:nominations===1 ? "nomination":"nominations",won:false});
  if(!hasCanon && external) {
    if(external.wins!=null && external.wins>0) counters.push({value:external.wins,label:external.additional ? "other award wins":"wins across all awards",won:true});
    if(external.nominations!=null && external.nominations>0) counters.push({value:external.nominations,label:external.additional ? "other nominations":"nominations across all awards",won:false});
    if(!counters.length && external.headline && external.headline.count>0) counters.push({value:external.headline.count,label:`${external.headline.name} ${external.headline.won ? "won":"nominations"}`,won:external.headline.won});
  }
  if(!counters.length) return null;
  const broaderContext=hasCanon && external && (external.wins!=null && external.wins>0 ? `${external.wins} ${external.wins===1 ? "win":"wins"}` : external.nominations!=null && external.nominations>0 ? `${external.nominations} ${external.nominations===1 ? "nomination":"nominations"}`:null);
  const body=<>
    <div className="flex items-center justify-between gap-3">
      <span role="heading" aria-level={2} className="text-title text-text-primary">Accolades</span>
      {hasCanon && <ChevronRight size={14} className="shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary"/>}
    </div>
    <dl className={`mt-4 grid gap-4 ${counters.length>2 ? "grid-cols-3":counters.length===2 ? "grid-cols-2":"grid-cols-1"}`}>
      {counters.map(c=><div key={c.label} className="min-w-0"><dd className="text-3xl font-semibold leading-none tracking-tight tabular-nums" style={c.won ? {color:AWARD}:undefined}>{c.value}</dd><dt className="mt-2 text-xs leading-snug text-text-secondary">{c.label}</dt></div>)}
    </dl>
    {hasCanon && <p className="mt-2 text-micro text-text-tertiary">In tracked categories</p>}
    {featured && <div className="mt-4 flex items-start gap-3 border-t border-border-subtle pt-4">
      <Trophy size={17} className="mt-0.5 shrink-0" style={{color:AWARD}}/>
      <div className="min-w-0"><p className="text-sm font-medium leading-snug text-text-primary">{featured.label}</p><p className="mt-1 text-xs leading-relaxed text-text-secondary">{featured.count} {featured.count===1 ? "win":"wins"} {"\u00b7"} {featured.years}</p></div>
    </div>}
    {broaderContext && <p className="mt-4 text-micro leading-relaxed text-text-tertiary">{external?.additional ? "Other awards" : "Across all awards"} {"\u00b7"} {broaderContext}<span className="ml-1 text-text-tertiary/70">(IMDb)</span></p>}
    {!hasCanon && <p className="mt-3 text-micro text-text-tertiary">IMDb awards summary</p>}
  </>;

  // No canon behind it → no door: a plain block with OMDb's line (a Golden Globe, a BAFTA).
  if (!hasCanon) return <div className="surface-quiet rounded-card p-4 sm:px-5">{body}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group surface-quiet w-full rounded-card p-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-watching-vivid sm:px-5"
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
