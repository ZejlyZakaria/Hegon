"use client";

import { useMemo, useState } from "react";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { useTasksStore } from "@/modules/tasks/store";
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import type { Task } from "@/modules/tasks/types";
import { filterTasks } from "@/modules/tasks/lib/task-utils";
import { TasksSkeleton } from "../TasksSkeletons";

export function CalendarView() {
  const { selectedProjectId, filters, openEditModal } = useTasksStore();
  const { data: tasks, isLoading } = useTasks(selectedProjectId);

  const [currentDate, setCurrentDate] = useState(new Date());

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    const calendarTasks = tasks.filter((t) => !!t.due_date && !t.status?.is_completed);
    return filterTasks(calendarTasks, filters);
  }, [tasks, filters]);

  const handleTaskClick = (task: Task) => {
    openEditModal(task.id);
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

    </>
  );
}
