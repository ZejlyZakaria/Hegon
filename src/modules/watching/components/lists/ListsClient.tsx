"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { tmdbImageFor } from "../../lib/tmdb-image";
import { Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { InlineFormActions } from "@/shared/components/ui/inline-form-actions";
import { Button } from "@/shared/components/ui/button";
import { Hint } from "@/shared/components/ui/tooltip";
import {
  useListsWithThumbnails,
  useCreateMediaList,
  useDeleteMediaList,
  useRestoreMediaList,
} from "../../hooks/useMediaLists";
import DeleteConfirmModal from "../modals/DeleteConfirmModal";
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
      className="group cursor-pointer overflow-hidden rounded-card border border-white/20 bg-linear-to-br from-zinc-900 to-black transition-colors hover:border-white/40"
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
        <p className="mt-1 text-micro text-white/20">—</p>
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
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-1">
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
      className="group relative cursor-pointer overflow-hidden rounded-card border border-border-subtle bg-surface-1 transition-colors hover:bg-surface-2"
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
                <Image src={tmdbImageFor(t.poster_url, 120) || t.poster_url} alt="" fill loading="lazy" className="object-cover" sizes="120px" />
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
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-micro font-medium text-amber-400 backdrop-blur-sm">
            <Trophy size={9} /> Ranked
          </div>
        )}
        <Hint label="Delete list">
          <Button
            variant="overlay"
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
          <span className="text-micro text-text-tertiary/60">{formatUpdated(list.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Lists Client ──────────────────────────────────────────────────────────────

interface Props { userId: string }

export function ListsClient({ userId }: Props) {
  const [isCreating, setIsCreating]         = useState(false);
  // The list awaiting confirmation. Deleting a list used to be a single click on a hover
  // icon — no confirmation, no undo — while deleting one TITLE asked for confirmation. The
  // most destructive action in the module was the least protected, and it cost a real list.
  const [pendingDelete, setPendingDelete] = useState<MediaListWithThumbnails | null>(null);

  const { data: lists = [], isLoading } = useListsWithThumbnails(userId);
  const createList = useCreateMediaList(userId);
  const deleteList = useDeleteMediaList(userId);
  const restoreList = useRestoreMediaList(userId);
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

  // Two locks, on purpose. The confirmation stops the accident; the undo catches the
  // deliberate mistake. And underneath both, the delete is now SOFT — the list and its
  // titles are only hidden, so even a dismissed toast isn't the end of the story.
  const confirmDelete = async () => {
    const list = pendingDelete;
    if (!list) return;
    setPendingDelete(null);
    try {
      await deleteList.mutateAsync(list.id);
      toast(`"${list.name}" deleted.`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: () => {
            restoreList.mutate(list.id, {
              onSuccess: () => toast.success(`"${list.name}" restored.`),
              onError: () => toast.error("Failed to restore the list."),
            });
          },
        },
      });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to delete list.");
    }
  };

  const deleteModal = (
    <DeleteConfirmModal
      isOpen={!!pendingDelete}
      onClose={() => setPendingDelete(null)}
      onConfirm={confirmDelete}
      title={pendingDelete ? `Delete "${pendingDelete.name}"?` : ""}
      description={
        pendingDelete
          ? `This removes the list and its ${pendingDelete.count} ${pendingDelete.count === 1 ? "title" : "titles"}. You can undo it right after.`
          : undefined
      }
      isDeleting={deleteList.isPending}
    />
  );

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
      {/* `New list` is not data — it is drawn unconditionally the moment `lists` resolves, so
          the skeleton can draw its real shape (border, centred icon, "Create a list" footer)
          instead of guessing at it too. The other seven are a plausible COUNT, not a known one —
          list count is genuinely data-dependent — but a three-way poster collage + a two-line
          footer is what every one of them turns into, never a flat rectangle. */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="animate-pulse overflow-hidden rounded-card border border-white/10 bg-surface-1">
            <div className="flex h-42 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-white/10" />
                <div className="h-3 w-14 rounded bg-white/10" />
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="h-3.5 w-20 rounded bg-surface-2" />
              <div className="mt-2 h-2.5 w-4 rounded bg-surface-2" />
            </div>
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-card border border-border-subtle bg-surface-1">
              <div className="flex h-42 gap-0.5 bg-black">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex-1 bg-surface-2" />
                ))}
              </div>
              <div className="p-3">
                <div className="h-3.5 w-24 rounded bg-surface-2" />
                <div className="mt-2 h-2.5 w-28 rounded bg-surface-2" />
              </div>
            </div>
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
              onDelete={(e) => { e.stopPropagation(); setPendingDelete(list); }}
            />
          ))}
        </div>
      )}

      {deleteModal}
    </div>
  );
}
