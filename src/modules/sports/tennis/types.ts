// =====================================================
// TENNIS TYPES
// =====================================================

export interface TennisPlayer {
  id: string;
  name: string;
  country: string;
  photo_url: string | null;
}

export interface TennisPlayers {
  favoritePlayers: TennisPlayer[];
  favoritePlayerIds: string[];
  mainPlayerId: string | null;
}

export interface TennisMatch {
  id: string;
  player_id: string;
  opponent_name: string | null;
  match_date: string;
  round: string | null;
  tournament_id: string;
  result: string | null;
}

export interface TennisRanking {
  player_id: string;
  rank: number;
  points: number;
  movement: number;
}

export interface TennisTournament {
  id: string;
  name: string;
  surface: string | null;
  start_date: string;
  end_date: string;
  category: string;
}

export type Surface = "clay" | "hard" | "grass" | "indoor" | "unknown";

export interface SurfaceConfig {
  label: string;
  bg: string;
  accent: string;
  textAccent: string;
  lines: string;
}