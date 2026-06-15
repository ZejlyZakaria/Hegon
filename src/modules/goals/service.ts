import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  Goal,
  GoalMilestone,
  GoalProgressPoint,
  GoalReview,
  ReviewDraft,
  ReviewGoalSnapshot,
  ReviewMovement,
  CreateReviewInput,
  LinkedTask,
  LinkedHabit,
  AvailableTask,
  AvailableHabit,
  CreateGoalInput,
  UpdateGoalInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "./types";

// =====================================================
// GOALS
// =====================================================

export async function getGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goals")
    .select("*, milestones:goal_milestones(id, title, status, due_date, order_index)")
    .eq("org_id", orgId)
    .order("target_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function getGoal(id: string): Promise<Goal> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error) throw error;
  return data;
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("goals")
    .insert({
      org_id:        orgId,
      user_id:       user.id,
      title:         input.title,
      description:   input.description ?? null,
      why:           input.why ?? null,
      category:      input.category ?? null,
      priority:      input.priority ?? "medium",
      progress_mode: input.progress_mode ?? "manual",
      target_date:   input.target_date ?? null,
      metric_module: input.metric_module ?? null,
      metric_key:    input.metric_key ?? null,
      metric_period: input.metric_period ?? null,
      metric_year:   input.metric_year ?? null,
      metric_target: input.metric_target ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Metric goals: compute initial progress now so the goal isn't shown at 0%.
  if (data.progress_mode === "auto" && data.metric_module) {
    const p = await recalculateProgress(data.id);
    if (p >= 0) data.progress = p;
  }
  return data;
}

export async function updateGoal(input: UpdateGoalInput): Promise<Goal> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;

  // Keep auto-goal progress in sync after an edit — for BOTH task-driven and
  // metric-driven goals. Critical when switching tracking mode (e.g. activity →
  // tasks): metric_module becomes null, so gating on it would leave the bar stale.
  if (data.progress_mode === "auto") {
    const p = await recalculateProgress(data.id);
    if (p >= 0) data.progress = p;
  }
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}

// Daily progress snapshots for the Momentum sparkline (filled server-side by the
// snapshot_goal_progress trigger on goals.progress — see migration).
export async function getGoalProgressHistory(goalId: string): Promise<GoalProgressPoint[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goal_progress_history")
    .select("recorded_on, progress")
    .eq("goal_id", goalId)
    .eq("org_id", orgId)
    .order("recorded_on", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GoalProgressPoint[];
}

// =====================================================
// PROGRESS
// =====================================================

// Returns the new progress (0-100) on auto goals, or -1 if the goal is in manual mode / not found.
// Caller can use -1 to skip cache invalidation. (audit §3.2 v2)
export async function recalculateProgress(goalId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("recalc_goal_progress", { p_goal_id: goalId });
  if (error) throw error;
  return (data as number) ?? -1;
}

export interface WatchingGoalDelta {
  id:            string;
  title:         string;
  metric_key:    string | null;
  metric_target: number | null;
  oldProgress:   number;
  newProgress:   number;
}

// Recompute every active watching-metric goal for the current org (called after a
// watch change in the Watching module). Returns per-goal deltas so the caller can
// surface a "+1" ripple.
export async function recalcWatchingGoals(): Promise<WatchingGoalDelta[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: goals, error } = await supabase
    .from("goals")
    .select("id, title, progress, metric_key, metric_target")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("progress_mode", "auto")
    .eq("metric_module", "watching");
  if (error) throw error;
  if (!goals || goals.length === 0) return [];

  type GoalRow = { id: string; title: string; progress: number; metric_key: string | null; metric_target: number | null };
  return Promise.all(
    (goals as GoalRow[]).map(async (g) => {
      const next = await recalculateProgress(g.id);
      // Auto-complete the moment the target is reached (manual control still available).
      if (g.progress < 100 && next >= 100) {
        await supabase
          .from("goals")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", g.id);
      }
      return {
        id:            g.id,
        title:         g.title,
        metric_key:    g.metric_key,
        metric_target: g.metric_target,
        oldProgress:   g.progress,
        newProgress:   next >= 0 ? next : g.progress,
      };
    }),
  );
}

// Active watching-metric goals for the current org — used by the Watching module
// to show "Contributing to" on a film + a goals strip in Stats.
export interface WatchingGoalSummary {
  id:             string;
  title:          string;
  progress:       number;
  metric_key:     string | null;
  metric_period:  string | null;
  metric_year:    number | null;
  metric_target:  number | null;
  metric_current: number; // exact count of matching watched media — the source of truth for "X / target"
}

export async function getActiveWatchingGoals(): Promise<WatchingGoalSummary[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, user_id, progress, metric_key, metric_period, metric_year, metric_target")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("progress_mode", "auto")
    .eq("metric_module", "watching")
    .order("created_at", { ascending: true });
  if (error) throw error;

  type Row = Omit<WatchingGoalSummary, "metric_current"> & { user_id: string };
  // Resolve the exact current count per goal (count-only query, no rows fetched).
  // Reconstructing it from the rounded progress % freezes between integer ticks on
  // large targets (e.g. each title is 0.2% of a 500-target).
  return Promise.all(
    ((data ?? []) as Row[]).map(async ({ user_id, ...g }) => ({
      ...g,
      metric_current: await countWatchingMedia(supabase, user_id, g.metric_key, g.metric_period, g.metric_year),
    })),
  );
}

// =====================================================
// CONTRIBUTING MEDIA (watching-metric goals)
// =====================================================

export interface ContributingMedia {
  id:         string;
  title:      string;
  poster_url: string | null;
  watched_at: string | null;
}

const METRIC_KEY_TO_TYPE: Record<string, string> = {
  films:  "film",
  series: "serie",
  anime:  "anime",
};

// Exact count of watched media matching a watching-metric goal (type + period).
// Count-only (`head: true`) — Postgres returns the count without transferring rows.
// `metric_key` of "titles"/null counts every type; a year period bounds by watched_at.
async function countWatchingMedia(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  metricKey: string | null,
  metricPeriod: string | null,
  metricYear: number | null,
): Promise<number> {
  const type      = metricKey ? METRIC_KEY_TO_TYPE[metricKey] : undefined;
  const yearStart = metricPeriod === "year" && metricYear ? `${metricYear}-01-01` : null;
  const yearEnd   = metricPeriod === "year" && metricYear ? `${metricYear + 1}-01-01` : null;

  let q = supabase
    .schema("watching")
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("watched", true)
    .neq("is_reference", true);
  if (type) q = q.eq("type", type);
  if (yearStart && yearEnd) q = q.gte("watched_at", yearStart).lt("watched_at", yearEnd);

  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

// Collapse a binged saga ("Harry Potter and the…", "LOTR: …") to one entry so the
// poster wall shows DIFFERENT films, not 7 of the same. Heuristic on the title.
function franchiseKey(title: string): string {
  return title.toLowerCase().split(/:| and the | part | chapter | vol\.? | volume /i)[0].trim();
}

// The watched media that fill a watching-metric goal — exact count + the most
// recent ones for display. One query (PostgREST `count` ignores the limit).
export async function getGoalContributingMedia(
  goal: Goal,
): Promise<{ count: number; items: ContributingMedia[] }> {
  if (goal.metric_module !== "watching") return { count: 0, items: [] };
  const supabase = createClient();

  const type = goal.metric_key ? METRIC_KEY_TO_TYPE[goal.metric_key] : undefined;
  const yearStart = goal.metric_period === "year" && goal.metric_year ? `${goal.metric_year}-01-01` : null;
  const yearEnd   = goal.metric_period === "year" && goal.metric_year ? `${goal.metric_year + 1}-01-01` : null;

  let q = supabase
    .schema("watching")
    .from("media_items")
    .select("id, title, poster_url, watched_at", { count: "exact" })
    .eq("user_id", goal.user_id)
    .eq("watched", true)
    .neq("is_reference", true);

  if (type) q = q.eq("type", type);
  if (yearStart && yearEnd) q = q.gte("watched_at", yearStart).lt("watched_at", yearEnd);

  // Over-fetch, then keep one per franchise (most recent) up to 18 distinct.
  const { data, count, error } = await q.order("watched_at", { ascending: false }).limit(60);
  if (error) throw error;

  const seen = new Set<string>();
  const items: ContributingMedia[] = [];
  for (const m of (data ?? []) as ContributingMedia[]) {
    const key = franchiseKey(m.title);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(m);
    if (items.length >= 18) break;
  }
  return { count: count ?? 0, items };
}

// Cumulative daily progress curve from a list of event timestamps. Each event adds
// 1 to a running count; progress = count / denominator. Used by both task and
// metric momentum so the curve always reflects WHEN the work actually happened.
function cumulativeCurve(dates: string[], denominator: number): GoalProgressPoint[] {
  if (dates.length === 0 || denominator <= 0) return [];
  const byDay = new Map<string, number>();
  for (const ts of dates) {
    const day = ts.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  let cum = 0;
  return [...byDay.keys()].sort().map((day) => {
    cum += byDay.get(day)!;
    return { recorded_on: day, progress: Math.min(100, Math.round((cum / denominator) * 100)) };
  });
}

// Real, RETROACTIVE momentum for an AUTO goal — reconstructed from when the work
// actually happened, never from when `progress` was recalculated (which can fire
// any day). Works for goals that predate the feature, since the source events
// already carry their own dates:
//   • task goal   → cumulative completed tasks ÷ current total (completed_at)
//   • metric goal → cumulative watched/read ÷ target (watched_at / finished_at)
export async function getGoalActivityMomentum(goal: Goal): Promise<GoalProgressPoint[]> {
  const supabase = createClient();

  // ── Task-driven ──
  if (!goal.metric_module) {
    const { data, error } = await supabase.from("tasks").select("completed_at").eq("goal_id", goal.id);
    if (error) throw error;
    const tasks = (data ?? []) as { completed_at: string | null }[];
    const done = tasks.map((t) => t.completed_at).filter((d): d is string => !!d);
    return cumulativeCurve(done, tasks.length);
  }

  // ── Metric-driven ──
  if (!goal.metric_target) return [];
  const yearStart = goal.metric_period === "year" && goal.metric_year ? `${goal.metric_year}-01-01` : null;
  const yearEnd   = goal.metric_period === "year" && goal.metric_year ? `${goal.metric_year + 1}-01-01` : null;

  let dates: string[] = [];
  if (goal.metric_module === "watching") {
    const type = goal.metric_key ? METRIC_KEY_TO_TYPE[goal.metric_key] : undefined;
    let q = supabase
      .schema("watching").from("media_items")
      .select("watched_at")
      .eq("user_id", goal.user_id).eq("watched", true).neq("is_reference", true)
      .not("watched_at", "is", null);
    if (type) q = q.eq("type", type);
    if (yearStart && yearEnd) q = q.gte("watched_at", yearStart).lt("watched_at", yearEnd);
    const { data, error } = await q.order("watched_at", { ascending: true });
    if (error) throw error;
    dates = ((data ?? []) as { watched_at: string }[]).map((d) => d.watched_at);
  } else if (goal.metric_module === "books") {
    let q = supabase
      .from("books")
      .select("finished_at")
      .eq("user_id", goal.user_id).eq("status", "read")
      .not("finished_at", "is", null);
    if (yearStart && yearEnd) q = q.gte("finished_at", yearStart).lt("finished_at", yearEnd);
    const { data, error } = await q.order("finished_at", { ascending: true });
    if (error) throw error;
    dates = ((data ?? []) as { finished_at: string }[]).map((d) => d.finished_at);
  }

  return cumulativeCurve(dates, goal.metric_target);
}

// =====================================================
// BOOKS METRIC GOALS  (mirror of the watching block above)
// =====================================================

// Recompute every active books-metric goal for the current org (called after a
// book is marked read / removed). Returns per-goal deltas so the Books module can
// surface a "+1" ripple. Reuses the WatchingGoalDelta shape (module-agnostic).
export async function recalcBooksGoals(): Promise<WatchingGoalDelta[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: goals, error } = await supabase
    .from("goals")
    .select("id, title, progress, metric_key, metric_target")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("progress_mode", "auto")
    .eq("metric_module", "books");
  if (error) throw error;
  if (!goals || goals.length === 0) return [];

  type GoalRow = { id: string; title: string; progress: number; metric_key: string | null; metric_target: number | null };
  return Promise.all(
    (goals as GoalRow[]).map(async (g) => {
      const next = await recalculateProgress(g.id);
      // Auto-complete the moment the target is reached (manual control still available).
      if (g.progress < 100 && next >= 100) {
        await supabase
          .from("goals")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", g.id);
      }
      return {
        id:            g.id,
        title:         g.title,
        metric_key:    g.metric_key,
        metric_target: g.metric_target,
        oldProgress:   g.progress,
        newProgress:   next >= 0 ? next : g.progress,
      };
    }),
  );
}

// Active books-metric goals for the current org — used by the Books module to show
// "Contributing to" on a finished book + a goals strip in the right panel.
export interface BooksGoalSummary {
  id:             string;
  title:          string;
  progress:       number;
  metric_period:  string | null;
  metric_year:    number | null;
  metric_target:  number | null;
  metric_current: number; // exact count of read books matching the period
}

export async function getActiveBooksGoals(): Promise<BooksGoalSummary[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, user_id, progress, metric_period, metric_year, metric_target")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("progress_mode", "auto")
    .eq("metric_module", "books")
    .order("created_at", { ascending: true });
  if (error) throw error;

  type Row = Omit<BooksGoalSummary, "metric_current"> & { user_id: string };
  return Promise.all(
    ((data ?? []) as Row[]).map(async ({ user_id, ...g }) => ({
      ...g,
      metric_current: await countReadBooks(supabase, user_id, g.metric_period, g.metric_year),
    })),
  );
}

// Exact count of read books matching a books-metric goal (period only — a book
// has no sub-type). Count-only query, no rows fetched.
async function countReadBooks(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  metricPeriod: string | null,
  metricYear: number | null,
): Promise<number> {
  const yearStart = metricPeriod === "year" && metricYear ? `${metricYear}-01-01` : null;
  const yearEnd   = metricPeriod === "year" && metricYear ? `${metricYear + 1}-01-01` : null;

  let q = supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "read");
  if (yearStart && yearEnd) q = q.gte("finished_at", yearStart).lt("finished_at", yearEnd);

  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

// The read books that fill a books-metric goal — exact count + the most recent
// covers for display. Returns the ContributingMedia shape (poster_url = cover_url,
// watched_at = finished_at) so the Goal detail gallery renders unchanged.
export async function getGoalContributingBooks(
  goal: Goal,
): Promise<{ count: number; items: ContributingMedia[] }> {
  if (goal.metric_module !== "books") return { count: 0, items: [] };
  const supabase = createClient();

  const yearStart = goal.metric_period === "year" && goal.metric_year ? `${goal.metric_year}-01-01` : null;
  const yearEnd   = goal.metric_period === "year" && goal.metric_year ? `${goal.metric_year + 1}-01-01` : null;

  let q = supabase
    .from("books")
    .select("id, title, cover_url, finished_at", { count: "exact" })
    .eq("user_id", goal.user_id)
    .eq("status", "read");
  if (yearStart && yearEnd) q = q.gte("finished_at", yearStart).lt("finished_at", yearEnd);

  const { data, count, error } = await q.order("finished_at", { ascending: false }).limit(18);
  if (error) throw error;

  type BookRow = { id: string; title: string; cover_url: string | null; finished_at: string | null };
  const items: ContributingMedia[] = ((data ?? []) as BookRow[]).map((b) => ({
    id:         b.id,
    title:      b.title,
    poster_url: b.cover_url,
    watched_at: b.finished_at,
  }));
  return { count: count ?? 0, items };
}

// =====================================================
// MILESTONES
// =====================================================

export async function getMilestones(goalId: string): Promise<GoalMilestone[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  // Vérifie que le goal appartient à l'org avant de lire ses milestones
  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("org_id", orgId)
    .single();

  if (!goal) return [];

  const { data, error } = await supabase
    .from("goal_milestones")
    .select("*")
    .eq("goal_id", goalId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createMilestone(input: CreateMilestoneInput): Promise<GoalMilestone> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goal_milestones")
    .insert({
      goal_id:     input.goal_id,
      title:       input.title,
      due_date:    input.due_date ?? null,
      order_index: input.order_index ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMilestone(input: UpdateMilestoneInput): Promise<GoalMilestone> {
  const supabase = createClient();
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from("goal_milestones")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMilestone(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("goal_milestones").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderMilestones(
  updates: { id: string; order_index: number }[]
): Promise<void> {
  const supabase = createClient();
  await supabase.from("goal_milestones").upsert(updates, { onConflict: "id" });
}

// =====================================================
// LINKED TASKS
// =====================================================

export async function getLinkedTasks(goalId: string): Promise<LinkedTask[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  // Vérifie que le goal appartient à l'org avant de lire ses tâches
  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("org_id", orgId)
    .single();

  if (!goal) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, priority, completed_at, due_date, status:statuses(name, color, type, is_completed), project:projects(name)")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((t: any) => ({
    id:           t.id,
    title:        t.title,
    priority:     t.priority,
    completed_at: t.completed_at,
    due_date:     t.due_date ?? null,
    project_name: t.project?.name ?? null,
    status:       t.status,
  }));
}

export async function linkTaskToGoal(taskId: string, goalId: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("org_id", orgId)
    .single();

  if (!task) throw new Error("Task not found or access denied.");

  const { error } = await supabase
    .from("tasks")
    .update({ goal_id: goalId })
    .eq("id", taskId)
    .eq("org_id", orgId);
  if (error) throw error;
}

export async function unlinkTaskFromGoal(taskId: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { error } = await supabase
    .from("tasks")
    .update({ goal_id: null })
    .eq("id", taskId)
    .eq("org_id", orgId);
  if (error) throw error;
}

// =====================================================
// LINKED HABITS
// =====================================================

function calcHabitStreak(
  habitId: string,
  completions: { habit_id: string; completed_date: string }[],
  isDaily: boolean,
): number {
  const dates = new Set(
    completions.filter((c) => c.habit_id === habitId).map((c) => c.completed_date),
  );
  if (dates.size === 0) return 0;
  if (!isDaily) return 1;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const startFrom = dates.has(todayStr) ? 0 : 1;

  let streak = 0;
  for (let i = startFrom; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dates.has(s)) streak++;
    else break;
  }
  return streak;
}

export async function getLinkedHabits(goalId: string): Promise<LinkedHabit[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("org_id", orgId)
    .single();

  if (!goal) return [];

  const { data: habits, error } = await supabase
    .from("habits")
    .select("id, title, icon, color, frequency")
    .eq("goal_id", goalId)
    .eq("org_id", orgId)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!habits || habits.length === 0) return [];

  type HabitRow = { id: string; title: string; icon: string; color: string; frequency: string };
  const habitIds = (habits as HabitRow[]).map((h: HabitRow) => h.id);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const from30 = new Date();
  from30.setDate(from30.getDate() - 29);
  const from30Str = `${from30.getFullYear()}-${String(from30.getMonth() + 1).padStart(2, "0")}-${String(from30.getDate()).padStart(2, "0")}`;

  const [todayRes, recentRes] = await Promise.all([
    supabase
      .from("habit_completions")
      .select("habit_id")
      .eq("completed_date", todayStr)
      .in("habit_id", habitIds),
    supabase
      .from("habit_completions")
      .select("habit_id, completed_date")
      .in("habit_id", habitIds)
      .gte("completed_date", from30Str)
      .lte("completed_date", todayStr),
  ]);

  const todaySet = new Set((todayRes.data ?? []).map((c: { habit_id: string }) => c.habit_id));
  const recent = recentRes.data ?? [];

  return (habits as HabitRow[]).map((h: HabitRow) => ({
    id:              h.id,
    title:           h.title,
    icon:            h.icon,
    color:           h.color,
    completed_today: todaySet.has(h.id),
    current_streak:  calcHabitStreak(h.id, recent, h.frequency === "daily"),
  }));
}

export async function linkHabitToGoal(habitId: string, goalId: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("org_id", orgId)
    .single();

  if (!habit) throw new Error("Habit not found or access denied.");

  const { error } = await supabase
    .from("habits")
    .update({ goal_id: goalId })
    .eq("id", habitId)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function unlinkHabitFromGoal(habitId: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { error } = await supabase
    .from("habits")
    .update({ goal_id: null })
    .eq("id", habitId)
    .eq("org_id", orgId);
  if (error) throw error;
}

// =====================================================
// AVAILABLE ITEMS (for link pickers)
// =====================================================

export async function getAvailableTasksForGoal(): Promise<AvailableTask[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, project_id, projects(name, workspaces(name))")
    .eq("org_id", orgId)
    .is("goal_id", null)
    .eq("is_archived", false)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((t: any) => ({
    id:             t.id,
    title:          t.title,
    project_id:     t.project_id,
    project_name:   t.projects?.name             ?? "Unknown",
    workspace_name: t.projects?.workspaces?.name ?? "Unknown",
  }));
}

export async function getAvailableHabitsForGoal(): Promise<AvailableHabit[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("habits")
    .select("id, title, icon")
    .eq("org_id", orgId)
    .is("goal_id", null)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as AvailableHabit[];
}

// =====================================================
// REVIEW RITUAL
// =====================================================

function toLocalDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// All past reviews for the org, newest first — powers the Reviews history.
export async function getReviews(): Promise<GoalReview[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goal_reviews")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GoalReview[];
}

// The most recent review (or null) — used both for the "due" nudge and as the
// snapshot anchor for the next review's movement mirror.
export async function getLastReview(): Promise<GoalReview | null> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("goal_reviews")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as GoalReview | null) ?? null;
}

// Pre-compute a fresh review: the period it covers + the movement mirror (each
// active goal's current progress and its delta vs the last review's snapshot).
export async function getReviewDraft(): Promise<ReviewDraft> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const today = toLocalDate();

  const [{ data: goals, error }, last] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, category, progress")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("priority", { ascending: true }),
    getLastReview(),
  ]);
  if (error) throw error;

  const prev = new Map<string, number>(
    (last?.snapshot ?? []).map((s) => [s.goal_id, s.progress]),
  );

  type Row = { id: string; title: string; category: Goal["category"]; progress: number };
  const movements: ReviewMovement[] = ((goals ?? []) as Row[]).map((g) => {
    const had  = prev.has(g.id);
    const base = prev.get(g.id);
    return {
      goal_id:  g.id,
      title:    g.title,
      category: g.category,
      progress: g.progress,
      delta:    had && base != null ? g.progress - base : null,
      isNew:    !had && !!last, // only flag "new" when there WAS a prior review to be new against
    };
  });

  // Most movement first (then highest progress) so the mirror leads with signal.
  movements.sort((a, b) => (Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)) || (b.progress - a.progress));

  const period_start = last ? last.period_end : toLocalDate(new Date(Date.now() - 7 * 86_400_000));
  return { period_start, period_end: today, movements };
}

// Format the review as a Journal section — the bridge that lands a review in the
// Journal timeline (tagged `review`), appended to today's entry if one exists.
function reviewToMarkdown(input: CreateReviewInput, movements: ReviewMovement[]): string {
  const moved = movements
    .filter((m) => (m.delta ?? 0) > 0)
    .map((m) => `${m.title} +${m.delta}%`)
    .join(" · ");
  const lines = [
    `## Weekly Review — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    "",
    `**Wins**\n${input.wins.trim() || "—"}`,
    "",
    `**Blockers**\n${input.blockers.trim() || "—"}`,
    "",
    `**Focus next week**\n${input.focus.trim() || "—"}`,
  ];
  if (moved) { lines.push("", `_Goals that moved: ${moved}_`); }
  return lines.join("\n");
}

// Write the review into the Journal (the "bridge"): append to today's entry, or
// create a new one. Returns the journal entry id (or null on any failure — the
// review itself must never fail because the mirror copy did).
async function mirrorReviewToJournal(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  markdown: string,
): Promise<string | null> {
  try {
    const today = toLocalDate();
    const { data: existing } = await supabase
      .from("journal_entries")
      .select("id, content, tags")
      .eq("org_id", orgId)
      .eq("entry_date", today)
      .maybeSingle();

    if (existing) {
      const tags = Array.from(new Set([...(existing.tags ?? []), "review"]));
      const content = existing.content?.trim()
        ? `${existing.content.trim()}\n\n---\n\n${markdown}`
        : markdown;
      const { data, error } = await supabase
        .from("journal_entries")
        .update({ content, tags })
        .eq("id", existing.id)
        .eq("org_id", orgId)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ org_id: orgId, user_id: userId, entry_date: today, content: markdown, tags: ["review"] })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  } catch {
    return null;
  }
}

export async function createReview(input: CreateReviewInput): Promise<GoalReview> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Snapshot the current active goals — this becomes the anchor for the next review.
  const draft = await getReviewDraft();
  const snapshot: ReviewGoalSnapshot[] = draft.movements.map((m) => ({
    goal_id:  m.goal_id,
    title:    m.title,
    progress: m.progress,
  }));

  const journalId = input.saveToJournal
    ? await mirrorReviewToJournal(supabase, orgId, user.id, reviewToMarkdown(input, draft.movements))
    : null;

  const { data, error } = await supabase
    .from("goal_reviews")
    .insert({
      org_id:           orgId,
      user_id:          user.id,
      period_start:     draft.period_start,
      period_end:       draft.period_end,
      wins:             input.wins.trim(),
      blockers:         input.blockers.trim(),
      focus:            input.focus.trim(),
      snapshot,
      journal_entry_id: journalId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as GoalReview;
}
