// Remaining `any` casts are isolated to Supabase nested join inference (cf. audit §4.1).
// Each is annotated with an inline eslint-disable-next-line.
import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentUserId } from "@/shared/utils/getCurrentUserId";
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

const PARIS_TZ = "Europe/Paris";

// Returns today and tomorrow date strings (YYYY-MM-DD) in Paris timezone
function getParisDateStrings(): { today: string; tomorrow: string } {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1))
    .toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
  return { today, tomorrow };
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: PARIS_TZ });

  const dateParisStr = date.toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
  const { today, tomorrow } = getParisDateStrings();

  if (dateParisStr === today) return `Today · ${time}`;
  if (dateParisStr === tomorrow) return `Tomorrow · ${time}`;

  // Use calendar-day diff via Paris date strings (not wall-clock ms) to avoid DST glitch §1.7
  const days = Math.round(
    (new Date(dateParisStr).getTime() - new Date(today).getTime()) / 86400000
  );
  return `In ${days} days · ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PARIS_TZ })}`;
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
  const now = new Date();
  const { today } = getParisDateStrings();

  // Compute Paris UTC offset in ms (handles DST automatically)
  const parisNow = new Date(now.toLocaleString("en-US", { timeZone: PARIS_TZ }));
  const utcNow = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = parisNow.getTime() - utcNow.getTime();

  // Midnight Paris in UTC = midnight UTC minus offset
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setTime(start.getTime() - offsetMs);

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

// ─── Today tasks (server-side) ────────────────────────────────────────────────

export async function getTodayTasks(userId: string): Promise<DashboardTask[]> {
  const supabase = createClient();

  // Inner join + server-side filter on statuses.is_completed: avoids fetching
  // 50 tasks then dropping the completed ones client-side (could lose visible
  // tasks if the user has many completed ones). Audit §3.4.
  // Order by priority_rank first so CRITICAL tasks without due_date are never pushed past LIMIT 50 (§1.5)
  const { data } = await supabase
    .from("tasks")
    .select(`
      id, title, priority, due_date,
      status:statuses!inner(name, color, is_completed),
      project:projects(name)
    `)
    .or(`created_by.eq.${userId},assignee_id.eq.${userId}`)
    .eq("is_archived", false)
    .eq("statuses.is_completed", false)
    .order("priority_rank", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase nested join inference fails on status + project
  return ((data ?? []) as any[]).map((t) => ({
    id: t.id,
    title: t.title,
    priority: (t.priority ?? "medium").toLowerCase(),
    due_date: t.due_date,
    project_name: t.project?.name ?? "Unknown",
    status_name: t.status?.name ?? "",
    status_color: t.status?.color ?? null,
    is_completed: false,
  }));
}

// ─── In-progress media ────────────────────────────────────────────────────────

export async function getInProgressMedia(userId: string): Promise<DashboardMedia[]> {
  const supabase = createClient();

  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, title, type, poster_url, backdrop_url, current_episode, current_season, episodes, season_episodes")
    .eq("user_id", userId)
    .eq("in_progress", true)
    .order("updated_at", { ascending: false })
    .limit(3);

  if (!data?.length) return [];

  return data;
}

// ─── Today football events (main team first) ──────────────────────────────────

export async function getTodayFootballEvents(userId: string): Promise<DashboardSportEvent[]> {
  const supabase = createClient();
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, mainTeamId } = teams;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase match row shape varies with joins
  const matchMap = new Map<string, { match: any; isMainTeam: boolean }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase select() with joins doesn't propagate types
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase nested join
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
}

// ─── Today tennis match events (favorite players) ─────────────────────────────

export async function getTodayTennisEvents(userId: string): Promise<DashboardSportEvent[]> {
  const supabase = createClient();
  const { favoritePlayers, favoritePlayerIds } = await getTennisPlayers(userId);

  if (!favoritePlayerIds.length) return [];

  // Use Paris timezone for today's date string
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: PARIS_TZ });

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase select row shape
  const tournamentIds = [...new Set((matches as any[]).map((m) => m.tournament_id).filter(Boolean))];
  const { data: tournaments } = tournamentIds.length
    ? await supabase.schema("sport").from("tennis_tournaments").select("id, name, surface").in("id", tournamentIds)
    : { data: [] };

  type TournamentRow = { id: string; name: string; surface: string | null };
  type PlayerRow = { id: string; name: string; photo_url: string | null };
  const tournamentMap: Record<string, TournamentRow> = {};
  for (const t of (tournaments ?? []) as TournamentRow[]) tournamentMap[t.id] = t;

  const playerMap: Record<string, PlayerRow> = {};
  for (const p of favoritePlayers as PlayerRow[]) playerMap[p.id] = p;

  // Deduplicate favorites duels: same match_date = same match between two favorites
  const processedDuelKeys = new Set<string>();
  const events: DashboardSportEvent[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase select row shape
  for (const m of matches as any[]) {
    if (!m.match_date || !playerMap[m.player_id]) continue;

    const opponentFavorite = (matches as { player_id: string; match_date: string | null }[]).find(
      (other) => other.player_id !== m.player_id && other.match_date === m.match_date
    );

    if (opponentFavorite) {
      const duelKey = [m.player_id, opponentFavorite.player_id].sort().join(":");
      if (processedDuelKeys.has(duelKey)) continue;
      processedDuelKeys.add(duelKey);
    }

    const player = playerMap[m.player_id];
    const tournament = tournamentMap[m.tournament_id] ?? null;
    events.push({
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
    });
  }

  return events;
}

// ─── Upcoming football events (for Upcoming Sports section) ───────────────────

export async function getNextFootballEvents(userId: string): Promise<DashboardSportEvent[]> {
  const supabase = createClient();
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, allTeams } = teams;

  if (!allFavoriteTeamIds.length) return [];

  // Fetch matches starting after today Paris time (today's matches are in Today section)
  const { end: todayEnd } = getTodayRange();
  const tomorrowStart = new Date(todayEnd.getTime() + 1);

  const { data } = await supabase
    .schema("sport")
    .from("football_next_matches")
    .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions(name)")
    .in("team_id", allFavoriteTeamIds)
    .gt("match_date", tomorrowStart.toISOString())
    .order("match_date", { ascending: true })
    .limit(2);

  if (!data?.length) return [];

  type FootballMatchRow = { team_id: string; home_team_name: string; away_team_name: string; home_team_external_id: string | null; away_team_external_id: string | null; match_date: string; football_competitions: { name: string | null } | null };
  const matchRows = data as unknown as FootballMatchRow[];
  const externalIds = [...new Set([
    ...matchRows.map((m) => m.home_team_external_id),
    ...matchRows.map((m) => m.away_team_external_id),
  ].filter((x): x is string => !!x))];

  const crestMap = await getCrestsByExternalIds(externalIds);

  return matchRows.map((m) => {
    const followedTeam = allTeams[m.team_id];
    const comp = m.football_competitions;
    return {
      type: "football" as const,
      title: `${m.home_team_name} vs ${m.away_team_name}`,
      subtitle: formatEventDate(m.match_date),
      date: m.match_date,
      badge: "FOOTBALL",
      href: "/perso/sports/football",
      homeTeam: m.home_team_name,
      awayTeam: m.away_team_name,
      homeTeamCrest: m.home_team_external_id ? (crestMap[m.home_team_external_id] ?? null) : null,
      awayTeamCrest: m.away_team_external_id ? (crestMap[m.away_team_external_id] ?? null) : null,
      competition: comp?.name ?? null,
      _followedTeamName: followedTeam?.name ?? null,
    };
  });
}

export async function getNextF1Event(): Promise<DashboardSportEvent | null> {
  const race = await getNextRace();
  if (!race) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase nested join (f1_circuits)
  const circuit = race.f1_circuits as any;
  const raceTime = race.race_time as string | null;
  const raceDateTime = raceTime
    ? `${race.race_date}T${raceTime.endsWith("Z") || raceTime.includes("+") ? raceTime : raceTime + "Z"}`
    : race.race_date;

  return {
    type: "f1",
    title: race.race_name,
    subtitle: formatEventDate(raceDateTime),
    date: raceDateTime,
    badge: "RACING",
    href: "/perso/sports/f1",
    circuit: circuit?.circuit_name ?? null,
    country: circuit?.country ?? null,
  };
}

export async function getNextTennisEvent(): Promise<DashboardSportEvent | null> {
  const supabase = createClient();
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
}

// ─── Task activity per day (for WeeklyActivity chart) ────────────────────────

export async function getTasksActivityByDay(
  fromDate: string,
  toDate: string
): Promise<Record<string, { completed: number; total: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return {};

  const supabase = createClient();

  const { data } = await supabase
    .from("tasks")
    .select("due_date, status:statuses(is_completed)")
    .or(`created_by.eq.${userId},assignee_id.eq.${userId}`)
    .eq("is_archived", false)
    .gte("due_date", fromDate)
    .lte("due_date", toDate);

  const result: Record<string, { completed: number; total: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase nested join (status:statuses)
  for (const t of (data ?? []) as any[]) {
    const date = t.due_date?.slice(0, 10);
    if (!date) continue;
    if (!result[date]) result[date] = { completed: 0, total: 0 };
    result[date].total++;
    if (t.status?.is_completed) result[date].completed++;
  }
  return result;
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  // allSettled so one failing section (e.g. sport API down) doesn't crash the whole dashboard (§4.8)
  const [
    tasksResult,
    mediaResult,
    todayFootballResult,
    todayTennisResult,
    upcomingFootballResult,
    f1Result,
    nextTennisResult,
  ] = await Promise.allSettled([
    getTodayTasks(userId),
    getInProgressMedia(userId),
    getTodayFootballEvents(userId),
    getTodayTennisEvents(userId),
    getNextFootballEvents(userId),
    getNextF1Event(),
    getNextTennisEvent(),
  ]);

  const SECTION_NAMES = ["tasks", "media", "todayFootball", "todayTennis", "upcomingFootball", "f1", "nextTennis"];
  [tasksResult, mediaResult, todayFootballResult, todayTennisResult, upcomingFootballResult, f1Result, nextTennisResult]
    .forEach((r, i) => { if (r.status === "rejected") console.error(`[getDashboardData] ${SECTION_NAMES[i]} failed:`, r.reason); });

  const tasks               = tasksResult.status          === "fulfilled" ? tasksResult.value          : [];
  const inProgressMediaList = mediaResult.status          === "fulfilled" ? mediaResult.value          : [];
  const todayFootballEvents = todayFootballResult.status  === "fulfilled" ? todayFootballResult.value  : [];
  const todayTennisEvents   = todayTennisResult.status    === "fulfilled" ? todayTennisResult.value    : [];
  const upcomingFootballEvents = upcomingFootballResult.status === "fulfilled" ? upcomingFootballResult.value : [];
  const f1Event             = f1Result.status             === "fulfilled" ? f1Result.value             : null;
  const nextTennisEvent     = nextTennisResult.status     === "fulfilled" ? nextTennisResult.value     : null;

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
}
