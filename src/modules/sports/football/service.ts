/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
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

// ─── Add-modal reads/writes (Teams tab: search + follow) ─────────────────────────────────────────

export interface FootballTeamSearchResult {
  id: string;
  name: string;
  crest_url: string | null;
  api_external_id: string;
  country: string | null;
  tla: string | null;
}

// Search the local reference table (football_teams, ~287 rows, all crested) — no API call.
export async function searchTeams(query: string): Promise<FootballTeamSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_teams")
    .select("id, name, crest_url, api_external_id, country, tla")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(12);
  if (error) throw error;
  return (data ?? []) as FootballTeamSearchResult[];
}

// Follow a team (1st axis). The full-season calendar fill happens in the hook (sync-team route).
export async function followTeam(userId: string, teamId: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { error } = await supabase
    .schema("sport").from("user_favorites")
    .insert({ user_id: userId, entity_type: "football_team", entity_id: teamId, org_id: orgId });
  if (error) throw error;
}

// ── Fiche match — DB-FIRST: football_matches already holds it → instant, no football-data round-trip.
// The cache-aside route is only a fallback for a match we somehow haven't stored yet. ──
export async function getFootballMatch(externalId: number): Promise<FootballMatchRow> {
  const supabase = createClient();
  const { data } = await supabase
    .schema("sport").from("football_matches")
    .select("*")
    .eq("external_match_id", externalId)
    .maybeSingle();
  if (data) return data as FootballMatchRow;

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

// All of the user's predictions as a map by match — lets the Upcoming cards show "your pick" without
// a query per card. Small (the user's own rows).
export async function getUserPredictions(userId: string): Promise<Record<number, { home: number; away: number }>> {
  if (!userId) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_predictions")
    .select("external_match_id, pred_home, pred_away")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<number, { home: number; away: number }> = {};
  for (const p of (data ?? []) as { external_match_id: number; pred_home: number; pred_away: number }[]) {
    map[p.external_match_id] = { home: p.pred_home, away: p.pred_away };
  }
  return map;
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
  emblem_url: string | null;   // colour emblem (football-data) — for cards on a light chip
  season: number | null;       // season start year (2026 = 2026/2027)
}

type MatchRow = {
  external_match_id: number;
  utc_date: string;
  status: string | null;
  matchday: number | null;
  venue: string | null;
  season: number | null;
  home_team_external_id: string;
  away_team_external_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  football_competitions: { name: string | null; brand_color: string | null; logo_url: string | null; emblem_url: string | null } | null;
};

const MATCH_SELECT =
  "external_match_id, utc_date, status, matchday, venue, season, home_team_external_id, away_team_external_id, home_team_name, away_team_name, home_score, away_score, football_competitions ( name, brand_color, logo_url, emblem_url )";

type TeamMeta = { crest: string | null; venue: string | null };

function toMatchLite(r: MatchRow, meta: Record<string, TeamMeta>): FootballMatchLite {
  const c = r.football_competitions;
  return {
    external_match_id: r.external_match_id,
    utc_date: r.utc_date,
    status: r.status,
    matchday: r.matchday,
    // football-data leaves match.venue null → the home team's stadium IS the venue for a league match.
    venue: r.venue ?? meta[r.home_team_external_id]?.venue ?? null,
    home_name: r.home_team_name,
    away_name: r.away_team_name,
    home_external_id: r.home_team_external_id,
    away_external_id: r.away_team_external_id,
    home_crest: meta[r.home_team_external_id]?.crest ?? null,
    away_crest: meta[r.away_team_external_id]?.crest ?? null,
    home_score: r.home_score,
    away_score: r.away_score,
    competition_name: c?.name ?? null,
    brand_color: c?.brand_color ?? null,
    logo_url: c?.logo_url ?? null,
    emblem_url: c?.emblem_url ?? null,
    season: r.season,
  };
}

// Crest + stadium for every team in a match list — one query on football_teams (the crest chip and the
// derived venue both come from here).
async function crestsForRows(rows: MatchRow[]): Promise<Record<string, TeamMeta>> {
  const extIds = [...new Set(rows.flatMap((r) => [r.home_team_external_id, r.away_team_external_id]).filter(Boolean))];
  if (!extIds.length) return {};
  const supabase = createClient();
  const { data } = await supabase.schema("sport").from("football_teams")
    .select("api_external_id, crest_url, venue").in("api_external_id", extIds);
  const map: Record<string, TeamMeta> = {};
  for (const t of data ?? []) {
    const url = t.crest_url as string | null;
    map[t.api_external_id] = {
      crest: url && !url.startsWith("http") ? `https://crests.football-data.org/${url}` : url,
      venue: (t.venue as string | null) ?? null,
    };
  }
  return map;
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

// All registered competitions (the 13) — the Competitions tab of the add modal lists these.
export async function getAllCompetitions(): Promise<FollowedCompetition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_competitions")
    .select("id, name, code, api_external_id, brand_color, logo_url, emblem_url")
    .order("name");
  if (error) throw error;
  return (data ?? []) as FollowedCompetition[];
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

// Unfollow a team (the 1st axis — user_favorites). Mirror of the inline delete the old hero did.
export async function unfollowTeam(userId: string, teamId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .schema("sport").from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("entity_type", "football_team")
    .eq("entity_id", teamId);
  if (error) throw error;
}

// ─── Team panel: YOUR record for one team (derived from your Fan Log) ─────────────────────────────

export interface TeamPersonalStats {
  watchedCount: number;   // matches of this team you logged as watched
  stadiumCount: number;   // of those, seen at the stadium
  avgRating: number | null;
}

// Read your watched-match logs (small — your own data) with the match's team ids embedded, then keep
// the ones that involve this team. Filtering in JS keeps the query trivial and reliable.
export async function getTeamPersonalStats(userId: string, teamExternalId: string): Promise<TeamPersonalStats> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_watched_matches")
    .select("watched_where, rating, football_matches!inner ( home_team_external_id, away_team_external_id )")
    .eq("user_id", userId)
    .eq("watched", true);
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    watched_where: string | null;
    rating: number | null;
    football_matches: { home_team_external_id: string; away_team_external_id: string } | null;
  }[];

  const mine = rows.filter(
    (r) =>
      r.football_matches &&
      (r.football_matches.home_team_external_id === teamExternalId ||
        r.football_matches.away_team_external_id === teamExternalId),
  );
  const ratings = mine.map((r) => r.rating).filter((n): n is number => n != null);

  return {
    watchedCount: mine.length,
    stadiumCount: mine.filter((r) => r.watched_where === "stadium").length,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}

// ─── Fan Log — YOUR football diary: every match you logged as watched, newest first ──────────────

export interface FanLogItem extends FootballMatchLite {
  watched_where: string | null;
  rating: number | null;
  note: string | null;
}

export async function getFanLog(userId: string): Promise<FanLogItem[]> {
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_watched_matches")
    .select(`watched_where, rating, note, football_matches!inner ( ${MATCH_SELECT} )`)
    .eq("user_id", userId)
    .eq("watched", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    watched_where: string | null;
    rating: number | null;
    note: string | null;
    football_matches: MatchRow;
  }[];
  const matchRows = rows.map((r) => r.football_matches).filter(Boolean);
  const crests = await crestsForRows(matchRows);
  return rows.map((r) => ({
    ...toMatchLite(r.football_matches, crests),
    watched_where: r.watched_where,
    rating: r.rating,
    note: r.note,
  }));
}

// ─── Competition page reads (standings + a competition's own matches) — independent queries ──────

export interface StandingRow {
  position: number;           // the OFFICIAL rank (football-data) — respects deductions + tiebreakers
  team_id: string;
  team_external_id: string;
  team_name: string | null;
  team_crest: string | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
}

// The league table of ONE competition — the OFFICIAL football-data table (mirrored into
// football_standings by the 6h cron). `points` already carries point deductions; `position` is the
// real rank (head-to-head tiebreakers etc.), so we order by it. nullsLast + points fallback keeps a
// sensible order if a row was stored before the position column was backfilled.
export async function getStandings(competitionId: string): Promise<StandingRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_standings")
    .select("position, team_id, played_games, won, draw, lost, points, goals_for, goals_against, goal_difference, football_teams ( name, crest_url, api_external_id )")
    .eq("competition_id", competitionId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("points", { ascending: false });
  if (error) throw error;
  type SRow = {
    position: number | null; team_id: string; played_games: number; won: number; draw: number; lost: number;
    points: number; goals_for: number; goals_against: number; goal_difference: number;
    football_teams: { name: string | null; crest_url: string | null; api_external_id: string | null } | null;
  };
  const rows = (data ?? []) as unknown as SRow[];
  return rows.map((r, i) => ({
    position: r.position ?? i + 1,
    team_id: r.team_id,
    team_external_id: r.football_teams?.api_external_id ?? "",
    team_name: r.football_teams?.name ?? null,
    team_crest: r.football_teams?.crest_url ?? null,
    played: r.played_games, won: r.won, draw: r.draw, lost: r.lost,
    points: r.points, goals_for: r.goals_for, goals_against: r.goals_against, goal_difference: r.goal_difference,
  }));
}

// All stored matches of a competition (fixtures + results), soonest first — the Competition page
// groups them by matchday. Only present for competitions we've synced (followed → sync-competition).
export async function getCompetitionMatches(competitionId: string): Promise<FootballMatchLite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_matches")
    .select(MATCH_SELECT)
    .eq("competition_id", competitionId)
    .order("utc_date", { ascending: true })
    .limit(1000);
  if (error) throw error;
  const all = (data ?? []) as unknown as MatchRow[];
  // football_matches keeps SEVERAL seasons for the same competition (last season's finished games +
  // this season's fixtures). Keep only the latest season — else old results pollute the page & table.
  const maxSeason = all.reduce((mx, r) => Math.max(mx, r.season ?? 0), 0);
  const rows = maxSeason ? all.filter((r) => (r.season ?? 0) === maxSeason) : all;
  const crests = await crestsForRows(rows);
  return rows.map((r) => toMatchLite(r, crests));
}

// ─── Past winners (roll of honour) — Wikidata-sourced, cached in football_competition_winners ──────
export interface CompetitionWinner {
  season_year: number | null;
  season_label: string | null;
  winner_name: string;
  winner_wikidata_id: string | null;
}

export async function getCompetitionWinners(competitionId: string): Promise<CompetitionWinner[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_competition_winners")
    .select("season_year, season_label, winner_name, winner_wikidata_id")
    .eq("competition_id", competitionId)
    .order("season_year", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as CompetitionWinner[];
}

// ─── Top scorers (Golden Boot) — read through the server route (key stays server-side) ──────────

export interface Scorer {
  rank: number;
  player_name: string;
  team_name: string;
  team_crest: string | null;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played_matches: number | null;
}

export async function getScorers(code: string): Promise<Scorer[]> {
  const res = await fetch(`/api/football/scorers/${code}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.scorers ?? []) as Scorer[];
}

// ─── Competition PAGE — the record + its season/progress + live standings ────────────────────────

export interface FootballCompetition {
  id: string;
  name: string | null;
  code: string | null;
  api_external_id: string | null;
  country: string | null;
  emblem_url: string | null;
  logo_url: string | null;
  brand_color: string | null;
}

// football-data names some competitions by their local name — override for display.
const COMPETITION_NAME_OVERRIDES: Record<string, string> = {
  "Primera Division": "La Liga",
};
export function displayCompetitionName(name: string | null | undefined): string {
  if (!name) return "";
  return COMPETITION_NAME_OVERRIDES[name] ?? name;
}

export async function getCompetitionById(id: string): Promise<FootballCompetition | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_competitions")
    .select("id, name, code, api_external_id, country, emblem_url, logo_url, brand_color")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as FootballCompetition | null) ?? null;
}


// ─── Team PAGE — the record + all its matches (deep stats are derived from these in the component) ──

export interface FootballTeamFull {
  id: string;
  api_external_id: string;
  name: string;
  short_name: string | null;
  tla: string | null;
  crest_url: string | null;
  country: string | null;
  founded: number | null;
  venue: string | null;
  club_colors: string | null;
  website: string | null;
}

export async function getTeamByExternalId(externalId: string): Promise<FootballTeamFull | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_teams")
    .select("id, api_external_id, name, short_name, tla, crest_url, country, founded, venue, club_colors, website")
    .eq("api_external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return (data as FootballTeamFull | null) ?? null;
}

// All stored matches a team plays in (home OR away), any competition/season — the page groups by
// season and derives its stats from these.
export async function getTeamMatches(externalId: string): Promise<FootballMatchLite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("sport").from("football_matches")
    .select(MATCH_SELECT)
    .or(`home_team_external_id.eq.${externalId},away_team_external_id.eq.${externalId}`)
    .order("utc_date", { ascending: true })
    .limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as MatchRow[];
  const crests = await crestsForRows(rows);
  return rows.map((r) => toMatchLite(r, crests));
}

// ─── Best XI — the user's manual dream-team. The ONLY piece of the old page monolith kept: the page
// now mounts independent sections (each its own query), so this replaces getFootballPageData’s ~11
// queries with just these two. ─────────────────────────────────────────────────────────────────────
export interface BestXIData {
  id: string | null;
  formation: string;
  players: {
    id: string; name: string; nationality: string | null; image_url: string | null;
    position_key: string; is_substitute: boolean; substitute_order: number | null;
  }[];
}

export async function getBestXI(userId: string): Promise<BestXIData> {
  const supabase = createClient();
  const { data: xi } = await supabase.schema("sport").from("football_best_xi")
    .select("id, formation").eq("user_id", userId).maybeSingle();
  if (!xi?.id) return { id: null, formation: "4-3-3", players: [] };
  const { data: players } = await supabase.schema("sport").from("football_best_xi_players")
    .select("player_external_id, player_name, nationality, image_url, position_key, is_substitute, substitute_order")
    .eq("best_xi_id", xi.id);
  type Raw = { player_external_id: string; player_name: string; nationality: string | null; image_url: string | null; position_key: string; is_substitute: boolean; substitute_order: number | null };
  return {
    id: xi.id,
    formation: (xi.formation as string) ?? "4-3-3",
    players: ((players ?? []) as unknown as Raw[]).map((p) => ({
      id: p.player_external_id, name: p.player_name, nationality: p.nationality, image_url: p.image_url,
      position_key: p.position_key, is_substitute: p.is_substitute, substitute_order: p.substitute_order,
    })),
  };
}
