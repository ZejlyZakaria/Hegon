import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  Habit,
  HabitCompletion,
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

  const habitIds = habits.map((h) => h.id);

  const { data, error } = await supabase
    .from("habit_completions")
    .select("completed_date")
    .in("habit_id", habitIds)
    .gte("completed_date", from)
    .lte("completed_date", to);

  if (error) throw error;

  // Group by date and count
  const grouped = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.completed_date] = (acc[row.completed_date] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}
