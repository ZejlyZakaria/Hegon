import { describe, it, expect } from "vitest";
import { sortByPriority, filterTasks, getOverdueTasks } from "./task-utils";
import type { Task, TaskFilters } from "../types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "1",
    project_id: "p1",
    parent_task_id: null,
    title: "Task",
    description: null,
    status_id: "s1",
    priority: "medium",
    due_date: null,
    start_date: null,
    completed_at: null,
    estimated_hours: null,
    actual_hours: null,
    position: 0,
    is_archived: false,
    recurring_pattern: null,
    created_by: null,
    assignee_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}

function makeFilters(overrides: Partial<TaskFilters> = {}): TaskFilters {
  return {
    search: "",
    priorities: [],
    statuses: [],
    tags: [],
    assignees: [],
    dueDateRange: null,
    showArchived: false,
    ...overrides,
  };
}

describe("sortByPriority", () => {
  it("should order critical before high before medium before low", () => {
    const tasks = [
      makeTask({ id: "1", priority: "low" }),
      makeTask({ id: "2", priority: "critical" }),
      makeTask({ id: "3", priority: "medium" }),
      makeTask({ id: "4", priority: "high" }),
    ];

    const sorted = sortByPriority(tasks);

    expect(sorted.map((t) => t.priority)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
  });

  it("should not mutate the original array", () => {
    const tasks = [
      makeTask({ id: "1", priority: "low" }),
      makeTask({ id: "2", priority: "critical" }),
    ];
    const original = [...tasks];
    sortByPriority(tasks);
    expect(tasks[0].id).toBe(original[0].id);
  });
});

describe("filterTasks", () => {
  it("should filter by search on title", () => {
    const tasks = [
      makeTask({ id: "1", title: "Fix login bug" }),
      makeTask({ id: "2", title: "Add dark mode" }),
    ];

    const result = filterTasks(tasks, makeFilters({ search: "login" }));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter by search on description", () => {
    const tasks = [
      makeTask({ id: "1", title: "Task A", description: "Fix the auth flow" }),
      makeTask({ id: "2", title: "Task B", description: null }),
    ];

    const result = filterTasks(tasks, makeFilters({ search: "auth" }));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter by priority", () => {
    const tasks = [
      makeTask({ id: "1", priority: "critical" }),
      makeTask({ id: "2", priority: "low" }),
    ];

    const result = filterTasks(tasks, makeFilters({ priorities: ["critical"] }));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should return all tasks when filters are empty", () => {
    const tasks = [makeTask({ id: "1" }), makeTask({ id: "2" })];

    expect(filterTasks(tasks, makeFilters())).toHaveLength(2);
  });
});

describe("getOverdueTasks", () => {
  it("should return tasks with due_date in the past", () => {
    const tasks = [
      makeTask({ id: "1", due_date: "2020-01-01" }),
      makeTask({ id: "2", due_date: "2099-01-01" }),
      makeTask({ id: "3", due_date: null }),
    ];

    const result = getOverdueTasks(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should return empty array when no tasks are overdue", () => {
    const tasks = [
      makeTask({ id: "1", due_date: "2099-01-01" }),
      makeTask({ id: "2", due_date: null }),
    ];

    expect(getOverdueTasks(tasks)).toHaveLength(0);
  });
});
