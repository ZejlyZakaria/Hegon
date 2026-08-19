"use client";

// The Competition PAGE (route: /perso/sports/football/competition/[id]) — the sibling of the team
// page, and now built like one: a full-bleed hero (see FootballCompetitionHero), then tabs, then
// content held to a readable column instead of stretched across the viewport.
//
// EVERYTHING is derived from the DB matches (football_matches) — season, progress, standings — so it
// is instant and always consistent with what is shown. Only Top Scorers comes from a passthrough
// route. Match rows open the Match panel.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCompetition, useCompetitionMatches, useCompetitionWinners, useStandings } from "../../hooks/useFootballCompetition";
import { useScorers } from "../../hooks/useScorers";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { FootballMatchPanel } from "../match/FootballMatchPanel";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite, Scorer, CompetitionWinner } from "../../service";
import StandingsTable from "../standings/StandingsTable";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { FootballCompetitionHero, type CompetitionSeasonInfo } from "./FootballCompetitionHero";

const CREST_FALLBACK = "/placeholder-logo.svg";
type Tab = "summary" | "standings" | "fixtures" | "scorers" | "honours";

const TABS: { key: Tab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "standings", label: "Standings" },
  { key: "fixtures", label: "Fixtures" },
  { key: "scorers", label: "Top Scorers" },
  { key: "honours", label: "Honours" },
];

export default function FootballCompetitionPage({ id }: { id: string }) {
  const router = useRouter();
  const { data: comp } = useCompetition(id);
  const code = comp?.code ?? null;
  const { data: matches } = useCompetitionMatches(id);
  const { data: scorers } = useScorers(code);
  const { data: winners } = useCompetitionWinners(id);

  const [tab, setTab] = useState<Tab>("summary");
  const openMatch = useMatchPanel((s) => s.open);

  const season = useMemo(() => computeSeason(matches ?? []), [matches]);
  const { data: standings } = useStandings(id);

  // A competition registered but never synced has 0 matches → fill it in the background (the calendar
  // shows up on the next view). Fire-and-forget, keepalive so it survives navigation.
  useEffect(() => {
    if (comp?.api_external_id && matches && matches.length === 0) {
      fetch(`/api/football/sync-competition/${comp.api_external_id}`, { method: "POST", keepalive: true }).catch(() => {});
    }
  }, [comp?.api_external_id, matches]);

  // Original (colour) logo — same slug in the sibling folder; else the API emblem.
  const logo = comp?.logo_url
    ? comp.logo_url.replace("/leagues-white-logos/", "/leagues-logos/")
    : comp?.emblem_url ?? null;

  // Off-season: the latest season we have is fully played and the new one isn't published yet (e.g.
  // the UCL draw happens late August). Said in the hero, next to the season label, rather than as a
  // banner of its own — it is a fact ABOUT the season, not a separate announcement.
  const seasonComplete = (matches?.length ?? 0) > 0 && (matches ?? []).every((m) => m.status === "FINISHED");

  return (
    <div className="min-h-screen bg-surface-0">
      <FootballCompetitionHero
        name={displayCompetitionName(comp?.name) || "Competition"}
        logo={logo}
        brand={comp?.brand_color ?? null}
        season={season}
        seasonComplete={seasonComplete}
        onBack={() => router.back()}
      />

      {/* FIVE TABS DO NOT FIT A PHONE — roughly 400px of labels in a 375px viewport, so the last one
          was simply unreachable. The strip scrolls, and bleeds to the screen edge so it reads as
          scrollable rather than clipped. */}
      <div className="border-b border-border-subtle">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 scrollbar-hide sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors ${
                tab === t.key ? "text-accent-sports" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t.label}
              {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent-sports" />}
            </button>
          ))}
        </div>
      </div>

      {/* Held to a column. These tabs are all LISTS, and a list row stretched to 1400px puts its two
          ends so far apart that they stop reading as one row. */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab === "summary" && <SummaryTab matches={matches ?? []} onOpen={openMatch} />}
        {tab === "standings" && <StandingsTable rows={standings ?? []} competitionCode={comp?.code} />}
        {tab === "fixtures" && <FixturesTab matches={matches ?? []} onOpen={openMatch} defaultMatchday={season?.currentMatchday ?? 0} />}
        {tab === "scorers" && <ScorersTab scorers={scorers ?? []} />}
        {tab === "honours" && <HonoursTab winners={winners ?? []} />}
      </div>

      <FootballMatchPanel />
    </div>
  );
}

// ─── Summary (last round's results + next round's fixtures) ─────────────────────

function SummaryTab({ matches, onOpen }: { matches: FootballMatchLite[]; onOpen: (id: number) => void }) {
  const finished = matches.filter((m) => m.status === "FINISHED");
  const upcoming = matches.filter((m) => m.status !== "FINISHED");
  const lastMd = finished.length ? Math.max(...finished.map((m) => m.matchday ?? 0)) : null;
  const nextMd = upcoming.length ? Math.min(...upcoming.map((m) => m.matchday ?? 0)) : null;
  const lastResults = lastMd ? finished.filter((m) => (m.matchday ?? 0) === lastMd) : [];
  const nextFixtures = nextMd ? upcoming.filter((m) => (m.matchday ?? 0) === nextMd) : [];

  if (!lastResults.length && !nextFixtures.length) return <Empty>No matches yet</Empty>;

  // Two rounds side by side rather than stacked: they are the same kind of thing at the same rank,
  // and the width is there.
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {lastResults.length > 0 && <RoundSection label={`Latest results · Matchday ${lastMd}`} matches={lastResults} onOpen={onOpen} />}
      {nextFixtures.length > 0 && <RoundSection label={`Up next · Matchday ${nextMd}`} matches={nextFixtures} onOpen={onOpen} />}
    </div>
  );
}

// ─── Fixtures (one round at a time) ─────────────────────────────────────────────

function FixturesTab({ matches, onOpen, defaultMatchday }: { matches: FootballMatchLite[]; onOpen: (id: number) => void; defaultMatchday: number }) {
  const groups = useMemo(() => {
    const map = new Map<number, FootballMatchLite[]>();
    for (const m of matches) {
      const md = m.matchday ?? 0;
      if (!map.has(md)) map.set(md, []);
      map.get(md)!.push(m);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const [picked, setPicked] = useState<number | null>(null);
  const rounds = groups.map(([md]) => md);
  // A WHOLE SEASON IN ONE SCROLL was 380 rows that opened on matchday 1 in August — the one round
  // nobody is looking for. One round at a time, starting at the CURRENT one.
  const active = picked ?? (rounds.includes(defaultMatchday) ? defaultMatchday : rounds[0] ?? 0);
  const shown = groups.find(([md]) => md === active);

  if (!matches.length) return <Empty>No fixtures</Empty>;

  // Cups and group stages carry no matchday — nothing to page through, so show the lot.
  if (rounds.length <= 1) {
    return <RoundSection label="Matches" matches={matches} onOpen={onOpen} />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
          {shown ? `${shown[1].length} ${shown[1].length === 1 ? "match" : "matches"}` : ""}
        </p>
        <FilterSelect
          value={String(active)}
          onChange={(v) => setPicked(Number(v))}
          options={rounds.map((md) => ({ value: String(md), label: md ? `Matchday ${md}` : "Matches" }))}
          size="sm"
          className="w-36"
          aria-label="Matchday"
        />
      </div>
      {shown && <RoundSection label={null} matches={shown[1]} onOpen={onOpen} />}
    </div>
  );
}

function RoundSection({ label, matches, onOpen }: { label: string | null; matches: FootballMatchLite[]; onOpen: (id: number) => void }) {
  return (
    <div>
      {label && <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">{label}</p>}
      {/* The rows live INSIDE one surface. Floating rows on the page background, under a full-width
          grey label bar, was chrome around nothing. */}
      <div className="overflow-hidden rounded-card bg-surface-1">
        {matches.map((m, i) => (
          <MatchRow key={m.external_match_id} m={m} onOpen={onOpen} divided={i > 0} />
        ))}
      </div>
    </div>
  );
}

// ─── Top scorers ──────────────────────────────────────────────────────────────

function ScorersTab({ scorers }: { scorers: Scorer[] }) {
  if (!scorers.length) return <Empty>No scorers yet</Empty>;
  return (
    <div className="overflow-hidden rounded-card bg-surface-1 lg:max-w-2xl">
      {scorers.map((s, i) => (
        <div
          key={`${s.rank}-${s.player_name}`}
          className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border-subtle" : ""}`}
        >
          <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-text-tertiary">{s.rank}</span>
          <div className="relative h-6 w-6 shrink-0">
            <Image src={s.team_crest || CREST_FALLBACK} alt={s.team_name} fill sizes="24px" className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{s.player_name}</p>
            <p className="truncate text-xs text-text-tertiary">{s.team_name}</p>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-accent-sports">{s.goals}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Honours (roll of honour, Wikidata-sourced) ──────────────────────────────────

function HonoursTab({ winners }: { winners: CompetitionWinner[] }) {
  const mostTitles = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of winners) map.set(w.winner_name, (map.get(w.winner_name) ?? 0) + 1);
    return [...map.entries()].map(([name, titles]) => ({ name, titles })).sort((a, b) => b.titles - a.titles);
  }, [winners]);

  if (!winners.length) return <Empty>No honours yet</Empty>;

  const top = mostTitles[0]?.titles ?? 1;

  // Two lists of the same rank → side by side, not stacked down a 1400px page.
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Most titles</p>
        <div className="overflow-hidden rounded-card bg-surface-1">
          {mostTitles.slice(0, 10).map((t, i) => (
            <div key={t.name} className={`relative flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border-subtle" : ""}`}>
              {/* The count is also a BAR. Ten numbers in a column say who won most only after you
                  read them all; a length says it at a glance. */}
              <span className="absolute inset-y-0 left-0 bg-accent-sports/10" style={{ width: `${(t.titles / top) * 100}%` }} />
              <span className="relative w-5 shrink-0 text-center text-sm font-bold tabular-nums text-text-tertiary">{i + 1}</span>
              <span className="relative min-w-0 flex-1 truncate text-sm text-text-primary">{t.name}</span>
              <span className="relative shrink-0 text-sm font-bold tabular-nums text-accent-sports">{t.titles}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Roll of honour</p>
        <div className="max-h-[32rem] overflow-y-auto rounded-card bg-surface-1">
          {winners.map((w, i) => (
            <div key={`${w.season_label ?? w.season_year}-${i}`} className={`flex items-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-border-subtle" : ""}`}>
              <span className="w-16 shrink-0 text-xs tabular-nums text-text-tertiary">
                {w.season_label ?? w.season_year ?? "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{w.winner_name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Match row ──────────────────────────────────────────────────────────────────

function MatchRow({ m, onOpen, divided }: { m: FootballMatchLite; onOpen: (id: number) => void; divided?: boolean }) {
  const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
  return (
    <button
      onClick={() => onOpen(m.external_match_id)}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${divided ? "border-t border-border-subtle" : ""}`}
    >
      <span className="w-11 shrink-0 text-[11px] leading-tight text-text-tertiary">
        <span className="block">{fmtDate(m.utc_date)}</span>
        <span className="block">{fmtTime(m.utc_date)}</span>
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm text-text-primary">{m.home_name}</span>
          <Crest src={m.home_crest} alt={m.home_name} />
        </span>
        <span className="w-12 shrink-0 text-center">
          {finished ? (
            <span className="text-sm font-bold tabular-nums text-text-primary">{m.home_score}–{m.away_score}</span>
          ) : (
            <span className="text-xs font-medium text-text-tertiary">vs</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Crest src={m.away_crest} alt={m.away_name} />
          <span className="truncate text-sm text-text-primary">{m.away_name}</span>
        </span>
      </div>
    </button>
  );
}

function Crest({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative h-5 w-5 shrink-0">
      <Image src={src || CREST_FALLBACK} alt={alt} fill sizes="20px" className="object-contain" />
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card bg-surface-1 py-10 text-center text-sm text-text-tertiary">{children}</p>;
}

// ─── Derivations (pure, from the DB matches) ─────────────────────────────────────

function computeSeason(matches: FootballMatchLite[]): CompetitionSeasonInfo | null {
  if (!matches.length) return null;
  const dates = matches.map((m) => m.utc_date).filter(Boolean).sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const sy = start.slice(0, 4);
  const ey = end.slice(0, 4);
  const label = sy === ey ? sy : `${sy}/${ey}`;

  const finished = matches.filter((m) => m.status === "FINISHED");
  const started = finished.length > 0 || (start ? new Date(start).getTime() <= Date.now() : false);

  const mds = matches.map((m) => m.matchday ?? 0).filter((n) => n > 0);
  const totalMatchdays = mds.length ? Math.max(...mds) : 0;
  const unfinishedMds = matches.filter((m) => m.status !== "FINISHED").map((m) => m.matchday ?? 0).filter((n) => n > 0);
  const currentMatchday = unfinishedMds.length ? Math.min(...unfinishedMds) : totalMatchdays;

  const progress = matches.length ? finished.length / matches.length : 0;
  return { label, start, end, started, currentMatchday, totalMatchdays, progress };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
