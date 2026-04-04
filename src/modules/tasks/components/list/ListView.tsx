"use client";

import { useMemo } from "react";
import { useTasksStore } from "@/modules/tasks/store"
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { ListGroup } from "./ListGroup";
import type { Task } from "@/modules/tasks/types"
import { TasksSkeleton } from "../TasksSkeletons";

// =====================================================
// LIST VIEW COMPONENT — Linear style
// =====================================================

export function ListView() {

  const { selectedProjectId, filters } = useTasksStore();
  const { data: statuses, isLoading: statusesLoading } = useStatuses(selectedProjectId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(selectedProjectId);

  // Same filter logic as KanbanBoard
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDescription) return false;
      }

      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(task.priority)) return false;
      }

      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(task.status_id)) return false;
      }

      if (filters.tags.length > 0) {
        const taskTagIds = task.tags?.map((t) => t.id) || [];
        const hasMatchingTag = filters.tags.some((tagId: string) => taskTagIds.includes(tagId));
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  const getTasksByStatus = (statusId: string): Task[] => {
    return filteredTasks
      .filter((task) => task.status_id === statusId)
      .sort((a, b) => a.position - b.position);
  };

  if (statusesLoading || tasksLoading) return <TasksSkeleton />;

  // No project selected
  if (!selectedProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-white/5 flex items-center justify-center mx-auto">
            <span className="text-2xl">📋</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-300 mb-1">No project selected</h3>
            <p className="text-sm text-zinc-600">Select a project from the sidebar to get started</p>
          </div>
        </div>
      </div>
    );
  }

  // No statuses
  if (!statuses || statuses.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-white/5 flex items-center justify-center mx-auto">
            <span className="text-2xl">🏗️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-300 mb-1">No board columns</h3>
            <p className="text-sm text-zinc-600">Create status columns to start organizing tasks</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 w-full">
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
