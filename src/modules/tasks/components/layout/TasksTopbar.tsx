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
// import { PriorityIcon } from "@/components/tasks/PriorityIcon";
// import { StatusIcon } from "@/components/tasks/StatusIcon";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { useTags } from "@/modules/tasks/hooks/useTags";
import { StatusIcon } from "../../../../shared/components/icons/StatusIcon";
import { PriorityIcon } from "../../../../shared/components/icons/PriorityIcon";

// =====================================================
// TASKS TOPBAR
// Search, filters, view switcher
// =====================================================

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

  // Count active filters (excluding search)
  const activeFiltersCount =
    filters.statuses.length + filters.priorities.length + filters.tags.length;

  // Priority options
  const priorityOptions: { value: Priority; label: string }[] = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  // Toggle priority filter
  const togglePriority = (priority: Priority) => {
    const current = filters.priorities;
    const updated = current.includes(priority)
      ? current.filter((p: Priority) => p !== priority)
      : [...current, priority];
    setFilters({ priorities: updated });
  };

  // Toggle status filter
  const toggleStatus = (statusId: string) => {
    const current = filters.statuses;
    const updated = current.includes(statusId)
      ? current.filter((s: string) => s !== statusId)
      : [...current, statusId];
    setFilters({ statuses: updated });
  };

  return (
    <div className="h-14 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-between px-4 gap-4 shrink-0">
      {/* Left: Sidebar Toggle + Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              "bg-zinc-900/50 border border-white/5",
              "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
              "transition-all",
            )}
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg",
              "bg-zinc-900/50 border border-white/5",
              "text-zinc-100 text-sm placeholder:text-zinc-600",
              "focus:outline-none focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700",
              "transition-all",
            )}
          />
        </div>
      </div>

      {/* Right: Filters + View Switcher */}
      <div className="flex items-center gap-2">
        {/* Filters Dropdown - Nested Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "h-9 px-3 rounded-lg flex items-center gap-2",
                "bg-zinc-900/50 border border-white/5",
                "text-zinc-400 text-sm font-medium",
                "hover:bg-zinc-800/50 hover:text-zinc-300",
                "transition-all",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
            >
              <SlidersHorizontal size={16} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-xs font-semibold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-md bg-zinc-900 border-zinc-800"
          >
            {/* Status Filter - Nested */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer focus:bg-zinc-800">
                <div className="flex items-center gap-2">
                  <StatusIcon status="To Do" size={16} />
                  <span>Status</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className="w-48 rounded-md bg-zinc-900 border-zinc-800"
                sideOffset={4}
              >
                {statuses?.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status.id}
                    checked={filters.statuses.includes(status.id)}
                    onCheckedChange={() => toggleStatus(status.id)}
                    onSelect={(e) => e.preventDefault()}
                    className="cursor-pointer focus:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon status={status.name} size={16} />
                      <span>{status.name}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Priority Filter - Nested */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer focus:bg-zinc-800">
                <div className="flex items-center gap-2">
                  <PriorityIcon priority="none" />
                  <span>Priority</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className="w-48 rounded-md bg-zinc-900 border-zinc-800"
                sideOffset={4}
              >
                {priorityOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={filters.priorities.includes(option.value)}
                    onCheckedChange={() => togglePriority(option.value)}
                    onSelect={(e) => e.preventDefault()}
                    className="cursor-pointer focus:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={option.value} />
                      <span>{option.label}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Tag Filter - Nested */}
            {tags && tags.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer focus:bg-zinc-800">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-zinc-400" />
                    <span>Tags</span>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="w-48 rounded-md bg-zinc-900 border-zinc-800"
                  sideOffset={4}
                >
                  {tags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={filters.tags.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="cursor-pointer focus:bg-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color ?? "#71717a" }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <div className="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="w-full h-8 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 justify-start"
                  >
                    <X size={14} className="mr-2" />
                    Clear all filters
                  </Button>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Switcher */}
        <div className="flex items-center bg-zinc-900/50 border border-white/5 rounded-lg p-1">
          {views.map((view) => (
            <button
              key={view.mode}
              onClick={() => setViewMode(view.mode)}
              className={cn(
                "h-7 px-3 rounded-md flex items-center gap-1.5 text-sm font-medium transition-all",
                viewMode === view.mode
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
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
