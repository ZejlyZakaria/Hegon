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