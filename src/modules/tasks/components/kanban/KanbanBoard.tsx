"use client";

import { createClient } from "@/infrastructure/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useMemo, useState, useEffect } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { useTasksStore } from "@/modules/tasks/store";
import { useTasks, useMoveTask } from "@/modules/tasks/hooks/useTasks";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { useWorkspaces } from "@/modules/tasks/hooks/useWorkspaces";
import { useProjects } from "@/modules/tasks/hooks/useProjects";
import type { Task } from "@/modules/tasks/types";
import { TasksSkeleton } from "../TasksSkeletons";

// =====================================================
// KANBAN BOARD COMPONENT
// =====================================================

export function KanbanBoard() {
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);
  const { selectedProjectId, filters } = useTasksStore();
  const { data: statuses, isLoading: statusesLoading } = useStatuses(
    selectedProjectId
  );
  const { data: tasks, isLoading: tasksLoading } = useTasks(selectedProjectId);
  const moveMutation = useMoveTask();

  // Check if user has ANY projects — wait for loading before deciding
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces(
    userId || "",
  );
  const firstWorkspaceId = workspaces?.[0]?.id ?? null;
  const { data: allProjects, isLoading: projectsLoading } =
    useProjects(firstWorkspaceId);
  const hasProjects = allProjects && allProjects.length > 0;

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // =====================================================
  // FILTER TASKS
  // =====================================================
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description
          ?.toLowerCase()
          .includes(searchLower);
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
        const hasMatchingTag = filters.tags.some((tagId: string) =>
          taskTagIds.includes(tagId),
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  // =====================================================
  // DND HANDLERS
  // =====================================================
  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;

    if (!over || !filteredTasks) {
      setActiveColumnId(null);
      return;
    }

    const activeTask = filteredTasks.find((t) => t.id === active.id);
    const sourceColumnId = activeTask?.status_id;
    const overColumnId = statuses?.find((s) => s.id === over.id)?.id;
    const overTask = filteredTasks.find((t) => t.id === over.id);
    const targetColumnId = overColumnId || overTask?.status_id;

    if (targetColumnId && targetColumnId !== sourceColumnId) {
      setActiveColumnId(targetColumnId);
    } else {
      setActiveColumnId(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks?.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumnId(null);

    if (!over || !filteredTasks || !selectedProjectId) return;

    const activeTask = filteredTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    const overTask = filteredTasks.find((t) => t.id === overId);
    const overStatus = statuses?.find((s) => s.id === overId);
    const newStatusId =
      overStatus?.id || overTask?.status_id || activeTask.status_id;

    if (newStatusId === activeTask.status_id && !overTask) return;
    if (!newStatusId) return;

    const tasksInNewStatus = filteredTasks.filter(
      (t) => t.status_id === newStatusId,
    );
    const newPosition = overTask
      ? overTask.position - 0.5
      : Math.max(...tasksInNewStatus.map((t) => t.position), 0) + 1;

    moveMutation.mutate({
      taskId: activeTask.id,
      newStatusId,
      newPosition,
      projectId: selectedProjectId,
    });
  };

  const getTasksByStatus = (statusId: string) =>
    filteredTasks
      .filter((t) => t.status_id === statusId)
      .sort((a, b) => a.position - b.position);

  // =====================================================
  // RENDER STATES
  // =====================================================

  // Loading — workspaces/projects resolving or sidebar about to auto-select
  if (
    workspacesLoading ||
    projectsLoading ||
    (hasProjects && !selectedProjectId) ||
    statusesLoading ||
    tasksLoading
  ) {
    return <TasksSkeleton />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
        <div className="flex gap-4 min-h-full">
          {statuses?.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={getTasksByStatus(status.id)}
              projectId={selectedProjectId!}
              isActive={activeColumnId === status.id}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="cursor-grabbing rotate-2">
            <div className="border-2 border-blue-500 rounded-lg">
              <TaskCard task={activeTask} />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
