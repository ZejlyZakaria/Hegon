"use client";

import { useMemo, useState } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { useTasksStore } from "@/modules/tasks/store";
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import { EditTaskModal } from "../modals/EditTaskModal";
import type { Task } from "@/modules/tasks/types";
import { TasksSkeleton } from "../TasksSkeletons";

export function CalendarView() {
  const { selectedProjectId, filters } = useTasksStore();
  const { data: tasks, isLoading } = useTasks(selectedProjectId);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      if (!task.due_date) return false;

      const statusName = task.status?.name?.toLowerCase() ?? "";
      if (statusName === "done" || statusName === "completed") return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDescription = task.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDescription) return false;
      }

      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
      }

      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status_id)) {
        return false;
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

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  if (isLoading) return <TasksSkeleton />;

  if (!selectedProjectId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p style={{ color: "var(--color-text-tertiary)" }}>
          Select a project to view the calendar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <CalendarHeader
          currentDate={currentDate}
          taskCount={filteredTasks.length}
          onDateChange={setCurrentDate}
        />

        <CalendarGrid
          currentDate={currentDate}
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
        />
      </div>

      {selectedTask && (
        <EditTaskModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          task={selectedTask}
        />
      )}
    </>
  );
}
