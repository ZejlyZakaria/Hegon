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

// =====================================================
// PRESET COLORS
// =====================================================

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#22c55e", // green
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#71717a", // zinc
  "#06b6d4", // cyan
];

// =====================================================
// COMPONENT
// =====================================================

interface ManageTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageTagsModal({ open, onOpenChange }: ManageTagsModalProps) {
  const { data: tags } = useTags();
  const createTagMutation = useCreateTag();
  const deleteTagMutation = useDeleteTag();

  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[5]); // blue default
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTagMutation.mutate(
      { name: newName.trim(), color: selectedColor },
      {
        onSuccess: () => {
          setNewName("");
          setSelectedColor(PRESET_COLORS[5]);
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
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-zinc-100 flex items-center gap-2">
            <Tag size={15} className="text-zinc-500" />
            Manage Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Create new tag */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-400">New tag</p>

            {/* Color picker */}
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all",
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-white/60 scale-110"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Name + add button */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3">
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
                  className="border-0 bg-transparent px-0 focus-visible:ring-0 h-9"
                />
              </div>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || createTagMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 shrink-0"
              >
                <Plus size={15} />
              </Button>
            </div>
          </div>

          {/* Existing tags */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">
              Your tags {tags && tags.length > 0 && `(${tags.length})`}
            </p>

            {!tags || tags.length === 0 ? (
              <p className="text-xs text-zinc-600 py-2">No tags yet.</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-800/40 border border-white/5 group"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color ?? "#71717a" }}
                    />
                    <span className="text-sm text-zinc-300 flex-1 truncate">
                      {tag.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag.id)}
                      disabled={deletingId === tag.id}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400",
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
              className="border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
