import { redirect } from "next/navigation";
import { createServerClient } from "@/infrastructure/supabase/server";
import { getDashboardData } from "@/modules/dashboard/service";
import DashboardHeader from "@/modules/dashboard/components/header/DashboardHeader";
import TodaySection from "@/modules/dashboard/components/today/TodaySection";
import ContinueWatchingSection from "@/modules/dashboard/components/continue-watching/ContinueWatchingSection";
import UpcomingSportsSection from "@/modules/dashboard/components/upcoming-sports/UpcomingSportsSection";
import TasksSection from "@/modules/dashboard/components/tasks/TasksSection";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  // Check if new user (no workspace = never completed setup)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspace) {
    // Create workspace + project + statuses for email/password signups
    const { data: newWorkspace } = await supabase
      .from("workspaces")
      .insert({ name: "My Workspace", user_id: user.id })
      .select("id")
      .single();

    if (newWorkspace) {
      const { data: project } = await supabase
        .from("projects")
        .insert({
          name: "My First Project",
          workspace_id: newWorkspace.id,
          color: "#3b82f6",
        })
        .select("id")
        .single();

      if (project) {
        await supabase.from("statuses").insert([
          {
            name: "Backlog",
            color: "#6b7280",
            position: 0,
            project_id: project.id,
          },
          {
            name: "To Do",
            color: "#6b7280",
            position: 1,
            project_id: project.id,
          },
          {
            name: "In Progress",
            color: "#f59e0b",
            position: 2,
            project_id: project.id,
          },
          {
            name: "Done",
            color: "#3b82f6",
            position: 3,
            project_id: project.id,
          },
        ]);
      }
    }

    redirect("/onboarding");
  }

  const data = await getDashboardData(user.id);

  const userName =
    user.user_metadata?.full_name?.split(" ")[0] ??
    user.user_metadata?.name?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <div className="min-h-screen bg-[#09090b] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-3 space-y-6">
        <DashboardHeader
          userName={userName}
          hasTask={data.tasks.length > 0}
          hasMatch={data.todaySportEvents.length > 0}
        />

        <TodaySection data={data} />

        {/* Continue Watching + Upcoming in Sports — side by side */}
        {(data.inProgressMediaList.length > 0 ||
          data.sportEvents.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ContinueWatchingSection mediaList={data.inProgressMediaList} />
            <UpcomingSportsSection events={data.sportEvents} />
          </div>
        )}

        <TasksSection userId={user.id} />
      </div>
    </div>
  );
}
