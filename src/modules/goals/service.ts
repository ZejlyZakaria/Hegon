import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  Goal,
  GoalMilestone,
  LinkedTask,
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
      category:      input.category ?? null,
      priority:      input.priority ?? "medium",
      progress_mode: input.progress_mode ?? "manual",
      target_date:   input.target_date ?? null,
    })
    .select()
    .single();

  if (error) throw error;
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
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}

// =====================================================
// PROGRESS
// =====================================================

export async function recalculateProgress(goalId: string): Promise<number> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, completed_at")
    .eq("goal_id", goalId);

  if (error) throw error;
  if (!tasks || tasks.length === 0) return 0;

  const completed = tasks.filter((t) => t.completed_at !== null).length;
  const progress = Math.round((completed / tasks.length) * 100);

  await supabase
    .from("goals")
    .update({ progress })
    .eq("id", goalId)
    .eq("org_id", orgId);

  return progress;
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
    .select("id, title, priority, completed_at, status:statuses(name, color, is_completed)")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any[];
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
