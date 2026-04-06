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
  // F1
  circuit?: string | null;
  country?: string | null;
  // Tennis
  surface?: string | null;
  location?: string | null;
  endDate?: string | null;
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
  inProgressMedia: DashboardMedia | null;
  inProgressMediaList: DashboardMedia[];
  todaySportEvents: DashboardSportEvent[];   // matches happening today
  sportEvents: DashboardSportEvent[];         // matches after today (for Upcoming section)
  upNextEvent: DashboardSportEvent | null;
  priorityTask: DashboardTask | null;
}
