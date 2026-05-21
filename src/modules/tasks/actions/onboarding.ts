// /lib/tasks/actions/onboarding.ts
"use server";

import { createServerClient } from "@/infrastructure/supabase/server"
import { getServerOrgId } from "@/shared/utils/getServerOrgId";
import { revalidatePath } from "next/cache";

// =====================================================
// AUTO-SETUP FOR FIRST-TIME USERS
// Creates workspace + project + default statuses
// =====================================================

interface SetupResult {
  success: boolean;
  projectId?: string;
  error?: string;
}

export async function createFirstProject(): Promise<SetupResult> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("❌ [AUTO-SETUP] Not authenticated");
    return { success: false, error: "Not authenticated" };
  }

  const orgId = await getServerOrgId(user.id);

  try {
    const { data: existingWorkspaces } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    let workspaceId: string;

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      workspaceId = existingWorkspaces[0].id;
    } else {
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name: "My Workspace",
          user_id: user.id,
          org_id: orgId,
        })
        .select("id")
        .single();

      if (workspaceError || !newWorkspace) {
        console.error("❌ [AUTO-SETUP] Workspace creation error:", workspaceError);
        return { success: false, error: "Failed to create workspace" };
      }

      workspaceId = newWorkspace.id;
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: "My First Project",
        workspace_id: workspaceId,
        color: "#3b82f6",
        org_id: orgId,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      console.error("❌ [AUTO-SETUP] Project creation error:", projectError);
      return { success: false, error: "Failed to create project" };
    }

    const defaultStatuses = [
      { name: "Backlog", color: "#6b7280", type: "backlog", position: 0 },
      { name: "To Do", color: "#6b7280", type: "todo", position: 1 },
      { name: "In Progress", color: "#f59e0b", type: "in_progress", position: 2 },
      { name: "Done", color: "#3b82f6", type: "done", position: 3 },
    ];

    const statusInserts = defaultStatuses.map((status) => ({
      ...status,
      project_id: project.id,
      org_id: orgId,
    }));

    const { error: statusError } = await supabase
      .from("statuses")
      .insert(statusInserts);

    if (statusError) {
      console.error("❌ [AUTO-SETUP] Status creation error:", statusError);
      return {
        success: true,
        projectId: project.id,
        error: "Project created but statuses failed",
      };
    }

    revalidatePath("/tasks");

    return {
      success: true,
      projectId: project.id,
    };
  } catch (error) {
    console.error("💥 [AUTO-SETUP] Unexpected error:", error);
    return { success: false, error: "Unexpected error during setup" };
  }
}
