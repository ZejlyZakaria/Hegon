"use client";

import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { createFirstProject } from "@/modules/tasks/actions/onboarding";
import { useTasksStore } from "@/modules/tasks/store"
import { toast } from "@/shared/utils/toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/utils"

// =====================================================
// TASKS EMPTY STATE — Linear-style onboarding
// =====================================================

// Mini kanban preview — purely decorative
function KanbanPreview() {
  const columns = [
    {
      label: "Backlog",
      color: "bg-orange-500",
      tasks: ["Redesign homepage", "Write API docs"],
    },
    {
      label: "In Progress",
      color: "bg-yellow-500",
      tasks: ["Auth flow", "Fix nav bug"],
    },
    {
      label: "Done",
      color: "bg-blue-500",
      tasks: ["Setup repo", "CI pipeline"],
    },
  ];

  return (
    <div className="flex gap-2 w-full max-w-sm mx-auto select-none pointer-events-none">
      {columns.map((col) => (
        <div key={col.label} className="flex-1 flex flex-col gap-1.5">
          {/* Column header */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className={cn("w-2 h-2 rounded-full", col.color)} />
            <span className="text-[10px] font-medium text-zinc-500">{col.label}</span>
          </div>
          {/* Task cards */}
          {col.tasks.map((task) => (
            <div
              key={task}
              className="px-2 py-1.5 rounded-md bg-zinc-900 border border-white/5 text-[10px] text-zinc-400 leading-tight"
            >
              {task}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TasksEmptyState() {
  const [isCreating, setIsCreating] = useState(false);
  const { setSelectedProjectId } = useTasksStore();
  const queryClient = useQueryClient();

  const handleCreateFirstProject = async () => {
  setIsCreating(true);

  try {
    const result = await createFirstProject();

    if (result.success && result.projectId) {
      // Invalide les queries
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      
      // Attends un petit délai pour que les queries se mettent à jour
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Auto-sélectionne le projet
      setSelectedProjectId(result.projectId);
      
      toast.success("Project created");
    } else {
      toast.error(result.error || "Failed to create project");
    }
  } catch (error) {
    console.error("Setup error:", error);
    toast.error("Something went wrong");
  } finally {
    setIsCreating(false);
  }
};

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full flex flex-col items-center gap-8">

        {/* Mini kanban illustration */}
        <div className="w-full p-4 rounded-xl border border-white/5 bg-zinc-950/60">
          <KanbanPreview />
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">
            Create your first project
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Organize your work into projects with boards, lists and calendars.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleCreateFirstProject}
          disabled={isCreating}
          className={cn(
            "flex items-center gap-2 px-4 h-9 rounded-lg",
            "bg-zinc-800 border border-white/8 text-zinc-100 text-sm font-medium",
            "hover:bg-zinc-700 hover:border-white/12 transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isCreating ? (
            <>
              <Loader2 size={15} className="animate-spin text-zinc-400" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <Plus size={15} />
              <span>Create project</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
}
