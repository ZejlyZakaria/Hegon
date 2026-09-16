"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/utils/utils";
import { AwardRibbon, ScoreMark } from "@/modules/watching/components/shared/Marks";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { useAwardCategories, useAwardsForPerson } from "@/modules/watching/hooks/useAwards";
import { ceremonyWord, posterUrl } from "@/modules/watching/lib/awards";
import type { PersonTitle } from "@/modules/watching/service";
import type { AwardCategory, AwardEntry } from "@/modules/watching/types";

/**
 * ACCOLADES OF A PERSON — the canon's other axis (owner, 2026-09-16).
 *
 * On the fiche the question is "what did this title win" and the panel is a library: category
 * headers, one person per line. On a person the question is "with WHAT" — an actor or a director
 * is known for a film or a series — so here the WORK carries the line: the shape of the page's own
 * timeline (rail, one stop per year, poster rows), one row per work and year, the season's poster
 * and "S1" when the award named a season, and under the title one line per award: WINNER in gold /
 * NOMINEE in grey, then the category. The rail-right block says the summary; the whole block is
 * the door — same pattern as the fiche.
 *
 * A work you own reads as yours (your score, in teal) and opens its fiche; the others open their
 * discover page, like every unowned title on this page. Three doors per row, as on the fiche's
 * panel: the work (the row) opens the media, the category opens the Museum, the year its
 * ceremony — and the hover follows the door. Two ceremonies in one year are two stops
 * (Alan Alda 2005: an Oscar nomination and an Emmy nomination — "Supporting Actor" has to say for
 * which). Default width — the page's other panel is default, and two panels on one page match.
 */

const AWARD = "var(--color-award)";
type Scope = "all" | "won" | "nominee";
const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "won", label: "Winners" },
  { value: "nominee", label: "Nominees" },
];

const kindOf = (t: string) => (t === "film" ? "film" : "serie");

interface Props { personId: number; name: string; yourTitles: PersonTitle[] }

export function PersonAccolades({ personId, name, yourTitles }: Props) {
  const rowsQ = useAwardsForPerson(personId);
  const categoriesQ = useAwardCategories();
  const [open, setOpen] = useState(false);

  const cats = useMemo(() => new Map((categoriesQ.data ?? []).map((c) => [c.key, c])), [categoriesQ.data]);
  const entries = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const wins = useMemo(
    () => entries.filter((e) => e.won).sort((a, b) => (cats.get(a.category)?.rank ?? 99) - (cats.get(b.category)?.rank ?? 99) || b.year - a.year),
    [entries, cats],
  );
  // What you own, by the key the canon joins on — the row lights up and opens YOUR fiche.
  const owned = useMemo(
    () => new Map(yourTitles.map((t) => [`${kindOf(t.type)}:${t.tmdb_id}`, t] as const)),
    [yourTitles],
  );
  if (entries.length === 0) return null;

  const nominations = entries.length - wins.length;
  const winsBy = { oscars: wins.filter((e) => e.ceremony === "oscars").length, emmys: wins.filter((e) => e.ceremony === "emmys").length };
  const summary = [
    winsBy.oscars > 0 && `${winsBy.oscars} ${ceremonyWord("oscars", winsBy.oscars)}`,
    winsBy.emmys > 0 && `${winsBy.emmys} ${ceremonyWord("emmys", winsBy.emmys)}`,
    nominations > 0 && `${nominations} ${nominations === 1 ? "nomination" : "nominations"}`,
  ].filter(Boolean).join(" · ");
  const label = (e: AwardEntry) => cats.get(e.category)?.label ?? e.category;
  const distinct = (() => {
    const counts = new Map<string, number>();
    for (const w of wins) counts.set(label(w), (counts.get(label(w)) ?? 0) + 1);
    return [...counts.entries()];
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full rounded-card border border-border-subtle bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2 sm:px-5"
      >
        <div className="flex items-center gap-2.5">
          <Trophy size={15} className="shrink-0" style={{ color: AWARD }} />
          <p className="flex-1 text-sm font-semibold text-text-primary">Accolades</p>
          <ChevronRight size={14} className="shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary" />
        </div>
        <p className="mt-1 text-xs tabular-nums text-text-secondary">{summary}</p>
        {wins.length > 0 && (
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-micro text-text-tertiary">
            <AwardRibbon year={wins[0].year} size="card" inline />
            <span className="truncate">
              {distinct.slice(0, 3).map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(" · ")}
              {distinct.length > 3 && <span className="text-text-tertiary/70"> · +{distinct.length - 3}</span>}
            </span>
          </p>
        )}
      </button>
      <PersonAccoladesPanel open={open} onClose={() => setOpen(false)} name={name} entries={entries} cats={cats} owned={owned} />
    </>
  );
}

/** One work in one ceremony year, with every award it drew for this person. */
interface WorkGroup { key: string; entry: AwardEntry; awards: { won: boolean; category: string }[] }

function PersonAccoladesPanel({ open, onClose, name, entries, cats, owned }: {
  open: boolean; onClose: () => void; name: string; entries: AwardEntry[]; cats: Map<string, AwardCategory>;
  owned: Map<string, PersonTitle>;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const wins = entries.filter((e) => e.won).length;
  const groups = useMemo(() => {
    const kept = entries.filter((e) => scope === "all" || (scope === "won" ? e.won : !e.won));
    const by = new Map<string, { ceremony: "oscars" | "emmys"; year: number; works: Map<string, WorkGroup> }>();
    for (const e of kept) {
      const k = `${e.ceremony}|${e.year}`;
      const g = by.get(k) ?? { ceremony: e.ceremony, year: e.year, works: new Map() };
      // One row per work and year: three nominations for M*A*S*H in 1982 are one poster, three
      // lines — three identical posters would say "three things" about one year.
      const wk = `${e.work_type}:${e.work_tmdb_id ?? e.work_title}|${e.season_number ?? 0}`;
      const w = g.works.get(wk) ?? { key: wk, entry: e, awards: [] };
      w.awards.push({ won: e.won, category: e.category });
      g.works.set(wk, w); by.set(k, g);
    }
    const rank = (c: string) => cats.get(c)?.rank ?? 99;
    return [...by.values()]
      .sort((a, b) => b.year - a.year || a.ceremony.localeCompare(b.ceremony))
      .map((g) => ({
        ...g,
        list: [...g.works.values()]
          .map((w) => ({ ...w, awards: w.awards.sort((a, b) => Number(b.won) - Number(a.won) || rank(a.category) - rank(b.category)) }))
          .sort((a, b) => Number(b.awards.some((x) => x.won)) - Number(a.awards.some((x) => x.won)) || rank(a.awards[0].category) - rank(b.awards[0].category)),
      }));
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
            <span className="truncate text-micro text-text-tertiary">{name}</span>
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
        {groups.map((g, i) => {
          const won = g.list.reduce((n, w) => n + w.awards.filter((a) => a.won).length, 0);
          const nominated = g.list.reduce((n, w) => n + w.awards.length, 0) - won;
          return (
            <div key={`${g.ceremony}${g.year}`} className={cn("relative pl-6", i < groups.length - 1 ? "pb-5" : "pb-0")}>
              {i < groups.length - 1 && <span className="absolute left-[3px] top-2 h-full w-px bg-border-subtle" />}
              <span className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-surface-1" style={{ backgroundColor: won > 0 ? AWARD : "var(--color-award-dim)" }} />
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                {/* The stop is the ceremony — and its door. */}
                <Link href={`/perso/watching/awards/ceremony/${g.ceremony}/${g.year}`} className="text-xs font-bold tabular-nums text-text-primary transition-colors hover:text-accent-watching-vivid">
                  {g.ceremony === "oscars" ? "Oscars" : "Emmys"} {g.year}
                </Link>
                <p className="text-micro tabular-nums text-text-tertiary">{won} won · {nominated} nominated</p>
              </div>
              <div className="-mx-2">
                {g.list.map((w) => {
                  const e = w.entry;
                  const mine = owned.get(`${e.work_type}:${e.work_tmdb_id}`) ?? null;
                  const href = mine
                    ? `/perso/watching/${mine.id}`
                    : e.work_tmdb_id ? `/perso/watching/discover/${e.work_type}/${e.work_tmdb_id}` : undefined;
                  return (
                    <MediaRow
                      key={w.key}
                      titleHref={href}
                      posterUrl={posterUrl(e.season_poster_path ?? e.poster_path)}
                      title={e.work_title}
                      suffix={e.season_number ? `S${e.season_number}` : undefined}
                      meta={
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {w.awards.map((a) => (
                            <span key={`${a.category}${a.won}`} className="flex min-w-0 items-baseline gap-1.5 text-micro">
                              <span className={cn("shrink-0 text-caption uppercase", a.won ? "" : "text-text-tertiary")} style={a.won ? { color: AWARD } : undefined}>
                                {a.won ? "Winner" : "Nominee"}
                              </span>
                              <Link href={`/perso/watching/awards/${a.category}`} className="relative z-10 truncate text-text-secondary transition-colors hover:text-accent-watching-vivid">
                                {cats.get(a.category)?.label ?? a.category}
                              </Link>
                            </span>
                          ))}
                        </div>
                      }
                      right={mine?.user_rating != null ? <ScoreMark value={mine.user_rating} source="mine" /> : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SlidingPanel>
  );
}
