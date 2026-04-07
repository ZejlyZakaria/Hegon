"use client";

import { useState } from "react";
import { Tag, Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { useTags } from "@/modules/tasks/hooks/useTags";
import type { Tag as TagType } from "@/modules/tasks/types";

// =====================================================
// TAG SELECTOR
// Two modes:
//   - "immediate": fires onAdd/onRemove callbacks instantly (EditTaskModal)
//   - "controlled": manages selectedIds locally, parent reads via onChange (CreateTaskModal)
// =====================================================

interface TagSelectorProps {
  // Current tags on the task (for immediate mode)
  selectedTags?: TagType[];
  // For controlled mode (CreateTaskModal)
  selectedIds?: string[];
  onChange?: (ids: string[]) => void;
  // For immediate mode (EditTaskModal)
  onAdd?: (tagId: string) => void;
  onRemove?: (tagId: string) => void;
  disabled?: boolean;
}

export function TagSelector({
  selectedTags,
  selectedIds,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: allTags } = useTags();

  // Determine which tag IDs are currently selected
  const currentIds: string[] = selectedIds
    ?? selectedTags?.map((t) => t.id)
    ?? [];

  const isSelected = (tagId: string) => currentIds.includes(tagId);

  const handleToggle = (tag: TagType) => {
    if (isSelected(tag.id)) {
      // Remove
      if (onRemove) {
        onRemove(tag.id);
      } else if (onChange) {
        onChange(currentIds.filter((id) => id !== tag.id));
      }
    } else {
      // Add
      if (onAdd) {
        onAdd(tag.id);
      } else if (onChange) {
        onChange([...currentIds, tag.id]);
      }
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-xs font-medium text-zinc-400">Tags</label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-full min-h-9 px-3 py-1.5 rounded-lg flex items-center gap-2 flex-wrap",
              "bg-zinc-800/50 border border-zinc-700/50",
              "text-zinc-400 text-xs",
              "hover:bg-zinc-800 hover:border-zinc-600/50 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {currentIds.length === 0 ? (
              <>
                <Tag size={12} className="shrink-0" />
                <span>Add tags...</span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                {allTags
                  ?.filter((t) => currentIds.includes(t.id))
                  .map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                      style={{
                        backgroundColor: `${tag.color ?? "#71717a"}18`,
                        color: tag.color ?? "#71717a",
                        border: `1px solid ${tag.color ?? "#71717a"}30`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color ?? "#71717a" }}
                      />
                      {tag.name}
                    </span>
                  ))}
              </div>
            )}
            <ChevronDown size={12} className="ml-auto shrink-0 text-zinc-600" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-56 p-1.5 bg-zinc-900 border-zinc-800"
          align="start"
        >
          {!allTags || allTags.length === 0 ? (
            <p className="text-xs text-zinc-500 px-2 py-2 text-center">
              No tags yet. Create one below.
            </p>
          ) : (
            <div className="space-y-0.5">
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggle(tag)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs",
                    "hover:bg-white/5 transition-colors text-left",
                    isSelected(tag.id) ? "text-zinc-100" : "text-zinc-400",
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? "#71717a" }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isSelected(tag.id) && (
                    <Check size={12} className="shrink-0 text-zinc-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
