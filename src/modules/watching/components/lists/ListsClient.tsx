"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { InlineFormActions } from "@/shared/components/ui/inline-form-actions";
import { Button } from "@/shared/components/ui/button";
import { Hint } from "@/shared/components/ui/tooltip";
import {
  useListsWithThumbnails,
  useCreateMediaList,
  useDeleteMediaList,
} from "../../hooks/useMediaLists";
import { useWatchingUIStore } from "../../hooks/useWatchingUIStore";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { ListDetail } from "./ListDetail";
import { ListGlyph } from "./list-glyph";
import type { MediaListWithThumbnails } from "../../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUpdated(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Updated today";
  if (diff === 1) return "Updated yesterday";
  if (diff < 7)  return `Updated ${diff}d ago`;
  if (diff < 30) return `Updated ${Math.floor(diff / 7)}w ago`;
  return `Updated ${Math.floor(diff / 30)}mo ago`;
}

// ── New List Card ─────────────────────────────────────────────────────────────

function NewListCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-xl border border-white/20 bg-linear-to-br from-zinc-900 to-black transition-colors hover:border-white/40"
    >
      <div className="relative flex h-42 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-white/60 transition-colors group-hover:text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
            <Plus size={20} />
          </div>
          <span className="text-xs font-medium">New list</span>
        </div>
      </div>
      <div className="border-t border-white/10 p-3">
        <p className="text-sm font-semibold text-white/40">Create a list</p>
        <p className="mt-1 text-[10px] text-white/20">—</p>
      </div>
    </div>
  );
}

// ── New List Form ─────────────────────────────────────────────────────────────

function NewListForm({ onConfirm, onCancel, isPending }: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-1">
      <div className="flex h-42 flex-col items-center justify-center gap-3 px-4">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="List name…"
          className="w-full bg-transparent text-center text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <InlineFormActions
          onCancel={onCancel}
          onSave={() => onConfirm(name.trim())}
          saving={isPending}
          disabled={!name.trim()}
          accent="var(--color-accent-watching)"
          saveLabel="Create"
        />
      </div>
      <div className="border-t border-border-subtle p-3">
        <p className="text-sm font-semibold text-text-tertiary/40">New list</p>
      </div>
    </div>
  );
}

// ── List Card ─────────────────────────────────────────────────────────────────

function ListCard({ list, onClick, onDelete }: {
  list: MediaListWithThumbnails;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const posters = [0, 1, 2].map((i) => list.thumbnails[i] ?? null);

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border-subtle bg-surface-1 transition-colors hover:bg-surface-2"
    >
      <div className="relative flex h-42 gap-0.5 overflow-hidden bg-black">
        {list.thumbnails.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-15">
            <ListGlyph value={list.emoji} size={40} fallback />
          </div>
        ) : (
          posters.map((t, i) => (
            <div key={i} className="relative flex-1 overflow-hidden">
              {t?.poster_url ? (
                <Image src={t.poster_url} alt="" fill unoptimized className="object-cover" sizes="8vw" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                  <div className="opacity-20">
                    <div className="h-6 w-4 rounded-sm border border-white/40" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/50" />

        {list.is_ranked && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-amber-400 backdrop-blur-sm">
            <Trophy size={9} /> Ranked
          </div>
        )}
        <Hint label="Delete list">
          <Button
            variant="glass"
            size="icon-xs"
            aria-label="Delete list"
            onClick={onDelete}
            className="absolute right-2 top-2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Trash2 />
          </Button>
        </Hint>
      </div>

      <div className="p-3">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-text-primary">
          {list.emoji && <ListGlyph value={list.emoji} size={13} className="shrink-0" />}
          <span className="truncate">{list.name}</span>
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            {list.count} {list.count === 1 ? "title" : "titles"}
          </span>
          <span className="text-[10px] text-text-tertiary/60">{formatUpdated(list.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Lists Client ──────────────────────────────────────────────────────────────

interface Props { userId: string }

export function ListsClient({ userId }: Props) {
  const [isCreating, setIsCreating]         = useState(false);

  const { data: lists = [], isLoading } = useListsWithThumbnails(userId);
  const createList = useCreateMediaList(userId);
  const deleteList = useDeleteMediaList(userId);
  const setDetailOpen = useWatchingUIStore((s) => s.setDetailOpen);
  // Persisted in the UI store (not local state) so returning from a media detail
  // page restores the open list instead of dropping back to the grid.
  const selectedListId = useWatchingUIStore((s) => s.selectedListId);
  const setSelectedListId = useWatchingUIStore((s) => s.setSelectedListId);

  // Sync list detail open state with layout (hides global tabs)
  useEffect(() => {
    setDetailOpen(!!selectedListId);
    return () => setDetailOpen(false);
  }, [selectedListId, setDetailOpen]);

  // Derive selected list from fresh cache data — auto-updates after edits
  const selectedList = selectedListId ? (lists.find((l) => l.id === selectedListId) ?? null) : null;

  const handleCreate = async (name: string) => {
    try {
      await createList.mutateAsync(name);
      setIsCreating(false);
      toast("List created.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to create list.");
    }
  };

  const handleDelete = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteList.mutateAsync(listId);
      toast("List deleted.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to delete list.");
    }
  };

  if (selectedList) {
    return (
      <ListDetail
        list={selectedList}
        userId={userId}
        onBack={() => setSelectedListId(null)}
      />
    );
  }

  return (
    <div className="p-4 md:p-6">
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface-1" style={{ height: 204 }} />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isCreating ? (
            <NewListForm
              onConfirm={handleCreate}
              onCancel={() => setIsCreating(false)}
              isPending={createList.isPending}
            />
          ) : (
            <NewListCard onClick={() => setIsCreating(true)} />
          )}

          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onClick={() => setSelectedListId(list.id)}
              onDelete={(e) => handleDelete(list.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
