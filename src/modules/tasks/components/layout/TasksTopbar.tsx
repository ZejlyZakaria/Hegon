"use client";

import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Calendar,
  X,
  PanelLeftOpen,
  Tag,
} from "lucide-react";
import { useTasksStore } from "@/modules/tasks/store";
import { cn } from "@/shared/utils/utils";
import type { ViewMode, Priority } from "@/modules/tasks/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/shared/components/ui/dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { useTags } from "@/modules/tasks/hooks/useTags";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";

export function TasksTopbar() {
  const {
    viewMode,
    setViewMode,
    filters,
    setFilters,
    resetFilters,
    selectedProjectId,
    isSidebarCollapsed,
    toggleSidebar,
  } = useTasksStore();

  const { data: statuses } = useStatuses(selectedProjectId);
  const { data: tags } = useTags();

  const toggleTag = (tagId: string) => {
    const current = filters.tags;
    const updated = current.includes(tagId)
      ? current.filter((t: string) => t !== tagId)
      : [...current, tagId];
    setFilters({ tags: updated });
  };

  const views: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "kanban", icon: <LayoutGrid size={16} />, label: "Kanban" },
    { mode: "list", icon: <List size={16} />, label: "List" },
    { mode: "calendar", icon: <Calendar size={16} />, label: "Calendar" },
  ];

  const activeFiltersCount =
    filters.statuses.length + filters.priorities.length + filters.tags.length;

  const priorityOptions: { value: Priority; label: string }[] = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const togglePriority = (priority: Priority) => {
    const current = filters.priorities;
    const updated = current.includes(priority)
      ? current.filter((p: Priority) => p !== priority)
      : [...current, priority];
    setFilters({ priorities: updated });
  };

  const toggleStatus = (statusId: string) => {
    const current = filters.statuses;
    const updated = current.includes(statusId)
      ? current.filter((s: string) => s !== statusId)
      : [...current, statusId];
    setFilters({ statuses: updated });
  };

  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4"
      style={{
        backgroundColor: "var(--color-surface-0)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <div className="flex max-w-md flex-1 items-center gap-2">
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-100"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-tertiary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-3)";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-2)";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-tertiary)" }}
          />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className={cn(
              "h-8 w-full rounded-md pl-8 pr-3 text-sm outline-none transition-colors duration-100"
            )}
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-100"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-secondary)",
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--color-surface-3)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-lg"
            style={{
              backgroundColor: "var(--color-surface-3)",
              borderColor: "var(--color-border-default)",
              color: "var(--color-text-secondary)",
            }}
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <StatusIcon status="To Do" size={16} />
                  <span>Status</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className="w-48 rounded-lg"
                sideOffset={4}
                style={{
                  backgroundColor: "var(--color-surface-3)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {statuses?.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status.id}
                    checked={filters.statuses.includes(status.id)}
                    onCheckedChange={() => toggleStatus(status.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon status={status.name} size={16} />
                      <span>{status.name}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <PriorityIcon priority="none" />
                  <span>Priority</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className="w-48 rounded-lg"
                sideOffset={4}
                style={{
                  backgroundColor: "var(--color-surface-3)",
                  borderColor: "var(--color-border-default)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {priorityOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={filters.priorities.includes(option.value)}
                    onCheckedChange={() => togglePriority(option.value)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={option.value} />
                      <span>{option.label}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {tags && tags.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Tag size={14} style={{ color: "var(--color-text-tertiary)" }} />
                    <span>Tags</span>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="w-48 rounded-lg"
                  sideOffset={4}
                  style={{
                    backgroundColor: "var(--color-surface-3)",
                    borderColor: "var(--color-border-default)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {tags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={filters.tags.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color ?? "#71717a" }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {activeFiltersCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 w-full justify-start text-xs"
                  >
                    <X size={14} className="mr-2" />
                    Clear all filters
                  </Button>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          className="flex items-center rounded-md p-1"
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {views.map((view) => (
            <button
              key={view.mode}
              type="button"
              onClick={() => setViewMode(view.mode)}
              className="flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-100"
              style={{
                backgroundColor:
                  viewMode === view.mode ? "var(--color-surface-3)" : "transparent",
                color:
                  viewMode === view.mode
                    ? "var(--color-text-primary)"
                    : "var(--color-text-tertiary)",
              }}
            >
              {view.icon}
              <span className="hidden sm:inline">{view.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
