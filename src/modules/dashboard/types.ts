// =====================================================
// DASHBOARD TYPES
// =====================================================

export type SportType = "football" | "f1" | "tennis";

export interface DashboardSportEvent {
  type: SportType;
  title: string;
  subtitle: string;
  date: string; // ISO
  badge: string; // "FOOTBALL" | "RACING" | "TENNIS"
  href: string;
  // Football
  homeTeam?: string;
  awayTeam?: string;
  homeTeamCrest?: string | null;
  awayTeamCrest?: string | null;
  competition?: string | null;
  isMainTeam?: boolean;
  // F1
  circuit?: string | null;
  country?: string | null;
  // Tennis - tournament (upcoming section)
  surface?: string | null;
  location?: string | null;
  endDate?: string | null;
  // Tennis - match (today section)
  playerName?: string | null;
  playerPhotoUrl?: string | null;
  opponentName?: string | null;
  round?: string | null;
  tournamentName?: string | null;
}

export interface DashboardMedia {
  id: string;
  title: string;
  type: "film" | "serie" | "anime";
  poster_url: string | null;
  backdrop_url: string | null;
  current_episode?: number | null;
  current_season?: number | null;
  episodes?: number | null;
  season_episodes?: number[] | null;
}

export interface DashboardTask {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  due_date: string | null;
  project_name: string;
  status_name: string;
  status_color: string | null;
  is_completed: boolean;
}

export interface DashboardData {
  tasks: DashboardTask[];
  priorityTask: DashboardTask | null;
  inProgressMedia: DashboardMedia | null;
  inProgressMediaList: DashboardMedia[];
  // Today's events — separated by sport for layout logic
  todayFootballEvents: DashboardSportEvent[];
  todayTennisEvents: DashboardSportEvent[];
  todayF1Event: DashboardSportEvent | null;
  todaySportEvents: DashboardSportEvent[]; // kept for UpcomingSports section compat
  // Future events (for Upcoming Sports section)
  sportEvents: DashboardSportEvent[];
  upNextEvent: DashboardSportEvent | null;
}
