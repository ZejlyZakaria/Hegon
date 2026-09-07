// Remaining `any` casts are isolated to Supabase nested join inference (cf. audit §4.1).
// Each is annotated with an inline eslint-disable-next-line.
//
// TRACEABILITY (2026-09-06, chantier d'audit phase 1) — ce fichier faisait 500 lignes et calculait
// tout le contenu de l'ANCIEN dashboard (football/tennis/F1 du jour, événements à venir, tâche
// prioritaire…). Le dashboard actuel est un home screen (`dashboard-os`) et ne lit QUE deux champs :
// `tasks` et `inProgressMediaList`. Les 8 autres champs de `DashboardData` étaient calculés à chaque
// chargement puis jetés — 5 requêtes sport pour rien, dont 2 qui interrogeaient
// `sport.football_next_matches`, table SUPPRIMÉE le 2026-08-09. Elles levaient donc une erreur à
// chaque fois, avalée en silence par le `Promise.allSettled`.
//
// ⚠️ La migration `20260809_football_drop_widget_tables.sql` affirmait que ces fonctions dashboard
// étaient « jamais appelées ». C'était FAUX : elles l'étaient depuis l'agrégateur. Le garde-fou
// `allSettled` a parfaitement fonctionné — il a masqué la panne pendant 28 jours.
import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentUserId } from "@/shared/utils/getCurrentUserId";
import type { DashboardMedia, DashboardTask, DashboardData } from "./types";

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

// ─── Main aggregator ──────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  // allSettled so one failing section doesn't crash the whole dashboard.
  // ⚠️ Ce garde-fou masque les pannes : il a caché 28 jours de requêtes mortes. Le `console.error`
  // ci-dessous est le seul signal — toute section ajoutée ici doit rester observable.
  const [tasksResult, mediaResult] = await Promise.allSettled([
    getTodayTasks(userId),
    getInProgressMedia(userId),
  ]);

  const SECTION_NAMES = ["tasks", "media"];
  [tasksResult, mediaResult].forEach((r, i) => {
    if (r.status === "rejected") console.error(`[getDashboardData] ${SECTION_NAMES[i]} failed:`, r.reason);
  });

  return {
    tasks: tasksResult.status === "fulfilled" ? tasksResult.value : [],
    inProgressMediaList: mediaResult.status === "fulfilled" ? mediaResult.value : [],
  };
}
