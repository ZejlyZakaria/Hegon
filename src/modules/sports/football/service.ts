/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import type { FootballTeams, FootballTeam, FootballMatchRow, FootballFanLogEntry, FanLogInput, FootballPrediction } from "./types";

// =====================================================
// FOOTBALL SERVICE
// =====================================================

export async function getFootballTeams(userId: string): Promise<FootballTeams> {
  const supabase = createClient();

  const [{ data: settings }, { data: favorites }] = await Promise.all([
    supabase.schema("sport").from("football_user_settings")
      .select("main_team_id").eq("user_id", userId).maybeSingle(),
    supabase.schema("sport").from("user_favorites")
      .select("entity_id").eq("user_id", userId).eq("entity_type", "football_team"),
  ]);

  const mainTeamId = settings?.main_team_id ?? null;
  const favoriteIds = favorites?.map((f: any) => f.entity_id) ?? [];
  const otherFavoriteIds = mainTeamId
    ? favoriteIds.filter((id: string) => id !== mainTeamId)
    : favoriteIds;

  const [mainTeamRes, otherTeamsRes] = await Promise.all([
    mainTeamId
      ? supabase.schema("sport").from("football_teams")
          .select("id, name, crest_url, api_external_id").eq("id", mainTeamId).maybeSingle()
      : Promise.resolve({ data: null }),
    otherFavoriteIds.length
      ? supabase.schema("sport").from("football_teams")
          .select("id, name, crest_url, api_external_id").in("id", otherFavoriteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const mainTeam = mainTeamRes.data ?? null;
  const otherFavoriteTeams: FootballTeam[] = otherTeamsRes.data ?? [];
  const allFavoriteTeamIds: string[] = [
    ...(mainTeamId ? [mainTeamId] : []),
    ...otherFavoriteIds,
  ];
  const allTeams: Record<string, FootballTeam> = {};
  if (mainTeam) allTeams[mainTeam.id] = mainTeam;
  for (const t of otherFavoriteTeams) allTeams[t.id] = t;

  return { mainTeam, mainTeamId, otherFavoriteTeams, allFavoriteTeamIds, allTeams };
}

// ── Fiche match — read via the cache-aside route (server holds the football-data key) ──
export async function getFootballMatch(externalId: number): Promise<FootballMatchRow> {
  const res = await fetch(`/api/football/match/${externalId}`);
  if (!res.ok) throw new Error(`Match fetch failed: ${res.status}`);
  const { match } = await res.json();
  return match as FootballMatchRow;
}

// ── Fan Log — YOUR data, written straight to Supabase (RLS guards the rows) ──
export async function getFootballFanLog(userId: string, externalId: number): Promise<FootballFanLogEntry | null> {
  if (!userId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_watched_matches")
    .select("*")
    .eq("user_id", userId)
    .eq("external_match_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return (data as FootballFanLogEntry | null) ?? null;
}

// Upsert: the match must already exist in football_matches (the FK) — the fiche loads it first via
// the cache-aside route, so by the time you log, the row is there. `watched: true` on every write —
// existence IS the "I saw it"; the flags/rating/note refine it.
export async function upsertFootballFanLog(userId: string, input: FanLogInput): Promise<FootballFanLogEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_watched_matches")
    .upsert({
      user_id: userId,
      external_match_id: input.external_match_id,
      watched: true,
      watched_where: input.watched_where ?? null,
      rating: input.rating ?? null,
      note: input.note ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,external_match_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as FootballFanLogEntry;
}

export async function deleteFootballFanLog(userId: string, externalId: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("sport").from("football_watched_matches")
    .delete()
    .eq("user_id", userId)
    .eq("external_match_id", externalId);
  if (error) throw error;
}

// ── Predictions — your score guess BEFORE kickoff (client, RLS) ──
export async function getFootballPrediction(userId: string, externalId: number): Promise<FootballPrediction | null> {
  if (!userId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_predictions")
    .select("*")
    .eq("user_id", userId)
    .eq("external_match_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return (data as FootballPrediction | null) ?? null;
}

export async function upsertFootballPrediction(
  userId: string,
  externalId: number,
  predHome: number,
  predAway: number,
): Promise<FootballPrediction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_predictions")
    .upsert({
      user_id: userId,
      external_match_id: externalId,
      pred_home: predHome,
      pred_away: predAway,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,external_match_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as FootballPrediction;
}

export async function getCrestsByExternalIds(externalIds: string[]): Promise<Record<string, string | null>> {
  if (!externalIds.length) return {};
  const supabase = createClient();
  const { data } = await supabase.schema("sport").from("football_teams")
    .select("api_external_id, crest_url").in("api_external_id", externalIds);
  const map: Record<string, string | null> = {};
  for (const t of data ?? []) {
    const url = t.crest_url;
    map[t.api_external_id] = url && !url.startsWith("http")
      ? `https://crests.football-data.org/${url}`
      : url;
  }
  return map;
}

// ─── Independent match rails (read from football_matches — the durable, full-calendar table) ─────
// These replace the capped football_next/past_matches reads. Each is its OWN query (no monolith
// waterfall — perf audit Finding 3): the page mounts them as independent sections.

export interface FootballMatchLite {
  external_match_id: number;
  utc_date: string;
  status: string | null;
  matchday: number | null;
  venue: string | null;
  home_name: string;
  away_name: string;
  home_external_id: string;
  away_external_id: string;
  home_crest: string | null;
  away_crest: string | null;
  home_score: number | null;
  away_score: number | null;
  competition_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
}

type MatchRow = {
  external_match_id: number;
  utc_date: string;
  status: string | null;
  matchday: number | null;
  venue: string | null;
  home_team_external_id: string;
  away_team_external_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  football_competitions: { name: string | null; brand_color: string | null; logo_url: string | null } | null;
};

const MATCH_SELECT =
  "external_match_id, utc_date, status, matchday, venue, home_team_external_id, away_team_external_id, home_team_name, away_team_name, home_score, away_score, football_competitions ( name, brand_color, logo_url )";

function toMatchLite(r: MatchRow, crests: Record<string, string | null>): FootballMatchLite {
  const c = r.football_competitions;
  return {
    external_match_id: r.external_match_id,
    utc_date: r.utc_date,
    status: r.status,
    matchday: r.matchday,
    venue: r.venue,
    home_name: r.home_team_name,
    away_name: r.away_team_name,
    home_external_id: r.home_team_external_id,
    away_external_id: r.away_team_external_id,
    home_crest: crests[r.home_team_external_id] ?? null,
    away_crest: crests[r.away_team_external_id] ?? null,
    home_score: r.home_score,
    away_score: r.away_score,
    competition_name: c?.name ?? null,
    brand_color: c?.brand_color ?? null,
    logo_url: c?.logo_url ?? null,
  };
}

async function crestsForRows(rows: MatchRow[]): Promise<Record<string, string | null>> {
  const extIds = [...new Set(rows.flatMap((r) => [r.home_team_external_id, r.away_team_external_id]).filter(Boolean))];
  return extIds.length ? getCrestsByExternalIds(extIds) : {};
}

// Upcoming (not-finished) matches involving any of the followed teams, soonest first.
export async function getUpcomingMatches(teamExternalIds: string[]): Promise<FootballMatchLite[]> {
  if (!teamExternalIds.length) return [];
  const supabase = createClient();
  const list = teamExternalIds.join(",");
  const { data, error } = await supabase
    .schema("sport").from("football_matches")
    .select(MATCH_SELECT)
    .or(`home_team_external_id.in.(${list}),away_team_external_id.in.(${list})`)
    .in("status", ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"])
    .order("utc_date", { ascending: true })
    .limit(60);
  if (error) throw error;
  const rows = (data ?? []) as unknown as MatchRow[];
  const crests = await crestsForRows(rows);
  return rows.map((r) => toMatchLite(r, crests));
}

// Recent FINISHED matches involving any of the followed teams, most recent first.
export async function getRecentMatches(teamExternalIds: string[]): Promise<FootballMatchLite[]> {
  if (!teamExternalIds.length) return [];
  const supabase = createClient();
  const list = teamExternalIds.join(",");
  const { data, error } = await supabase
    .schema("sport").from("football_matches")
    .select(MATCH_SELECT)
    .or(`home_team_external_id.in.(${list}),away_team_external_id.in.(${list})`)
    .eq("status", "FINISHED")
    .order("utc_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  const rows = (data ?? []) as unknown as MatchRow[];
  const crests = await crestsForRows(rows);
  return rows.map((r) => toMatchLite(r, crests));
}

// ─── Follow COMPETITIONS (the 2nd follow axis — alongside follow-team via user_favorites) ────────

export interface FollowedCompetition {
  id: string;
  name: string | null;
  code: string | null;
  api_external_id: string | null;
  brand_color: string | null;
  logo_url: string | null;
  emblem_url: string | null;
}

export async function getFollowedCompetitions(userId: string): Promise<FollowedCompetition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_user_competitions")
    .select("football_competitions ( id, name, code, api_external_id, brand_color, logo_url, emblem_url )")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { football_competitions: FollowedCompetition | null }[];
  return rows.map((r) => r.football_competitions).filter((c): c is FollowedCompetition => !!c);
}

export async function followCompetition(userId: string, competitionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("sport").from("football_user_competitions")
    .insert({ user_id: userId, competition_id: competitionId });
  if (error) throw error;
}

export async function unfollowCompetition(userId: string, competitionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("sport").from("football_user_competitions")
    .delete().eq("user_id", userId).eq("competition_id", competitionId);
  if (error) throw error;
}

// ─── Master page data ─────────────────────────────────────────────────────────

// userId is passed in from the caller (useCurrentUserId — synchronous, reads localStorage, 0 network).
// It used to call auth.getUser() here (a ~150-300ms network round-trip at the HEAD of the waterfall);
// removing it matches Watching's path and unblocks the first query immediately.
export async function getFootballPageData(userId: string): Promise<any> {
  const supabase = createClient();
  if (!userId) return null;

  // Step 2: user settings + favorites (2 parallel), then team details (2 parallel)
  const teams = await getFootballTeams(userId);
  const { mainTeam, otherFavoriteTeams, allFavoriteTeamIds, allTeams } = teams;

  if (!allFavoriteTeamIds.length) {
    return {
      userId,
      teamHeroes: [],
      favoriteTeamIds: [],
      upcomingMatches: [],
      followedTeams: [],
      recentMatches: [],
      followedTeamResults: [],
      standings: [],
      bestXI: { id: null, formation: "4-3-3", players: [] },
    };
  }

  // Step 3: all data in parallel — no per-team next-match queries (derived below)
  const [
    { data: upcomingRaw },
    { data: pastRaw },
    { data: competitions },
    { data: allStandingsRaw },
    { data: bestXiData },
  ] = await Promise.all([
    supabase
      .schema("sport")
      .from("football_next_matches")
      .select("id, external_match_id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions ( name, emblem_url )")
      .in("team_id", allFavoriteTeamIds)
      .gt("match_date", new Date().toISOString())
      .order("match_date", { ascending: true }),
    supabase
      .schema("sport")
      .from("football_past_matches")
      .select("id, external_match_id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, home_score, away_score, football_competitions ( name, emblem_url )")
      .in("team_id", allFavoriteTeamIds)
      .order("match_date", { ascending: false })
      .limit(allFavoriteTeamIds.length * 3),
    supabase.schema("sport").from("football_competitions").select("id, name, code, emblem_url"),
    supabase
      .schema("sport")
      .from("football_standings")
      .select("team_id, competition_id, played_games, won, draw, lost, points, goals_for, goals_against, goal_difference, football_teams ( name, crest_url )"),
    supabase.schema("sport").from("football_best_xi")
      .select("id, formation").eq("user_id", userId).maybeSingle(),
  ]);

  // Step 4: crests + bestXI players in parallel (no dependency on each other)
  const allExternalIds = [...new Set([
    ...(upcomingRaw ?? []).map((m: any) => m.home_team_external_id),
    ...(upcomingRaw ?? []).map((m: any) => m.away_team_external_id),
    ...(pastRaw ?? []).map((m: any) => m.home_team_external_id),
    ...(pastRaw ?? []).map((m: any) => m.away_team_external_id),
  ].filter(Boolean))];

  const [crestMap, bestXiPlayers] = await Promise.all([
    getCrestsByExternalIds(allExternalIds),
    bestXiData?.id
      ? supabase.schema("sport").from("football_best_xi_players")
          .select("*").eq("best_xi_id", bestXiData.id).then((r: { data: unknown[] | null }) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Derive next match per team from upcomingRaw (already fetched — no extra queries)
  const nextMatchByTeam: Record<string, any> = {};
  for (const m of upcomingRaw ?? []) {
    if (!nextMatchByTeam[m.team_id]) {
      const comp = m.football_competitions as any;
      nextMatchByTeam[m.team_id] = {
        start_time: m.match_date,
        home_team_name: m.home_team_name,
        away_team_name: m.away_team_name,
        competition_name: comp?.name ?? "",
      };
    }
  }

  const allTeamsList = [
    ...(mainTeam ? [{ team: mainTeam, isMainTeam: true }] : []),
    ...otherFavoriteTeams.map((t) => ({ team: t, isMainTeam: false })),
  ];

  const teamHeroes = allTeamsList.map(({ team, isMainTeam }) => ({
    team,
    isMainTeam,
    nextMatch: nextMatchByTeam[team.id] ?? null,
  }));

  // Upcoming matches
  const upcomingMatches = (upcomingRaw ?? [])
    .map((m: any) => {
      const followedTeam = allTeams[m.team_id];
      if (!followedTeam) return null;
      const comp = m.football_competitions as any;
      return {
        id: m.id,
        external_match_id: m.external_match_id,
        home_team_name: m.home_team_name,
        away_team_name: m.away_team_name,
        home_team_crest: crestMap[m.home_team_external_id] ?? null,
        away_team_crest: crestMap[m.away_team_external_id] ?? null,
        match_date: m.match_date,
        competition_name: comp?.name ?? null,
        competition_emblem_url: comp?.emblem_url ?? null,
        followed_team_id: m.team_id,
        followed_team_name: followedTeam.name,
        followed_team_crest: followedTeam.crest_url,
      };
    })
    .filter(Boolean);

  const followedTeams = [
    ...(mainTeam ? [{ ...mainTeam, isMainTeam: true }] : []),
    ...otherFavoriteTeams.map((t) => ({ ...t, isMainTeam: false })),
  ];

  // Recent matches
  const recentMatches = (pastRaw ?? [])
    .map((m: any) => {
      const followedTeam = allTeams[m.team_id];
      if (!followedTeam) return null;
      const comp = m.football_competitions as any;
      return {
        id: m.id,
        external_match_id: m.external_match_id,
        home_team_name: m.home_team_name,
        away_team_name: m.away_team_name,
        home_team_crest: crestMap[m.home_team_external_id] ?? null,
        away_team_crest: crestMap[m.away_team_external_id] ?? null,
        match_date: m.match_date,
        home_score: m.home_score,
        away_score: m.away_score,
        competition_name: comp?.name ?? null,
        competition_emblem_url: comp?.emblem_url ?? null,
        followed_team_id: m.team_id,
        followed_team_name: followedTeam.name,
      };
    })
    .filter(Boolean);

  // Standings
  const COMPETITION_ORDER = ["PD", "PL", "CL"];
  const allStandings = (allStandingsRaw ?? []).map((s: any) => ({
    ...s,
    football_teams: Array.isArray(s.football_teams)
      ? (s.football_teams[0] ?? null)
      : (s.football_teams ?? null),
  }));
  const standings = (competitions ?? [])
    .sort((a: any, b: any) => COMPETITION_ORDER.indexOf(a.code) - COMPETITION_ORDER.indexOf(b.code))
    .map((comp: any) => ({
      competition: comp,
      standings: allStandings.filter((s: any) => s.competition_id === comp.id),
    }))
    .filter((c: any) => c.standings.length > 0);

  return {
    userId,
    teamHeroes,
    favoriteTeamIds: allFavoriteTeamIds,
    upcomingMatches,
    followedTeams,
    recentMatches,
    followedTeamResults: followedTeams,
    standings,
    bestXI: {
      id: bestXiData?.id ?? null,
      formation: bestXiData?.formation ?? "4-3-3",
      players: (bestXiPlayers as any[]).map((p: any) => ({
        id: p.player_external_id,
        name: p.player_name,
        nationality: p.nationality,
        image_url: p.image_url,
        position_key: p.position_key,
        is_substitute: p.is_substitute,
        substitute_order: p.substitute_order,
      })),
    },
  };
}
