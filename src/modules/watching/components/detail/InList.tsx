"use client";

import { useState, useRef } from "react";
import { Check, List, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  useMediaLists,
  useListsForMedia,
  useCreateMediaList,
  useAddToList,
  useRemoveFromList,
} from "../../hooks/useMediaLists";
import { toast } from "@/shared/utils/toast";

interface Props {
  mediaItemId: string;
  userId: string;
}

export function InList({ mediaItemId, userId }: Props) {
  const { data: allLists = [], isLoading: listsLoading } = useMediaLists(userId);
  const { data: mediaLists = [], isLoading: mediaListsLoading } = useListsForMedia(mediaItemId);

  const createList = useCreateMediaList(userId);
  const addToList = useAddToList(mediaItemId, userId);
  const removeFromList = useRemoveFromList(mediaItemId);

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const mediaListIds = new Set(mediaLists.map((l) => l.id));
  const isLoading = listsLoading || mediaListsLoading;

  const handleToggle = async (listId: string) => {
    if (mediaListIds.has(listId)) {
      try {
        await removeFromList.mutateAsync(listId);
      } catch {
        toast.error("Failed to remove from list.");
      }
    } else {
      try {
        await addToList.mutateAsync(listId);
      } catch {
        toast.error("Failed to add to list.");
      }
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const list = await createList.mutateAsync(name);
      await addToList.mutateAsync(list.id);
      setNewName("");
      setIsCreating(false);
      toast("List created.");
    } catch {
      toast.error("Failed to create list.");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">In List</h2>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary"
            >
              <Plus size={13} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-56 border-border-subtle bg-surface-2 p-0 shadow-md"
          >
            <div className="p-1.5">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={14} className="animate-spin text-text-tertiary" />
                </div>
              )}

              {!isLoading && allLists.length === 0 && !isCreating && (
                <p className="px-2 py-3 text-center text-xs text-text-tertiary">No lists yet</p>
              )}

              {!isLoading && allLists.map((list) => {
                const inList = mediaListIds.has(list.id);
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => handleToggle(list.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-1"
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      inList
                        ? "border-accent-watching bg-accent-watching"
                        : "border-border-default bg-transparent"
                    )}>
                      {inList && <Check size={10} className="text-white" />}
                    </div>
                    <span className="truncate text-xs text-text-primary">{list.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border-subtle p-1.5">
              {isCreating ? (
                <div className="flex items-center gap-1.5 px-1">
                  <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setIsCreating(false); setNewName(""); }
                    }}
                    placeholder="List name…"
                    className="flex-1 rounded-md border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || createList.isPending}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-watching text-white disabled:opacity-40"
                  >
                    {createList.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); setNewName(""); }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setIsCreating(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text-tertiary transition-colors hover:bg-surface-1 hover:text-text-primary"
                >
                  <Plus size={12} />
                  New list
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* List badges */}
      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-surface-2" />
          ))}
        </div>
      ) : mediaLists.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-default px-4 py-3.5">
          <List size={14} className="shrink-0 text-text-tertiary/50" />
          <p className="text-xs text-text-tertiary">Not in any list yet</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {mediaLists.map((list) => (
            <span
              key={list.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-text-secondary"
            >
              {list.name}
              <button
                type="button"
                onClick={() => handleToggle(list.id)}
                className="text-text-tertiary transition-colors hover:text-text-primary"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
