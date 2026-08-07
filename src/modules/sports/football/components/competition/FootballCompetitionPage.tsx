"use client";

// The Competition PAGE (route: /perso/sports/football/competition/[id]). Inspired by FlashScore.
// EVERYTHING is derived from the DB matches (football_matches) — season/progress AND the standings
// table — so it's instant and always consistent with what's shown (no stale API season/standings).
// Only Top Scorers still comes from a passthrough route. Match rows open the Match panel.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useCompetition, useCompetitionMatches } from "../../hooks/useFootballCompetition";
import { useScorers } from "../../hooks/useScorers";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { FootballMatchPanel } from "../match/FootballMatchPanel";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite, LiveStanding, Scorer } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";
type Tab = "summary" | "standings" | "fixtures" | "scorers";

const TABS: { key: Tab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "standings", label: "Standings" },
  { key: "fixtures", label: "Fixtures" },
  { key: "scorers", label: "Top Scorers" },
];

interface SeasonInfo {
  label: string;
  start: string;
  end: string;
  started: boolean;
  currentMatchday: number;
  totalMatchdays: number;
  progress: number;
}

export default function FootballCompetitionPage({ id }: { id: string }) {
  const { data: comp } = useCompetition(id);
  const code = comp?.code ?? null;
  const { data: matches } = useCompetitionMatches(id);
  const { data: scorers } = useScorers(code);

  const [tab, setTab] = useState<Tab>("summary");
  const openMatch = useMatchPanel((s) => s.open);

  const season = useMemo(() => computeSeason(matches ?? []), [matches]);
  const standings = useMemo(() => computeStandings(matches ?? []), [matches]);

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
    : comp?.emblem_url;
  const brand = comp?.brand_color ?? null;

  // Off-season: the latest season we have is fully played and the new one isn't published yet (e.g.
  // the UCL draw happens late August). Tell the user instead of silently showing an old season.
  const seasonComplete = (matches?.length ?? 0) > 0 && (matches ?? []).every((m) => m.status === "FINISHED");

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col items-center gap-3 pb-6 text-center">
        <div className="relative h-16 w-16">
          {logo ? (
            <Image src={logo} alt={comp?.name ?? "Competition"} fill sizes="64px" className="object-contain" />
          ) : (
            <div className="h-full w-full rounded-full" style={{ background: brand ?? "var(--color-surface-2)" }} />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">{displayCompetitionName(comp?.name) || "Competition"}</h1>
          {season?.label && <p className="mt-0.5 text-sm text-text-tertiary">{season.label}</p>}
        </div>
        {season && <ProgressBar season={season} brand={brand} />}
      </header>

      {seasonComplete && (
        <div className="mb-5 rounded-card bg-surface-2 px-4 py-2.5 text-center text-xs text-text-secondary">
          Season complete — new season fixtures coming soon.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-border-subtle">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative -mb-px px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "text-accent-sports" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t.label}
            {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent-sports" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "summary" && <SummaryTab matches={matches ?? []} onOpen={openMatch} />}
      {tab === "standings" && <StandingsTab rows={standings} />}
      {tab === "fixtures" && <FixturesTab matches={matches ?? []} onOpen={openMatch} />}
      {tab === "scorers" && <ScorersTab scorers={scorers ?? []} />}

      <FootballMatchPanel />
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ season, brand }: { season: SeasonInfo; brand: string | null }) {
  const fill = brand ?? "var(--color-accent-sports)";
  return (
    <div className="w-full max-w-sm">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-tertiary">
        {season.started ? (
          <>
            <span>Matchday {season.currentMatchday}</span>
            <span>of {season.totalMatchdays}</span>
          </>
        ) : (
          <>
            <span>{fmtDate(season.start)}</span>
            <span>{fmtDate(season.end)}</span>
          </>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${Math.round(season.progress * 100)}%`, background: fill }} />
      </div>
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

  return (
    <div className="flex flex-col gap-5">
      {lastResults.length > 0 && <RoundSection label={`Latest results · Matchday ${lastMd}`} matches={lastResults} onOpen={onOpen} />}
      {nextFixtures.length > 0 && <RoundSection label={`Up next · Matchday ${nextMd}`} matches={nextFixtures} onOpen={onOpen} />}
    </div>
  );
}

// ─── Fixtures (full calendar, grouped by round) ─────────────────────────────────

function FixturesTab({ matches, onOpen }: { matches: FootballMatchLite[]; onOpen: (id: number) => void }) {
  if (!matches.length) return <Empty>No fixtures</Empty>;
  const groups = new Map<number, FootballMatchLite[]>();
  for (const m of matches) {
    const md = m.matchday ?? 0;
    if (!groups.has(md)) groups.set(md, []);
    groups.get(md)!.push(m);
  }
  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([md, ms]) => (
        <RoundSection key={md} label={md ? `Matchday ${md}` : "Matches"} matches={ms} onOpen={onOpen} />
      ))}
    </div>
  );
}

function RoundSection({ label, matches, onOpen }: { label: string; matches: FootballMatchLite[]; onOpen: (id: number) => void }) {
  return (
    <div>
      <div className="mb-2 rounded-control bg-surface-2 px-3 py-1.5">
        <p className="text-caption text-text-secondary">{label}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        {matches.map((m) => (
          <MatchRow key={m.external_match_id} m={m} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

// ─── Standings (computed from the DB matches) ───────────────────────────────────

function StandingsTab({ rows }: { rows: LiveStanding[] }) {
  if (!rows.length) return <Empty>No standings available</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-caption text-text-tertiary">
            <th className="py-2 pl-2 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Team</th>
            <th className="py-2 text-center font-medium">P</th>
            <th className="hidden py-2 text-center font-medium sm:table-cell">W</th>
            <th className="hidden py-2 text-center font-medium sm:table-cell">D</th>
            <th className="hidden py-2 text-center font-medium sm:table-cell">L</th>
            <th className="py-2 text-center font-medium">GD</th>
            <th className="py-2 pr-2 text-center font-semibold text-text-secondary">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_external_id} className="border-t border-border-subtle">
              <td className="py-2 pl-2 tabular-nums text-text-tertiary">{r.position}</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <div className="relative h-5 w-5 shrink-0">
                    <Image src={r.team_crest || CREST_FALLBACK} alt={r.team_name} fill sizes="20px" className="object-contain" />
                  </div>
                  <span className="truncate text-text-primary">{r.team_name}</span>
                </div>
              </td>
              <td className="py-2 text-center tabular-nums text-text-secondary">{r.played}</td>
              <td className="hidden py-2 text-center tabular-nums text-text-tertiary sm:table-cell">{r.won}</td>
              <td className="hidden py-2 text-center tabular-nums text-text-tertiary sm:table-cell">{r.draw}</td>
              <td className="hidden py-2 text-center tabular-nums text-text-tertiary sm:table-cell">{r.lost}</td>
              <td className="py-2 text-center tabular-nums text-text-secondary">{r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}</td>
              <td className="py-2 pr-2 text-center font-bold tabular-nums text-text-primary">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top scorers ──────────────────────────────────────────────────────────────

function ScorersTab({ scorers }: { scorers: Scorer[] }) {
  if (!scorers.length) return <Empty>No scorers yet</Empty>;
  return (
    <div className="flex flex-col gap-1">
      {scorers.map((s) => (
        <div key={`${s.rank}-${s.player_name}`} className="flex items-center gap-3 rounded-control px-2 py-2">
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

// ─── Match row ──────────────────────────────────────────────────────────────────

function MatchRow({ m, onOpen }: { m: FootballMatchLite; onOpen: (id: number) => void }) {
  const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
  return (
    <button
      onClick={() => onOpen(m.external_match_id)}
      className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-2"
    >
      <span className="w-12 shrink-0 text-[11px] leading-tight text-text-tertiary">
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
  return <p className="py-10 text-center text-sm text-text-tertiary">{children}</p>;
}

// ─── Derivations (pure, from the DB matches) ─────────────────────────────────────

function computeSeason(matches: FootballMatchLite[]): SeasonInfo | null {
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

function computeStandings(matches: FootballMatchLite[]): LiveStanding[] {
  type Row = { name: string; crest: string | null; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number };
  const teams = new Map<string, Row>();
  const ensure = (extId: string, name: string, crest: string | null) => {
    if (!teams.has(extId)) teams.set(extId, { name, crest, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    return teams.get(extId)!;
  };
  for (const m of matches) {
    const home = ensure(m.home_external_id, m.home_name, m.home_crest);
    const away = ensure(m.away_external_id, m.away_name, m.away_crest);
    if (m.status !== "FINISHED" || m.home_score == null || m.away_score == null) continue;
    home.p++; away.p++;
    home.gf += m.home_score; home.ga += m.away_score;
    away.gf += m.away_score; away.ga += m.home_score;
    if (m.home_score > m.away_score) { home.w++; home.pts += 3; away.l++; }
    else if (m.home_score < m.away_score) { away.w++; away.pts += 3; home.l++; }
    else { home.d++; away.d++; home.pts++; away.pts++; }
  }
  return [...teams.entries()]
    .map(([extId, t]) => ({
      team_external_id: extId,
      team_name: t.name,
      team_crest: t.crest,
      played: t.p, won: t.w, draw: t.d, lost: t.l,
      goal_difference: t.gf - t.ga,
      points: t.pts,
      position: 0,
    }))
    .sort((a, b) => b.points - a.points || b.goal_difference - a.goal_difference || a.team_name.localeCompare(b.team_name))
    .map((r, i) => ({ ...r, position: i + 1 }));
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
