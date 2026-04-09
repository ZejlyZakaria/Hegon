/* eslint-disable @typescript-eslint/no-explicit-any */

import { cache } from "react";
import { createServerClient } from "@/infrastructure/supabase/server";
import { getNextRace } from "@/modules/sports/f1/service";
import { getFootballTeams, getCrestsByExternalIds } from "@/modules/sports/football/service";
import { getTennisPlayers } from "@/modules/sports/tennis/service";
import type { DashboardSportEvent, DashboardMedia, DashboardTask, DashboardData } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / 86400000);
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (days <= 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `In ${days} days · ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function formatTournamentDate(start: string, end: string | null): string {
  const s = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

function pickPriorityTask(tasks: DashboardTask[]): DashboardTask | null {
  if (!tasks.length) return null;
  return [...tasks].sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] ?? 4;
    const pB = PRIORITY_ORDER[b.priority] ?? 4;
    if (pA !== pB) return pA - pB;
    if (a.due_date && b.due_date)
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    return 0;
  })[0];
}

function getTodayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ─── Today tasks (server-side) ────────────────────────────────────────────────

export const getTodayTasksServer = cache(async (userId: string): Promise<DashboardTask[]> => {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("tasks")
    .select(`
      id, title, priority, due_date,
      status:statuses(name, color, is_completed),
      project:projects(name)
    `)
    .eq("created_by", userId)
    .eq("is_archived", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);

  return ((data ?? []) as any[])
    .filter((t) => !t.status?.is_completed)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: (t.priority ?? "medium").toLowerCase(),
      due_date: t.due_date,
      project_name: t.project?.name ?? "Unknown",
      status_name: t.status?.name ?? "",
      status_color: t.status?.color ?? null,
      is_completed: t.status?.is_completed ?? false,
    }));
});

// ─── In-progress media (server-side) ──────────────────────────────────────────

export const getInProgressMediaServer = cache(async (userId: string): Promise<DashboardMedia[]> => {
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, title, type, poster_url, backdrop_url, current_episode, current_season, episodes, season_episodes")
    .eq("user_id", userId)
    .eq("in_progress", true)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!data?.length) return [];

  return data.slice(0, 3);
});

// ─── Today football events (main team first) ──────────────────────────────────

export const getTodayFootballEvents = cache(async (userId: string): Promise<DashboardSportEvent[]> => {
  const supabase = await createServerClient();
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, allTeams, mainTeamId } = teams;

  if (!allFavoriteTeamIds.length) return [];

  const { start, end } = getTodayRange();

  const { data } = await supabase
    .schema("sport")
    .from("football_next_matches")
    .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions(name)")
    .in("team_id", allFavoriteTeamIds)
    .gte("match_date", start.toISOString())
    .lte("match_date", end.toISOString())
    .order("match_date", { ascending: true });

  if (!data?.length) return [];

  // Deduplicate: same match can appear for multiple followed teams
  const matchMap = new Map<string, { match: any; isMainTeam: boolean }>();
  for (const m of data as any[]) {
    const key = `${m.home_team_name}-${m.away_team_name}-${m.match_date}`;
    if (!matchMap.has(key)) {
      matchMap.set(key, { match: m, isMainTeam: m.team_id === mainTeamId });
    } else if (m.team_id === mainTeamId) {
      matchMap.get(key)!.isMainTeam = true;
    }
  }

  const unique = [...matchMap.values()];

  const externalIds = [...new Set([
    ...unique.map(({ match: m }) => m.home_team_external_id),
    ...unique.map(({ match: m }) => m.away_team_external_id),
  ].filter(Boolean))];

  const crestMap = await getCrestsByExternalIds(externalIds);

  const events: DashboardSportEvent[] = unique.map(({ match: m, isMainTeam }) => {
    const comp = m.football_competitions as any;
    return {
      type: "football" as const,
      title: `${m.home_team_name} vs ${m.away_team_name}`,
      subtitle: formatEventDate(m.match_date),
      date: m.match_date,
      badge: "FOOTBALL",
      href: "/perso/sports/football",
      homeTeam: m.home_team_name,
      awayTeam: m.away_team_name,
      homeTeamCrest: crestMap[m.home_team_external_id] ?? null,
      awayTeamCrest: crestMap[m.away_team_external_id] ?? null,
      competition: comp?.name ?? null,
      isMainTeam,
    };
  });

  // Main team always first, then by time
  return events.sort((a, b) => {
    if (a.isMainTeam && !b.isMainTeam) return -1;
    if (!a.isMainTeam && b.isMainTeam) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
});

// ─── Today tennis match events (favorite players) ─────────────────────────────

export const getTodayTennisEvents = cache(async (userId: string): Promise<DashboardSportEvent[]> => {
  const supabase = await createServerClient();
  const { favoritePlayers, favoritePlayerIds } = await getTennisPlayers(userId);

  if (!favoritePlayerIds.length) return [];

  // Use date-only string (YYYY-MM-DD) to avoid timezone mismatches
  const todayStr = new Date().toLocaleDateString("en-CA"); // "2026-04-08"

  const { data: matches } = await supabase
    .schema("sport")
    .from("tennis_matches")
    .select("player_id, tournament_id, match_date, opponent_name, round")
    .in("player_id", favoritePlayerIds)
    .eq("status", "scheduled")
    .gte("match_date", todayStr)
    .lte("match_date", `${todayStr}T23:59:59`)
    .order("match_date", { ascending: true });

  if (!matches?.length) return [];

  // Fetch tournament names
  const tournamentIds = [...new Set((matches as any[]).map((m) => m.tournament_id).filter(Boolean))];
  const { data: tournaments } = tournamentIds.length
    ? await supabase.schema("sport").from("tennis_tournaments").select("id, name, surface").in("id", tournamentIds)
    : { data: [] };

  const tournamentMap: Record<string, any> = {};
  for (const t of tournaments ?? []) tournamentMap[t.id] = t;

  const playerMap: Record<string, any> = {};
  for (const p of favoritePlayers) playerMap[p.id] = p;

  return (matches as any[])
    .filter((m) => m.match_date && playerMap[m.player_id])
    .map((m) => {
      const player = playerMap[m.player_id];
      const tournament = tournamentMap[m.tournament_id] ?? null;
      return {
        type: "tennis" as const,
        title: `${player.name} vs ${m.opponent_name ?? "TBD"}`,
        subtitle: formatEventDate(m.match_date),
        date: m.match_date,
        badge: "TENNIS",
        href: "/perso/sports/tennis",
        playerName: player.name,
        playerPhotoUrl: player.photo_url ?? null,
        opponentName: m.opponent_name ?? "TBD",
        round: m.round ?? null,
        tournamentName: tournament?.name ?? null,
        surface: tournament?.surface ?? null,
      };
    });
});

// ─── Upcoming football events (for Upcoming Sports section) ───────────────────

export const getNextFootballEvents = cache(async (userId: string): Promise<DashboardSportEvent[]> => {
  const supabase = await createServerClient();
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, allTeams } = teams;

  if (!allFavoriteTeamIds.length) return [];

  // Fetch matches starting tomorrow+ (today's matches are in Today section)
  const tomorrowStart = new Date();
  tomorrowStart.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .schema("sport")
    .from("football_next_matches")
    .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions(name)")
    .in("team_id", allFavoriteTeamIds)
    .gt("match_date", tomorrowStart.toISOString())
    .order("match_date", { ascending: true })
    .limit(2);

  if (!data?.length) return [];

  const externalIds = [...new Set([
    ...(data).map((m: any) => m.home_team_external_id),
    ...(data).map((m: any) => m.away_team_external_id),
  ].filter(Boolean))];

  const crestMap = await getCrestsByExternalIds(externalIds);

  return (data as any[]).map((m) => {
    const followedTeam = allTeams[m.team_id];
    const comp = m.football_competitions as any;
    return {
      type: "football" as const,
      title: `${m.home_team_name} vs ${m.away_team_name}`,
      subtitle: formatEventDate(m.match_date),
      date: m.match_date,
      badge: "FOOTBALL",
      href: "/perso/sports/football",
      homeTeam: m.home_team_name,
      awayTeam: m.away_team_name,
      homeTeamCrest: crestMap[m.home_team_external_id] ?? null,
      awayTeamCrest: crestMap[m.away_team_external_id] ?? null,
      competition: comp?.name ?? null,
      _followedTeamName: followedTeam?.name ?? null,
    };
  });
});

export const getNextF1Event = cache(async (): Promise<DashboardSportEvent | null> => {
  const race = await getNextRace();
  if (!race) return null;

  const circuit = race.f1_circuits as any;
  return {
    type: "f1",
    title: race.race_name,
    subtitle: formatEventDate(race.race_date),
    date: race.race_date,
    badge: "RACING",
    href: "/perso/sports/f1",
    circuit: circuit?.circuit_name ?? null,
    country: circuit?.country ?? null,
  };
});

export const getNextTennisEvent = cache(async (): Promise<DashboardSportEvent | null> => {
  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .schema("sport")
    .from("tennis_tournaments")
    .select("id, name, surface, start_date, end_date, country")
    .gte("end_date", now.slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    type: "tennis",
    title: data.name,
    subtitle: formatTournamentDate(data.start_date, data.end_date),
    date: data.start_date,
    badge: "TENNIS",
    href: "/perso/sports/tennis",
    surface: data.surface ?? null,
    location: data.country ?? null,
    endDate: data.end_date ?? null,
  };
});

// ─── Main aggregator ──────────────────────────────────────────────────────────

export const getDashboardData = cache(async (userId: string): Promise<DashboardData> => {
  const [
    tasks,
    inProgressMediaList,
    todayFootballEvents,
    todayTennisEvents,
    upcomingFootballEvents,
    f1Event,
    nextTennisEvent,
  ] = await Promise.all([
    getTodayTasksServer(userId),
    getInProgressMediaServer(userId),
    getTodayFootballEvents(userId),
    getTodayTennisEvents(userId),
    getNextFootballEvents(userId),
    getNextF1Event(),
    getNextTennisEvent(),
  ]);

  const { start: todayStart, end: todayEnd } = getTodayRange();

  // F1 today?
  const todayF1Event = f1Event && new Date(f1Event.date) >= todayStart && new Date(f1Event.date) <= todayEnd
    ? f1Event
    : null;

  // Upcoming Sports section: future events (football + f1 + tennis tournament)
  const allUpcoming: DashboardSportEvent[] = [
    ...upcomingFootballEvents,
    f1Event,
    nextTennisEvent,
  ].filter((e): e is DashboardSportEvent => e !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Exclude today's events (already shown in Today section) — keep tomorrow+
  // Exception: tennis tournaments use endDate (multi-day), keep if still ongoing
  const futureEvents = allUpcoming.filter((e) => {
    if (e.endDate) return new Date(e.endDate) >= todayStart; // tennis tournament: keep if ongoing
    return new Date(e.date) > todayEnd; // football/f1: only tomorrow+
  });

  // todaySportEvents kept for Upcoming Sports section compat
  const todaySportEvents: DashboardSportEvent[] = [
    ...todayFootballEvents,
    ...todayTennisEvents,
    ...(todayF1Event ? [todayF1Event] : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    tasks,
    priorityTask: pickPriorityTask(tasks),
    inProgressMedia: inProgressMediaList[0] ?? null,
    inProgressMediaList,
    todayFootballEvents,
    todayTennisEvents,
    todayF1Event,
    todaySportEvents,
    sportEvents: futureEvents,
    upNextEvent: futureEvents[0] ?? null,
  };
});
