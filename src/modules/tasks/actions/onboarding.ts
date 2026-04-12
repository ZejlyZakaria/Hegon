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
  console.log("🚀 [AUTO-SETUP] Starting...");
  
  const supabase = await createServerClient();

  // 1. Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("👤 [AUTO-SETUP] User:", user?.id);

  if (!user) {
    console.error("❌ [AUTO-SETUP] Not authenticated");
    return { success: false, error: "Not authenticated" };
  }

  const orgId = await getServerOrgId(user.id);

  try {
    // 2. Check if user already has a workspace
    console.log("📁 [AUTO-SETUP] Checking for existing workspace...");
    
    const { data: existingWorkspaces } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    console.log("📁 [AUTO-SETUP] Existing workspaces:", existingWorkspaces);

    let workspaceId: string;

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      // Use existing workspace
      workspaceId = existingWorkspaces[0].id;
      console.log("✅ [AUTO-SETUP] Using existing workspace:", workspaceId);
    } else {
      // Create first workspace
      console.log("🆕 [AUTO-SETUP] Creating new workspace...");
      
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
      console.log("✅ [AUTO-SETUP] Workspace created:", workspaceId);
    }

    // 3. Create the first project
    console.log("🆕 [AUTO-SETUP] Creating project...");
    
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

    console.log("✅ [AUTO-SETUP] Project created:", project.id);

    // 4. Create default statuses (Linear-style)
    console.log("🆕 [AUTO-SETUP] Creating statuses...");
    
    const defaultStatuses = [
      { name: "Backlog", color: "#6b7280", position: 0 },
      { name: "To Do", color: "#6b7280", position: 1 },
      { name: "In Progress", color: "#f59e0b", position: 2 },
      { name: "Done", color: "#3b82f6", position: 3 },
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

    console.log("✅ [AUTO-SETUP] Statuses created successfully");

    // 5. Revalidate cache
    revalidatePath("/tasks");

    console.log("🎉 [AUTO-SETUP] Complete! Project ID:", project.id);

    return {
      success: true,
      projectId: project.id,
    };
  } catch (error) {
    console.error("💥 [AUTO-SETUP] Unexpected error:", error);
    return { success: false, error: "Unexpected error during setup" };
  }
}