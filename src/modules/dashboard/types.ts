// =====================================================
// DASHBOARD TYPES
// =====================================================
//
// TRACEABILITY (2026-09-06, chantier d'audit phase 1) — `DashboardData` portait 10 champs ; le
// dashboard actuel (`dashboard-os`) n'en lit que 2. Les 8 autres (tâche prioritaire, événements
// football/tennis/F1 du jour et à venir) décrivaient l'ANCIEN dashboard, remplacé par le home screen.
// Supprimés avec les fonctions qui les produisaient — voir l'en-tête de `service.ts`.
// `DashboardSportEvent` et `SportType` sont partis avec eux : plus aucun consommateur.

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
  inProgressMediaList: DashboardMedia[];
}
