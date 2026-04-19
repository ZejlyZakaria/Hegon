"use client";

import { useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useTags, useCreateTag, useDeleteTag } from "@/modules/tasks/hooks/useTags";
import { cn } from "@/shared/utils/utils";

const ACCENT = "var(--color-accent-tasks)";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#71717a", // zinc
];

interface ManageTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageTagsModal({ open, onOpenChange }: ManageTagsModalProps) {
  const { data: tags } = useTags();
  const createTagMutation = useCreateTag();
  const deleteTagMutation = useDeleteTag();

  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[9]); // blue default
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTagMutation.mutate(
      { name: newName.trim(), color: selectedColor },
      {
        onSuccess: () => {
          setNewName("");
          setSelectedColor(PRESET_COLORS[9]);
        },
      }
    );
  };

  const handleDelete = (tagId: string) => {
    setDeletingId(tagId);
    deleteTagMutation.mutate(tagId, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1a1a1d] border-white/11">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-[#e2e2e6] flex items-center gap-2">
            <Tag size={14} className="text-[#71717a]" />
            Manage Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Create new tag */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#a0a0a8]">New tag</p>

            {/* Color picker */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all",
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-offset-[#1a1a1d] ring-white/60 scale-110"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Name + add button */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 bg-[#1f1f22] border border-zinc-700/50 rounded-lg px-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedColor }}
                />
                <Input
                  variant="tasks"
                  placeholder="Tag name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  className="border-0 bg-transparent px-0 focus-visible:ring-0 h-9 shadow-none"
                />
              </div>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || createTagMutation.isPending}
                className="h-9 px-3 text-white hover:opacity-90 disabled:opacity-50 shrink-0"
                style={{ backgroundColor: ACCENT }}
              >
                <Plus size={15} />
              </Button>
            </div>
          </div>

          {/* Existing tags */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#a0a0a8]">
              Your tags {tags && tags.length > 0 && `(${tags.length})`}
            </p>

            {!tags || tags.length === 0 ? (
              <p className="text-xs text-[#71717a] py-2">No tags yet.</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#1f1f22] border border-zinc-700/50 group"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color ?? "#71717a" }}
                    />
                    <span className="text-sm text-[#e2e2e6] flex-1 truncate">
                      {tag.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag.id)}
                      disabled={deletingId === tag.id}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "p-1 rounded hover:bg-red-500/10 text-[#71717a] hover:text-red-400",
                        "disabled:opacity-50",
                      )}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 border-white/[0.07] text-[#a0a0a8] hover:text-[#e2e2e6] hover:bg-[#141416]"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
