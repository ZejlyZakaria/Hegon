import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import { resolveActivityTickDate, computeStreak, isWeeklyAnyDay, toDateStr } from "./utils";
import type {
  Habit,
  HabitCompletion,
  HabitSkip,
  HabitPause,
  HabitFreeze,
  HeatmapDay,
  HabitSourceModule,
  CreateHabitInput,
  UpdateHabitInput,
  CompleteHabitInput,
} from "./types";

// =====================================================
// HABITS
// =====================================================

export async function getHabits(): Promise<Habit[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("habits")
    .select("*, goal:goals(id, title)")
    .eq("org_id", orgId)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("habits")
    .insert({
      org_id:      orgId,
      user_id:     user.id,
      title:       input.title,
      description: input.description ?? null,
      frequency:   input.frequency ?? "daily",
      custom_days: input.custom_days ?? null,
      goal_id:     input.goal_id ?? null,
      color:       input.color ?? "#f43f5e",
      icon:        input.icon  ?? "star",
      source_module: input.source_module ?? null,
      source_key:    input.source_key ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHabit(input: UpdateHabitInput): Promise<Habit> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from("habits")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveHabit(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { error } = await supabase
    .from("habits")
    .update({ archived: true })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function unarchiveHabit(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { error } = await supabase
    .from("habits")
    .update({ archived: false })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function getArchivedHabits(): Promise<Habit[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("habits")
    .select("*, goal:goals(id, title)")
    .eq("org_id", orgId)
    .eq("archived", true)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
}

// Force-delete: removes the habit AND all its history (completions, skips, pauses,
// freezes). Backs the explicit "Delete permanently" action — bypasses the
// completion guard on deleteHabit (which steers casual deletes toward archiving).
export async function deleteHabitPermanently(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  if (!habit) throw new Error("Access denied.");

  // Remove dependent rows first (robust even without ON DELETE CASCADE).
  await supabase.from("habit_completions").delete().eq("habit_id", id);
  await supabase.from("habit_skips").delete().eq("habit_id", id);
  await supabase.from("habit_pauses").delete().eq("habit_id", id);
  await supabase.from("habit_freezes").delete().eq("habit_id", id);

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function deleteHabit(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  // Only delete if no completions recorded
  const { count } = await supabase
    .from("habit_completions")
    .select("id", { count: "exact", head: true })
    .eq("habit_id", id);

  if (count && count > 0) {
    throw new Error("Cannot delete a habit with recorded completions. Archive it instead.");
  }

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

// =====================================================
// COMPLETIONS
// =====================================================

export async function completeHabit(input: CompleteHabitInput): Promise<HabitCompletion> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", input.habit_id)
    .eq("org_id", orgId)
    .single();
  if (!habit) throw new Error("Access denied.");

  const { data, error } = await supabase
    .from("habit_completions")
    .upsert(
      {
        habit_id:       input.habit_id,
        completed_date: input.completed_date,
        note:           input.note ?? null,
      },
      { onConflict: "habit_id,completed_date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uncompleteHabit(habitId: string, date: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("org_id", orgId)
    .single();
  if (!habit) throw new Error("Access denied.");

  const { error } = await supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("completed_date", date);

  if (error) throw error;
}

// All completions for a specific date scoped to the provided habit ids
export async function getDayCompletions(date: string, habitIds: string[]): Promise<HabitCompletion[]> {
  if (habitIds.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("habit_completions")
    .select("*")
    .eq("completed_date", date)
    .in("habit_id", habitIds);

  if (error) throw error;
  return data ?? [];
}

// Completions for a habit over a date range (calendar view + streak calc)
export async function getHabitCompletionsRange(
  habitId: string,
  from: string,
  to: string
): Promise<HabitCompletion[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("habit_completions")
    .select("*")
    .eq("habit_id", habitId)
    .gte("completed_date", from)
    .lte("completed_date", to)
    .order("completed_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Completions for multiple habits over a date range (used to compute streaks in Today view)
export async function getCompletionsForHabits(
  habitIds: string[],
  from: string,
  to: string
): Promise<{ habit_id: string; completed_date: string }[]> {
  if (habitIds.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("habit_completions")
    .select("habit_id, completed_date")
    .in("habit_id", habitIds)
    .gte("completed_date", from)
    .lte("completed_date", to)
    .order("completed_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// =====================================================
// CROSS-MODULE AUTO-COMPLETION (Watching/Books → Habits)
// =====================================================

export interface ActivityTick {
  habitId: string;
  title:   string;
  date:    string;  // 'YYYY-MM-DD' the scheduled day that was ticked
  streak:  number;  // current streak after the tick (days, or weeks if weekly-any-day)
  weekly:  boolean; // true = weekly-any-day → "this week" wording
}

/**
 * Reconcile habit completions from activity in another module. For every active
 * habit linked to `module` (optionally filtered by `source_key` = type), ticks the
 * scheduled completion day each matching activity satisfies (see resolveActivityTickDate).
 * Idempotent — only inserts completions that don't already exist. Never removes.
 * Returns the completions newly created (for the toast). Best-effort caller.
 */
export async function autoTickHabitsFromActivity(
  module: HabitSourceModule,
  activity: { type: string | null; date: string }[],
): Promise<ActivityTick[]> {
  if (activity.length === 0) return [];

  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: habitRows, error: habitsErr } = await supabase
    .from("habits")
    .select("id, title, frequency, custom_days, source_key, created_at")
    .eq("org_id", orgId)
    .eq("archived", false)
    .eq("source_module", module);
  if (habitsErr) throw habitsErr;

  type LinkedHabit = Pick<Habit, "id" | "title" | "frequency" | "custom_days" | "source_key" | "created_at">;
  const habits = (habitRows ?? []) as LinkedHabit[];
  if (habits.length === 0) return [];

  // Desired (habit, scheduled-date) ticks, de-duplicated. (streak/weekly added later.)
  const desired = new Map<string, { habitId: string; title: string; date: string }>();
  for (const h of habits) {
    const createdDay = h.created_at.slice(0, 10);
    const matching = activity.filter((a) => !h.source_key || a.type === h.source_key);
    for (const a of matching) {
      // Don't credit activity from before the habit existed (no retroactive streaks).
      if (a.date < createdDay) continue;
      const tickDate = resolveActivityTickDate(h, a.date);
      if (!tickDate) continue;
      desired.set(`${h.id}|${tickDate}`, { habitId: h.id, title: h.title, date: tickDate });
    }
  }
  if (desired.size === 0) return [];

  const wanted = [...desired.values()];
  const habitIds = [...new Set(wanted.map((d) => d.habitId))];
  const dates = wanted.map((d) => d.date);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  const { data: existing, error: existErr } = await supabase
    .from("habit_completions")
    .select("habit_id, completed_date")
    .in("habit_id", habitIds)
    .gte("completed_date", minDate)
    .lte("completed_date", maxDate);
  if (existErr) throw existErr;

  const existingSet = new Set(
    (existing ?? []).map((c: { habit_id: string; completed_date: string }) => `${c.habit_id}|${c.completed_date}`),
  );

  const toInsert = wanted.filter((d) => !existingSet.has(`${d.habitId}|${d.date}`));
  if (toInsert.length === 0) return [];

  const { error: insertErr } = await supabase
    .from("habit_completions")
    .upsert(
      toInsert.map((t) => ({ habit_id: t.habitId, completed_date: t.date, note: null })),
      { onConflict: "habit_id,completed_date" },
    );
  if (insertErr) throw insertErr;

  // Post-tick streak per ticked habit (for the ripple toast) — one batched fetch.
  const sinceD = new Date();
  sinceD.setDate(sinceD.getDate() - 372);
  const { data: comps } = await supabase
    .from("habit_completions")
    .select("habit_id, completed_date")
    .in("habit_id", habitIds)
    .gte("completed_date", toDateStr(sinceD));

  const doneByHabit = new Map<string, Set<string>>();
  for (const c of (comps ?? []) as { habit_id: string; completed_date: string }[]) {
    const set = doneByHabit.get(c.habit_id) ?? new Set<string>();
    set.add(c.completed_date);
    doneByHabit.set(c.habit_id, set);
  }
  const byId = new Map(habits.map((h) => [h.id, h]));

  return toInsert.map((t) => {
    const h = byId.get(t.habitId)!;
    const { current } = computeStreak(h, doneByHabit.get(t.habitId) ?? new Set());
    return { ...t, streak: current, weekly: isWeeklyAnyDay(h) };
  });
}

// =====================================================
// SKIPS & PAUSES
// =====================================================

// Skip dates for many habits over a range (Today + streak computation)
export async function getSkipsForHabits(
  habitIds: string[],
  from: string,
  to: string,
): Promise<{ habit_id: string; skip_date: string }[]> {
  if (habitIds.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("habit_skips")
    .select("habit_id, skip_date")
    .in("habit_id", habitIds)
    .gte("skip_date", from)
    .lte("skip_date", to);

  if (error) throw error;
  return data ?? [];
}

// All pauses for many habits (pauses are few; no range filter needed)
export async function getPausesForHabits(
  habitIds: string[],
): Promise<{ habit_id: string; pause_start: string; pause_end: string | null }[]> {
  if (habitIds.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("habit_pauses")
    .select("habit_id, pause_start, pause_end")
    .in("habit_id", habitIds);

  if (error) throw error;
  return data ?? [];
}

export async function getHabitSkips(habitId: string): Promise<HabitSkip[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("habit_skips")
    .select("*")
    .eq("habit_id", habitId)
    .order("skip_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getHabitPauses(habitId: string): Promise<HabitPause[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("habit_pauses")
    .select("*")
    .eq("habit_id", habitId)
    .order("pause_start", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addSkip(
  habitId: string,
  date: string,
  reason?: string | null,
): Promise<HabitSkip> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("habit_skips")
    .upsert(
      { habit_id: habitId, skip_date: date, reason: reason ?? null },
      { onConflict: "habit_id,skip_date" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeSkip(habitId: string, date: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("habit_skips")
    .delete()
    .eq("habit_id", habitId)
    .eq("skip_date", date);

  if (error) throw error;
}

export async function addPause(
  habitId: string,
  pauseStart: string,
  pauseEnd: string | null,
): Promise<HabitPause> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("habit_pauses")
    .insert({ habit_id: habitId, pause_start: pauseStart, pause_end: pauseEnd })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removePause(pauseId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("habit_pauses")
    .delete()
    .eq("id", pauseId);

  if (error) throw error;
}

// ─── FREEZES (streak protection) ─────────────────────────────────────────────

export async function getFreezesForHabits(
  habitIds: string[],
  from: string,
  to: string,
): Promise<{ habit_id: string; freeze_date: string }[]> {
  if (habitIds.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("habit_freezes")
    .select("habit_id, freeze_date")
    .in("habit_id", habitIds)
    .gte("freeze_date", from)
    .lte("freeze_date", to);

  if (error) throw error;
  return data ?? [];
}

export async function getHabitFreezes(habitId: string): Promise<HabitFreeze[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("habit_freezes")
    .select("*")
    .eq("habit_id", habitId)
    .order("freeze_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Count freezes used in the current calendar month (budget enforcement).
// Counts by when the freeze was applied (created_at), not the protected day —
// a freeze usually protects a day in the previous days/month.
export async function getMonthlyFreezeCount(): Promise<number> {
  const supabase = createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from("habit_freezes")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStart);

  if (error) throw error;
  return count ?? 0;
}

export async function addFreeze(habitId: string, date: string): Promise<HabitFreeze> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("habit_freezes")
    .upsert(
      { habit_id: habitId, freeze_date: date },
      { onConflict: "habit_id,freeze_date" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFreeze(habitId: string, date: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("habit_freezes")
    .delete()
    .eq("habit_id", habitId)
    .eq("freeze_date", date);

  if (error) throw error;
}

// All habits heatmap — completions grouped by date over a range
export async function getHeatmapData(from: string, to: string): Promise<HeatmapDay[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  // Get all habit ids for this org first
  const { data: habits } = await supabase
    .from("habits")
    .select("id")
    .eq("org_id", orgId)
    .eq("archived", false);

  if (!habits || habits.length === 0) return [];

  const habitIds = (habits as { id: string }[]).map((h: { id: string }) => h.id);

  const { data, error } = await supabase
    .from("habit_completions")
    .select("completed_date")
    .in("habit_id", habitIds)
    .gte("completed_date", from)
    .lte("completed_date", to);

  if (error) throw error;

  // Group by date and count
  type CompletionRow = { completed_date: string };
  const rows = (data ?? []) as CompletionRow[];
  const grouped: Record<string, number> = rows.reduce((acc: Record<string, number>, row: CompletionRow) => {
    acc[row.completed_date] = (acc[row.completed_date] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}
