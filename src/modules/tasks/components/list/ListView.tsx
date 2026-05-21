"use client";

import { useMemo } from "react";
import { useTasksStore } from "@/modules/tasks/store";
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { ListGroup } from "./ListGroup";
import type { Task } from "@/modules/tasks/types";
import { filterTasks } from "@/modules/tasks/lib/task-utils";
import { TasksSkeleton } from "../TasksSkeletons";

export function ListView() {
  const { selectedProjectId, filters } = useTasksStore();
  const { data: statuses, isLoading: statusesLoading } = useStatuses(selectedProjectId);
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks(selectedProjectId);

  const filteredTasks = useMemo(() => filterTasks(tasks ?? [], filters), [tasks, filters]);

  const getTasksByStatus = (statusId: string): Task[] =>
    filteredTasks
      .filter((t) => t.status_id === statusId)
      .sort((a, b) => a.position - b.position);

  if (statusesLoading || tasksLoading) return <TasksSkeleton />;

  if (tasksError) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-6 text-center max-w-sm">
          <p className="text-sm text-red-400 mb-3">Failed to load tasks.</p>
          <button
            type="button"
            onClick={() => void refetchTasks()}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!selectedProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--color-text-tertiary)" }}>Select a project</p>
      </div>
    );
  }

  if (!statuses || statuses.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--color-text-tertiary)" }}>No columns</p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 space-y-2">
      {statuses.map((status) => (
        <ListGroup
          key={status.id}
          status={status}
          tasks={getTasksByStatus(status.id)}
          projectId={selectedProjectId}
        />
      ))}
    </div>
  );
}
