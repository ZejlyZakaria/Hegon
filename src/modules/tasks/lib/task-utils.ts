import type { Task, TaskFilters } from "../types";

// =====================================================
// FILTER TASKS
// =====================================================

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
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

    // Tags filter
    if (filters.tags.length > 0) {
      const taskTagIds = task.tags?.map((t) => t.id) || [];
      const hasMatchingTag = filters.tags.some((tagId) => taskTagIds.includes(tagId));
      if (!hasMatchingTag) return false;
    }

    return true;
  });
}

// =====================================================
// GET TASKS BY STATUS
// =====================================================

export function getTasksByStatus(tasks: Task[], statusId: string): Task[] {
  return tasks
    .filter((t) => t.status_id === statusId)
    .sort((a, b) => a.position - b.position);
}

// =====================================================
// SORT BY PRIORITY
// =====================================================

export function sortByPriority(tasks: Task[]): Task[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// =====================================================
// GET OVERDUE TASKS
// =====================================================

export function getOverdueTasks(tasks: Task[]): Task[] {
  const now = new Date();
  return tasks.filter((task) => task.due_date && new Date(task.due_date) < now);
}