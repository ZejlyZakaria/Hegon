/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/infrastructure/supabase/client";
import type {
  Task,
  Project,
  Workspace,
  Status,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
} from "./types";

// =====================================================
// TASKS
// =====================================================

export async function getTasks(projectId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      status:statuses(*),
      project:projects(*),
      task_tags(
        tag:tags(*)
      )
    `,
    )
    .eq("project_id", projectId)
    .eq("is_archived", false)
    .order("position", { ascending: true });

  if (error) throw error;

  // Transform tags structure
  const tasks = (data || []).map((task: any) => ({
    ...task,
    tags: task.task_tags?.map((tt: any) => tt.tag).filter(Boolean) || [],
  }));

  return tasks as Task[];
}

export async function createTask(input: CreateTaskInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Validation
  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Title is required");
  }

  if (input.title.length > 255) {
    throw new Error("Title is too long (max 255 characters)");
  }

  if (!input.status_id) {
    throw new Error("Status is required");
  }

  // Get max position in status
  const { data: maxPosData } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", input.project_id)
    .eq("status_id", input.status_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newPosition = (maxPosData?.position || 0) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      created_by: user.id,
      assignee_id: user.id,
      position: newPosition,
    })
    .select(
      `
      *,
      status:statuses(*),
      project:projects(*)
    `,
    )
    .single();

  if (error) throw error;
  return data as Task;
}

export async function updateTask(task: UpdateTaskInput): Promise<Task> {
  const supabase = createClient();

  // Validation
  if (!task.title || task.title.trim().length === 0) {
    throw new Error("Title is required");
  }

  if (task.title.length > 255) {
    throw new Error("Title is too long (max 255 characters)");
  }

  if (!task.status_id) {
    throw new Error("Status is required");
  }

  // Verify ownership
  const { data: existingTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, created_by")
    .eq("id", task.id)
    .single();

  if (fetchError || !existingTask) {
    throw new Error("Task not found");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || existingTask.created_by !== user.id) {
    throw new Error("Unauthorized");
  }

  // Update
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: task.title.trim(),
      description: task.description?.trim() || null,
      priority: task.priority || "medium",
      status_id: task.status_id,
      due_date: task.due_date,
      estimated_hours: task.estimated_hours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Update failed");

  return data as Task;
}

export async function moveTask({
  taskId,
  newStatusId,
  newPosition,
}: MoveTaskInput) {
  const supabase = createClient();

  // Verify ownership
  const { data: existingTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, created_by")
    .eq("id", taskId)
    .single();

  if (fetchError || !existingTask) {
    throw new Error("Task not found");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || existingTask.created_by !== user.id) {
    throw new Error("Unauthorized");
  }

  // Move
  const { error } = await supabase
    .from("tasks")
    .update({
      status_id: newStatusId,
      position: newPosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error("Move task error:", error);
    throw error;
  }
}

export async function deleteTask(taskId: string) {
  const supabase = createClient();

  // Verify ownership
  const { data: existingTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, created_by")
    .eq("id", taskId)
    .single();

  if (fetchError || !existingTask) {
    throw new Error("Task not found");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || existingTask.created_by !== user.id) {
    throw new Error("Unauthorized");
  }

  // Delete
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) throw error;
}

export async function archiveTask(taskId: string) {
  const supabase = createClient();

  // Verify ownership
  const { data: existingTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, created_by")
    .eq("id", taskId)
    .single();

  if (fetchError || !existingTask) {
    throw new Error("Task not found");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || existingTask.created_by !== user.id) {
    throw new Error("Unauthorized");
  }

  // Archive
  const { error } = await supabase
    .from("tasks")
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) throw error;
}

// =====================================================
// PROJECTS
// =====================================================

export async function getProjects(workspaceId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      workspace:workspaces(*)
    `)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("position", { ascending: true });

  if (error) throw error;
  return data as Project[];
}

export async function createProject(project: Partial<Project>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

// =====================================================
// WORKSPACES
// =====================================================

export async function getWorkspaces(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data as Workspace[];
}

// =====================================================
// STATUSES
// =====================================================

export async function getStatuses(projectId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("statuses")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data as Status[];
}