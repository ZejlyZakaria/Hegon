/* eslint-disable @typescript-eslint/no-explicit-any */

import { cache } from "react";
import { createServerClient } from "@/infrastructure/supabase/server";
import { getNextRace } from "@/modules/sports/f1/service";
import { getFootballTeams, getCrestsByExternalIds } from "@/modules/sports/football/service";
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

// ─── Today tasks (server-side) ────────────────────────────────────────────────

export const getTodayTasksServer = cache(async (userId: string): Promise<DashboardTask[]> => {
  const supabase = await createServerClient();

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from("tasks")
    .select(`
      id, title, priority, due_date,
      status:statuses(name, color, is_completed),
      project:projects(name)
    `)
    .eq("created_by", userId)
    .eq("is_archived", false)
    .lte("due_date", todayEnd.toISOString())
    .order("due_date", { ascending: true })
    .limit(15);

  return ((data ?? []) as any[])
    .filter((t) => !t.status?.is_completed)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority ?? "medium",
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

// ─── Sport events (server-side) ───────────────────────────────────────────────

export const getNextFootballEvents = cache(async (userId: string): Promise<DashboardSportEvent[]> => {
  const supabase = await createServerClient();
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, allTeams } = teams;

  if (!allFavoriteTeamIds.length) return [];

  const { data } = await supabase
    .schema("sport")
    .from("football_next_matches")
    .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions(name)")
    .in("team_id", allFavoriteTeamIds)
    .gt("match_date", new Date().toISOString())
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
  const [tasks, inProgressMediaList, footballEvents, f1Event, tennisEvent] = await Promise.all([
    getTodayTasksServer(userId),
    getInProgressMediaServer(userId),
    getNextFootballEvents(userId),
    getNextF1Event(),
    getNextTennisEvent(),
  ]);

  const allEvents: DashboardSportEvent[] = [
    ...footballEvents,
    f1Event,
    tennisEvent,
  ]
    .filter((e): e is DashboardSportEvent => e !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todaySportEvents = allEvents.filter((e) => {
    const d = new Date(e.date);
    return d >= todayStart && d <= todayEnd;
  });

  const futureEvents = allEvents.filter((e) => {
    // For multi-day events (tennis), use endDate to keep ongoing tournaments visible
    const relevant = e.endDate ? new Date(e.endDate) : new Date(e.date);
    return relevant >= todayStart;
  });

  return {
    tasks,
    inProgressMedia: inProgressMediaList[0] ?? null,
    inProgressMediaList,
    todaySportEvents,
    sportEvents: futureEvents,
    upNextEvent: futureEvents[0] ?? null,
    priorityTask: pickPriorityTask(tasks),
  };
});
