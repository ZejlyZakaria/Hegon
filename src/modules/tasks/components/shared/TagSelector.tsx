"use client";

import { useState } from "react";
import { Tag, Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { useTagsForProject, useProjectWorkspaceId, useCreateTag } from "@/modules/tasks/hooks/useTags";
import type { Tag as TagType } from "@/modules/tasks/types";

const TAG_COLOR_PALETTE = [
  "#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#10b981",
  "#14b8a6","#06b6d4","#3b82f6","#6366f1","#8b5cf6","#ec4899",
];

function pickColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
}

// Two modes:
//   - "immediate": fires onAdd/onRemove callbacks instantly (TaskDetailPanel)
//   - "controlled": manages selectedIds locally, parent reads via onChange (CreateTaskModal)

interface TagSelectorProps {
  projectId: string;
  selectedTags?: TagType[];
  selectedIds?: string[];
  onChange?: (ids: string[]) => void;
  onAdd?: (tagId: string) => void;
  onRemove?: (tagId: string) => void;
  disabled?: boolean;
  /** Compact inline mode for property rows — no label, no border box, pills flush */
  inline?: boolean;
}

export function TagSelector({
  projectId,
  selectedTags,
  selectedIds,
  onChange,
  onAdd,
  onRemove,
  disabled,
  inline = false,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allTags } = useTagsForProject(projectId);
  const { data: workspaceId } = useProjectWorkspaceId(projectId);
  const createTag = useCreateTag(workspaceId ?? null);

  const currentIds: string[] = selectedIds ?? selectedTags?.map((t) => t.id) ?? [];

  const isSelected = (tagId: string) => currentIds.includes(tagId);

  const handleToggle = (tag: TagType) => {
    if (isSelected(tag.id)) {
      if (onRemove) {
        onRemove(tag.id);
      } else if (onChange) {
        onChange(currentIds.filter((id) => id !== tag.id));
      }
    } else {
      if (onAdd) {
        onAdd(tag.id);
      } else if (onChange) {
        onChange([...currentIds, tag.id]);
      }
    }
  };

  const trimmedSearch = search.trim();
  const lowerSearch = trimmedSearch.toLowerCase();
  const filteredTags = (allTags ?? []).filter((t) => t.name.toLowerCase().includes(lowerSearch));
  const exactMatch = (allTags ?? []).some((t) => t.name.toLowerCase() === lowerSearch);
  const canCreate = !!trimmedSearch && !exactMatch && !!workspaceId && !createTag.isPending;

  const handleCreate = async () => {
    if (!canCreate) return;
    const tag = await createTag.mutateAsync({ name: trimmedSearch, color: pickColor(trimmedSearch) });
    if (onAdd) onAdd(tag.id);
    else if (onChange) onChange([...currentIds, tag.id]);
    setSearch("");
  };

  const selectedTagObjects = allTags?.filter((t) => currentIds.includes(t.id)) ?? [];

  const popoverContent = (
    <PopoverContent className="w-64 p-0 bg-surface-3 border-border-strong" align="start">
      <div className="p-1.5 border-b border-border-subtle">
        <input
          type="text"
          autoFocus
          placeholder="Search or create..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) {
              e.preventDefault();
              void handleCreate();
            }
          }}
          className="w-full h-7 px-2 text-xs bg-transparent text-text-primary placeholder:text-text-tertiary outline-none"
        />
      </div>
      <div className="p-1.5 max-h-64 overflow-y-auto">
        {filteredTags.length === 0 && !canCreate ? (
          <p className="text-xs text-text-tertiary px-2 py-2 text-center">
            {trimmedSearch ? "No matches." : "No tags yet. Type a name to create one."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggle(tag)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs",
                  "hover:bg-surface-2 transition-colors text-left",
                  isSelected(tag.id) ? "text-text-primary" : "text-text-tertiary",
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? "#71717a" }}
                />
                <span className="flex-1 truncate">{tag.name}</span>
                {isSelected(tag.id) && <Check size={12} className="shrink-0 text-text-tertiary" />}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createTag.isPending}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs hover:bg-surface-2 transition-colors text-left text-text-secondary disabled:opacity-50"
              >
                <Plus size={12} className="shrink-0 text-text-tertiary" />
                <span className="flex-1 truncate">
                  Create <span className="text-text-primary font-medium">&quot;{trimmedSearch}&quot;</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </PopoverContent>
  );

  // ── Inline mode (panel property row) ─────────────────────────────────────
  if (inline) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {selectedTagObjects.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
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
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove?.(tag.id); onChange?.(currentIds.filter((id) => id !== tag.id)); }}
              className="ml-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary transition-colors hover:bg-surface-3 disabled:opacity-50",
                selectedTagObjects.length > 0 && "px-1.5"
              )}
            >
              {selectedTagObjects.length === 0 ? (
                <>
                  <Tag size={13} />
                  <span>No tags</span>
                </>
              ) : (
                <Plus size={12} />
              )}
            </button>
          </PopoverTrigger>
          {popoverContent}
        </Popover>
      </div>
    );
  }

  // ── Default mode (create/edit modal) ─────────────────────────────────────
  return (
    <div className="grid gap-2">
      <label className="text-xs font-medium text-text-secondary">Tags</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-full min-h-9 px-3 py-1.5 rounded-lg border border-border-subtle flex items-center gap-2 flex-wrap",
              "bg-surface-overlay hover:bg-surface-2 transition-colors",
              "text-text-tertiary text-xs",
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
                {selectedTagObjects.map((tag) => (
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
            <ChevronDown size={12} className="ml-auto shrink-0 text-text-tertiary" />
          </button>
        </PopoverTrigger>
        {popoverContent}
      </Popover>
    </div>
  );
}
