"use client";

// The Team PAGE (route: /perso/sports/football/team/[externalId]). Everything is derived from the
// team's stored matches (football_matches) — deep stats with zero extra API. Season selector on top.
// Layers: the World (match-derived stats) + You (Fan Log record). Match rows open the Match panel.

import { useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, CalendarDays, Flag, Star, Check, Plus, Loader2 } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useTeam, useTeamMatches } from "../../hooks/useFootballTeamPage";
import { useFootballTeams, useFollowTeam, useUnfollowTeam } from "../../hooks/useFootballTeams";
import { useTeamPersonalStats } from "../../hooks/useTeamPersonalStats";
import { useMatchPanel } from "../../hooks/useMatchPanelStore";
import { FootballMatchPanel } from "../match/FootballMatchPanel";
import { displayCompetitionName } from "../../service";
import type { FootballMatchLite, FootballTeamFull } from "../../service";

const CREST_FALLBACK = "/placeholder-logo.svg";

const seasonLabel = (s: number) => `${s}/${s + 1}`;

export default function FootballTeamPage({ externalId }: { externalId: string }) {
  const userId = useCurrentUserId();
  const { data: team } = useTeam(externalId);
  const { data: matches } = useTeamMatches(externalId);
  const { data: personal } = useTeamPersonalStats(userId, externalId);
  const openMatch = useMatchPanel((s) => s.open);

  const seasons = useMemo(() => {
    const set = new Set<number>();
    for (const m of matches ?? []) if (m.season != null) set.add(m.season);
    return [...set].sort((a, b) => b - a);
  }, [matches]);

  const [season, setSeason] = useState<number | null>(null);
  const activeSeason = season ?? seasons[0] ?? null;

  const seasonMatches = useMemo(
    () => (matches ?? []).filter((m) => activeSeason == null || m.season === activeSeason),
    [matches, activeSeason],
  );
  const finished = seasonMatches.filter((m) => m.status === "FINISHED" && m.home_score != null && m.away_score != null);
  const upcoming = seasonMatches.filter((m) => m.status !== "FINISHED");
  const stats = useMemo(() => computeTeamStats(finished, externalId), [finished, externalId]);
  const form = finished.slice(-5).map((m) => resultFor(m, externalId));
  const nextMatch = upcoming[0] ?? null;
  const recent = [...finished].slice(-5).reverse();
  const byComp = useMemo(() => computeByCompetition(finished, externalId), [finished, externalId]);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <header className="mb-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0">
            <Image src={team?.crest_url || CREST_FALLBACK} alt={team?.name ?? "Team"} fill sizes="80px" className="object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{team?.name ?? "Team"}</h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-text-tertiary sm:justify-start">
              {team?.country && <span className="inline-flex items-center gap-1"><Flag size={11} />{team.country}</span>}
              {team?.venue && <span className="inline-flex items-center gap-1"><MapPin size={11} />{team.venue}</span>}
              {team?.founded && <span className="inline-flex items-center gap-1"><CalendarDays size={11} />Est. {team.founded}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {team && <FollowButton userId={userId} team={team} />}
          {seasons.length > 0 && (
            <select
              value={activeSeason ?? ""}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="h-8 rounded-control border border-border-subtle bg-surface-2 px-2 text-xs font-semibold text-text-secondary outline-none"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>{seasonLabel(s)}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Your record */}
      <section className="mb-4 rounded-card bg-surface-2 p-4">
        <p className="text-caption mb-3 text-text-tertiary">Your record</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={personal?.watchedCount ?? 0} label="Watched" />
          <Stat value={personal?.stadiumCount ?? 0} label="At stadium" />
          <Stat value={personal?.avgRating != null ? personal.avgRating.toFixed(1) : "—"} label="Avg rating" />
        </div>
      </section>

      {/* Season stats */}
      <section className="mb-4 rounded-card bg-surface-2 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-caption text-text-tertiary">Season {activeSeason ? seasonLabel(activeSeason) : ""}</p>
          {form.length > 0 && (
            <div className="flex items-center gap-1">
              {form.map((r, i) => <FormDot key={i} r={r} />)}
            </div>
          )}
        </div>
        {stats.p === 0 ? (
          <p className="py-2 text-sm text-text-tertiary">No matches played yet this season.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Stat value={stats.p} label="Played" />
            <Stat value={`${stats.w}-${stats.d}-${stats.l}`} label="W-D-L" />
            <Stat value={`${stats.winPct}%`} label="Win rate" accent />
            <Stat value={`${stats.gf}:${stats.ga}`} label="Goals" />
            <Stat value={stats.gd > 0 ? `+${stats.gd}` : stats.gd} label="Diff" />
            <Stat value={stats.cs} label="Clean sheets" />
          </div>
        )}
      </section>

      {/* Home / Away */}
      {stats.p > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <SplitCard title="Home" s={stats.home} />
          <SplitCard title="Away" s={stats.away} />
        </div>
      )}

      {/* By competition */}
      {byComp.length > 0 && (
        <section className="mb-4 rounded-card bg-surface-2 p-4">
          <p className="text-caption mb-3 text-text-tertiary">By competition</p>
          <div className="flex flex-col gap-2">
            {byComp.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                {c.emblem && (
                  <span className="relative h-5 w-5 shrink-0"><Image src={c.emblem} alt={c.name} fill sizes="20px" className="object-contain" /></span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{displayCompetitionName(c.name)}</span>
                <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{c.p}P</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-text-secondary">{c.w}W {c.d}D {c.l}L</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Next + Recent */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-card bg-surface-2 p-4">
          <p className="text-caption mb-3 text-text-tertiary">Next match</p>
          {nextMatch ? <MatchMini m={nextMatch} ext={externalId} onOpen={openMatch} /> : <p className="text-sm text-text-tertiary">No upcoming match</p>}
        </section>
        <section className="rounded-card bg-surface-2 p-4">
          <p className="text-caption mb-3 text-text-tertiary">Recent results</p>
          {recent.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recent.map((m) => <MatchMini key={m.external_match_id} m={m} ext={externalId} onOpen={openMatch} />)}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">No recent results</p>
          )}
        </section>
      </div>

      <FootballMatchPanel />
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────────────

// Follow / Following toggle (1st axis — user_favorites). The main team is shown as a non-clickable
// badge: unfollowing wouldn't clear football_user_settings.main_team_id, so we don't offer it here.
function FollowButton({ userId, team }: { userId: string | null; team: FootballTeamFull }) {
  const { data: teams } = useFootballTeams(userId);
  const follow = useFollowTeam(userId);
  const unfollow = useUnfollowTeam(userId);

  const isMain = teams?.mainTeamId != null && team.id === teams.mainTeamId;
  const isFollowing = (teams?.allFavoriteTeamIds ?? []).includes(team.id);
  const pending = follow.isPending || unfollow.isPending;

  if (isMain) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent-sports/15 px-3 text-xs font-semibold text-accent-sports">
        <Star size={13} className="fill-accent-sports" />
        Main team
      </span>
    );
  }

  const onClick = () => {
    if (pending || !userId) return;
    if (isFollowing) unfollow.mutate(team.id);
    else follow.mutate({ teamId: team.id, apiExternalId: team.api_external_id });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending || !userId}
      className={`group inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
        isFollowing
          ? "bg-surface-2 text-text-secondary hover:bg-red-500/15 hover:text-red-400"
          : "bg-accent-sports text-black hover:bg-accent-sports/90"
      }`}
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isFollowing ? (
        <Check size={13} className="group-hover:hidden" />
      ) : (
        <Plus size={13} />
      )}
      <span>{isFollowing ? <><span className="group-hover:hidden">Following</span><span className="hidden group-hover:inline">Unfollow</span></> : "Follow"}</span>
    </button>
  );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-bold tabular-nums ${accent ? "text-accent-sports" : "text-text-primary"}`}>{value}</span>
      <span className="text-[10px] text-text-tertiary">{label}</span>
    </div>
  );
}

function SplitCard({ title, s }: { title: string; s: { p: number; w: number; d: number; l: number } }) {
  return (
    <div className="rounded-card bg-surface-2 p-4">
      <p className="text-caption mb-2 text-text-tertiary">{title}</p>
      {s.p === 0 ? (
        <p className="text-sm text-text-tertiary">—</p>
      ) : (
        <p className="text-sm text-text-primary">
          <span className="font-bold tabular-nums">{s.p}</span> played ·{" "}
          <span className="font-semibold tabular-nums">{s.w}W {s.d}D {s.l}L</span>
        </p>
      )}
    </div>
  );
}

function FormDot({ r }: { r: "W" | "D" | "L" }) {
  const map = { W: "bg-accent-sports text-black", D: "bg-zinc-600 text-white", L: "bg-red-500 text-white" } as const;
  return <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${map[r]}`}>{r}</span>;
}

function MatchMini({ m, ext, onOpen }: { m: FootballMatchLite; ext: string; onOpen: (id: number) => void }) {
  const isHome = m.home_external_id === ext;
  const oppName = isHome ? m.away_name : m.home_name;
  const oppCrest = isHome ? m.away_crest : m.home_crest;
  const finished = m.status === "FINISHED" && m.home_score != null && m.away_score != null;
  return (
    <button onClick={() => onOpen(m.external_match_id)} className="flex w-full items-center gap-2.5 rounded-control px-1 py-1.5 text-left transition-colors hover:bg-white/5">
      <span className="relative h-6 w-6 shrink-0"><Image src={oppCrest || CREST_FALLBACK} alt={oppName} fill sizes="24px" className="object-contain" /></span>
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{oppName}</span>
      <span className="shrink-0 text-[10px] text-text-tertiary">{isHome ? "H" : "A"}</span>
      {finished ? (
        <span className="shrink-0 text-sm font-bold tabular-nums text-text-primary">{m.home_score}–{m.away_score}</span>
      ) : (
        <span className="shrink-0 text-xs text-text-tertiary">{fmtDate(m.utc_date)}</span>
      )}
    </button>
  );
}

// ─── Derivations ─────────────────────────────────────────────────────────────────

function resultFor(m: FootballMatchLite, ext: string): "W" | "D" | "L" {
  const isHome = m.home_external_id === ext;
  const gf = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
  const ga = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0);
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}

function computeTeamStats(finished: FootballMatchLite[], ext: string) {
  const acc = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, home: { p: 0, w: 0, d: 0, l: 0 }, away: { p: 0, w: 0, d: 0, l: 0 } };
  for (const m of finished) {
    const isHome = m.home_external_id === ext;
    const gf = isHome ? m.home_score! : m.away_score!;
    const ga = isHome ? m.away_score! : m.home_score!;
    acc.p++; acc.gf += gf; acc.ga += ga;
    if (ga === 0) acc.cs++;
    const res = gf > ga ? "w" : gf < ga ? "l" : "d";
    acc[res]++;
    const split = isHome ? acc.home : acc.away;
    split.p++; split[res]++;
  }
  return { ...acc, gd: acc.gf - acc.ga, winPct: acc.p ? Math.round((acc.w / acc.p) * 100) : 0 };
}

function computeByCompetition(finished: FootballMatchLite[], ext: string) {
  const map = new Map<string, { name: string; emblem: string | null; p: number; w: number; d: number; l: number }>();
  for (const m of finished) {
    const name = m.competition_name ?? "Other";
    if (!map.has(name)) map.set(name, { name, emblem: m.emblem_url, p: 0, w: 0, d: 0, l: 0 });
    const c = map.get(name)!;
    c.p++;
    const r = resultFor(m, ext);
    if (r === "W") c.w++; else if (r === "D") c.d++; else c.l++;
  }
  return [...map.values()].sort((a, b) => b.p - a.p);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
