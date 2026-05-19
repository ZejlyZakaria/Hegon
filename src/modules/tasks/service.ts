import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  Task,
  Project,
  Workspace,
  Status,
  Assignee,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
} from "./types";

// =====================================================
// TASKS
// =====================================================

export async function getTasks(projectId: string): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`*, status:statuses(*), project:projects(*), task_tags(tag:tags(*))`)
    .eq("project_id", projectId)
    .eq("is_archived", false)
    .order("position", { ascending: true });

  if (error) throw error;

  type TaskRow = { assignee_id: string | null; task_tags?: { tag: unknown }[]; [key: string]: unknown };
  type ProfileRow = { id: string; email: string; full_name: string | null; avatar_url: string | null };

  const tasks = (data || []).map((task: TaskRow) => ({
    ...task,
    tags: task.task_tags?.map((tt: { tag: unknown }) => tt.tag).filter(Boolean) || [],
  }));

  // Fetch assignee profiles in a single query
  const assigneeIds = [...new Set(tasks.filter((t: TaskRow) => t.assignee_id).map((t: TaskRow) => t.assignee_id as string))];
  if (assigneeIds.length === 0) return tasks as Task[];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", assigneeIds);

  const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((p: ProfileRow) => [p.id, p]));

  return tasks.map((task: TaskRow) => ({
    ...task,
    assignee: task.assignee_id ? (profileMap.get(task.assignee_id) ?? null) : null,
  })) as Task[];
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

  // position is set atomically by the set_task_position BEFORE INSERT trigger (§1.3)
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      created_by: user.id,
      assignee_id: input.assignee_id ?? user.id,
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

  // Resolve completed_at from the new status
  const { data: status } = await supabase
    .from("statuses")
    .select("is_completed")
    .eq("id", task.status_id)
    .single();

  // Update
  const updatePayload: Record<string, unknown> = {
    title:           task.title.trim(),
    description:     task.description?.trim() || null,
    priority:        task.priority || "medium",
    status_id:       task.status_id,
    due_date:        task.due_date,
    estimated_hours: task.estimated_hours,
    completed_at:    status?.is_completed ? new Date().toISOString() : null,
    updated_at:      new Date().toISOString(),
  };
  if (task.goal_id !== undefined) updatePayload.goal_id = task.goal_id;
  if (task.assignee_id !== undefined) updatePayload.assignee_id = task.assignee_id;

  const { data, error } = await supabase
    .from("tasks")
    .update(updatePayload)
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

  // Resolve completed_at from the new status
  const { data: status } = await supabase
    .from("statuses")
    .select("is_completed")
    .eq("id", newStatusId)
    .single();

  // Move — RLS enforces access control
  const { error } = await supabase
    .from("tasks")
    .update({
      status_id:    newStatusId,
      position:     newPosition,
      completed_at: status?.is_completed ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error("Move task error:", error);
    throw error;
  }
}

export async function deleteTask(taskId: string) {
  const supabase = createClient();

  // Delete — RLS enforces access control
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) throw error;
}

export async function archiveTask(taskId: string) {
  const supabase = createClient();

  // Archive — RLS enforces access control
  const { error } = await supabase
    .from("tasks")
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) throw error;
}

export async function getProjectAssignees(projectId: string): Promise<Assignee[]> {
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return [];

  const [{ data: workspace }, { data: members }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("user_id")
      .eq("id", project.workspace_id)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", project.workspace_id),
  ]);

  const userIds = new Set<string>();
  if (workspace?.user_id) userIds.add(workspace.user_id);
  for (const m of members ?? []) userIds.add(m.user_id);

  if (userIds.size === 0) return [];

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", Array.from(userIds))
    .order("full_name", { ascending: true });

  if (error) throw error;
  return profiles ?? [];
}

export async function getProfileById(userId: string): Promise<Assignee | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
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

export async function createProject(input: { workspace_id: string; name: string; description?: string | null }) {
  const supabase = createClient();

  // position is set atomically by the set_project_position BEFORE INSERT trigger (§1.3)
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, status: "active" })
    .select()
    .single();

  if (error) throw error;

  // Auto-create default statuses (org_id also derived by trigger from project_id)
  const defaultStatuses = [
    { name: "Backlog",     color: "#4b5563", position: 1, is_completed: false },
    { name: "To Do",       color: "#6b7280", position: 2, is_completed: false },
    { name: "In Progress", color: "#f59e0b", position: 3, is_completed: false },
    { name: "Done",        color: "#3b82f6", position: 4, is_completed: true  },
  ];

  await supabase.from("statuses").insert(
    defaultStatuses.map((s) => ({ ...s, project_id: data.id }))
  );

  return data as Project;
}

export async function updateProject(projectId: string, updates: { name?: string; description?: string | null }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(projectId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

// =====================================================
// WORKSPACES
// =====================================================

export async function getWorkspaces() {
  const supabase = createClient();
  // RLS retourne automatiquement : owned workspaces (org_isolation) + member workspaces (workspace_member_read)
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("position", { ascending: true });

  if (error) throw error;
  return data as Workspace[];
}

export async function getWorkspaceMembers(workspaceId: string): Promise<import("./types").WorkspaceMember[]> {
  const supabase = createClient();

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role, invited_by, created_at")
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  if (!members || members.length === 0) return [];

  type WMemberRow = { workspace_id: string; user_id: string; role: string; invited_by: string | null; created_at: string };
  type WProfileRow = { id: string; email: string; full_name: string | null; avatar_url: string | null };
  const userIds = (members as WMemberRow[]).map((m: WMemberRow) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(((profiles ?? []) as WProfileRow[]).map((p: WProfileRow) => [p.id, p]));

  return (members as WMemberRow[]).map((m: WMemberRow) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? null,
  }));
}

export async function createWorkspaceInvitation(workspaceId: string, email: string): Promise<import("./types").WorkspaceInvitation> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // §5.3: owner-only check — members cannot invite
  type WorkspaceRow = { org_id: string; user_id: string };
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("org_id, user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace) throw new Error("Workspace not found");
  if ((workspace as WorkspaceRow).user_id !== user.id) throw new Error("Only the workspace owner can invite members");

  // §5.4: rate limit — max 10 invitations per hour per user (DB-level count, no external service needed)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("org_invitations")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", user.id)
    .gt("created_at", oneHourAgo);

  if ((count ?? 0) >= 10) throw new Error("Too many invitations sent. Please wait before sending more.");

  const { data, error } = await supabase
    .from("org_invitations")
    .insert({
      org_id: (workspace as WorkspaceRow).org_id,
      workspace_id: workspaceId,
      invited_by: user.id,
      email: email.trim().toLowerCase(),
      role: "member",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getWorkspaceInvitations(workspaceId: string): Promise<import("./types").WorkspaceInvitation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("org_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function revokeWorkspaceInvitation(invitationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("org_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) throw error;
}

export async function createWorkspace(name: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const orgId = await getCurrentOrgId();

  const { data: maxPosData } = await supabase
    .from("workspaces")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newPosition = (maxPosData?.position || 0) + 1;

  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name, user_id: user.id, position: newPosition, org_id: orgId })
    .select()
    .single();

  if (error) throw error;
  return data as Workspace;
}

export async function updateWorkspace(workspaceId: string, updates: { name?: string; description?: string | null }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .select()
    .single();

  if (error) throw error;
  return data as Workspace;
}

export async function deleteWorkspace(workspaceId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);
  if (error) throw error;
}

// =====================================================
// TAGS
// =====================================================

export async function getTags(workspaceId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data as import("./types").Tag[];
}

export async function createTag(workspaceId: string, name: string, color: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // org_id derived by BEFORE INSERT trigger from workspace_id
  const { data, error } = await supabase
    .from("tags")
    .insert({ name: name.trim(), color, user_id: user.id, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw error;
  return data as import("./types").Tag;
}

export async function getProjectWorkspaceId(projectId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

export async function deleteTag(tagId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw error;
}

export async function updateTag(tagId: string, updates: { name?: string; color?: string }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tags")
    .update(updates)
    .eq("id", tagId)
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").Tag;
}

export async function addTagToTask(taskId: string, tagId: string) {
  const supabase = createClient();
  // org_id derived by BEFORE INSERT trigger from task_id
  const { error } = await supabase
    .from("task_tags")
    .insert({ task_id: taskId, tag_id: tagId });
  if (error) throw error;
}

export async function removeTagFromTask(taskId: string, tagId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId)
    .eq("tag_id", tagId);
  if (error) throw error;
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