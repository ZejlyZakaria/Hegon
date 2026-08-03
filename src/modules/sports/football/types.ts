// =====================================================
// FOOTBALL TYPES
// =====================================================

export interface FootballTeam {
  id: string;
  name: string;
  crest_url: string | null;
  api_external_id: string;
}

export interface FootballTeams {
  mainTeam: FootballTeam | null;
  mainTeamId: string | null;
  otherFavoriteTeams: FootballTeam[];
  allFavoriteTeamIds: string[];
  allTeams: Record<string, FootballTeam>;
}

export interface FootballMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  match_date: string;
  status: string;
  competition: string;
}

export interface FootballStanding {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goal_difference: number;
}

export interface FootballCompetition {
  id: string;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
}

// A durable, first-class match row (sport.football_matches) — the spine of the fiche, the full
// calendar/results and the Fan Log. Shape mirrors the table 1:1.
export interface FootballMatchRow {
  id: string;
  external_match_id: number;
  competition_id: string | null;
  season: number | null;
  utc_date: string;
  status: string;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  venue: string | null;
  attendance: number | null;
  home_team_external_id: string;
  away_team_external_id: string;
  home_team_name: string;
  away_team_name: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_score_ht: number | null;
  away_score_ht: number | null;
  winner: string | null;
  last_updated: string | null;
  fetched_at: string;
}

// The Fan Log — YOUR relationship to a match (sport.football_watched_matches). The heart of the
// module: it's your data, no API involved.
export type WatchedWhere = "tv" | "stadium" | "live";

export interface FootballFanLogEntry {
  id: string;
  user_id: string;
  external_match_id: number;
  watched: boolean;
  watched_where: WatchedWhere | null;
  rating: number | null;
  note: string | null;
  watched_at: string;
  updated_at: string;
}

export interface FanLogInput {
  external_match_id: number;
  watched_where?: WatchedWhere | null;
  rating?: number | null;
  note?: string | null;
}

// A score prediction made BEFORE kickoff (sport.football_predictions). The "avant le coup d'envoi"
// counterpart of the Fan Log.
export interface FootballPrediction {
  id: string;
  user_id: string;
  external_match_id: number;
  pred_home: number;
  pred_away: number;
  created_at: string;
  updated_at: string;
}