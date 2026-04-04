"use client";

import { useState, useMemo } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { useTasksStore } from "@/modules/tasks/store"
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import { EditTaskModal } from "../modals/EditTaskModal";
import { DeleteTaskModal } from "../modals/DeleteTaskModal";
import type { Task } from "@/modules/tasks/types"
import { TasksSkeleton } from "../TasksSkeletons";

// =====================================================
// CALENDAR VIEW COMPONENT
// =====================================================

export function CalendarView() {
  const { selectedProjectId, filters } = useTasksStore();
  const { data: tasks, isLoading } = useTasks(selectedProjectId);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Filter tasks (same logic as Kanban)
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks.filter((task) => {
      // Must have a due_date to appear in calendar
      if (!task.due_date) return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDescription) return false;
      }

      // Priority filter
      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(task.priority)) return false;
      }

      // Status filter
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(task.status_id)) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    setSelectedTask(null);
  };

  if (isLoading) return <TasksSkeleton />;

  // No project selected
  if (!selectedProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-white/5 flex items-center justify-center mx-auto">
            <span className="text-2xl">📅</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-300 mb-1">
              No project selected
            </h3>
            <p className="text-sm text-zinc-600">
              Select a project from the sidebar to view calendar
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header with navigation */}
        <CalendarHeader
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />

        {/* Calendar Grid */}
        <CalendarGrid
          currentDate={currentDate}
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* Edit Task Modal */}
      {selectedTask && (
        <EditTaskModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          task={selectedTask}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedTask && (
        <DeleteTaskModal
          open={isDeleteModalOpen}
          onOpenChange={(open) => {
            setIsDeleteModalOpen(open);
            if (!open) handleDeleteSuccess();
          }}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          projectId={selectedTask.project_id}
        />
      )}
    </>
  );
}