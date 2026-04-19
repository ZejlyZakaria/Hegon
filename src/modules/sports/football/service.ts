/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentUserId } from "@/shared/utils/getCurrentUserId";
import type { FootballTeams, FootballTeam } from "./types";

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

// ─── Master page data ─────────────────────────────────────────────────────────

export async function getFootballPageData(): Promise<any> {
  const supabase = createClient();

  // Step 1: get userId once
  const userId = await getCurrentUserId();
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
      .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions ( name, emblem_url )")
      .in("team_id", allFavoriteTeamIds)
      .gt("match_date", new Date().toISOString())
      .order("match_date", { ascending: true }),
    supabase
      .schema("sport")
      .from("football_past_matches")
      .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, home_score, away_score, football_competitions ( name, emblem_url )")
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
          .select("*").eq("best_xi_id", bestXiData.id).then((r) => r.data ?? [])
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
