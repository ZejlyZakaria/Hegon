import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  Habit,
  HabitCompletion,
  HabitSkip,
  HabitPause,
  HabitFreeze,
  HeatmapDay,
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
