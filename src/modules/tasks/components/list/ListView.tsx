"use client";

import { useMemo } from "react";
import { useTasksStore } from "@/modules/tasks/store";
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { ListGroup } from "./ListGroup";
import type { Task } from "@/modules/tasks/types";
import { TasksSkeleton } from "../TasksSkeletons";

export function ListView() {
  const { selectedProjectId, filters } = useTasksStore();
  const { data: statuses, isLoading: statusesLoading } = useStatuses(selectedProjectId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(selectedProjectId);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
      if (filters.statuses.length && !filters.statuses.includes(task.status_id)) return false;
      if (filters.tags.length) {
        const ids = task.tags?.map((t) => t.id) || [];
        if (!filters.tags.some((id: string) => ids.includes(id))) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const getTasksByStatus = (statusId: string): Task[] =>
    filteredTasks
      .filter((t) => t.status_id === statusId)
      .sort((a, b) => a.position - b.position);

  if (statusesLoading || tasksLoading) return <TasksSkeleton />;

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
