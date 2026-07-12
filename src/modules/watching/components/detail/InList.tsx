"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, List, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { Hint } from "@/shared/components/ui/tooltip";
import { SectionHeader } from "@/shared/components/ui/section-header";
import {
  useMediaLists,
  useListsForMedia,
  useListsWithThumbnails,
  useCreateMediaList,
  useAddToList,
  useRemoveFromList,
} from "../../hooks/useMediaLists";
import { useWatchingUIStore } from "../../hooks/useWatchingUIStore";
import type { MediaListWithThumbnails } from "../../service";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";

interface Props {
  mediaItemId: string;
  userId: string;
}

// A list this title belongs to, shown as a fanned poster stack: the first poster fully
// visible, each next one tucked ~30% behind (70% shown) with its own shadow casting onto
// the one below — the "deck of cards" depth. Click → open the list; hover → remove.
function ListCard({ list, onOpen, onRemove }: {
  list: MediaListWithThumbnails;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const posters = list.thumbnails.slice(0, 5);
  const n = Math.max(posters.length, 1);
  const w = 100 / (1 + 0.7 * (n - 1)); // fill the width whatever the count
  const ov = 0.3 * w;                  // 30% of each poster tucks under the previous

  return (
    <div
      onClick={onOpen}
      className="group relative w-2/3 shrink-0 snap-start cursor-pointer overflow-hidden rounded-tile border border-border-subtle bg-surface-1 transition-colors hover:bg-surface-2"
    >
      <div className="relative flex h-32 items-stretch bg-black p-2">
        {posters.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-text-tertiary/20">
            <List size={26} />
          </div>
        ) : (
          posters.map((t, i) => (
            <div
              key={i}
              className="relative h-full shrink-0 overflow-hidden rounded-sm"
              style={{
                width: `${w}%`,
                marginLeft: i === 0 ? 0 : `-${ov}%`,
                zIndex: posters.length - i,
                // Every poster but the last casts a shadow to its right → it reads as
                // sitting on top of the one behind it.
                boxShadow: i < posters.length - 1 ? "4px 0 10px 0 rgba(0,0,0,.8)" : undefined,
              }}
            >
              {t?.poster_url ? (
                <Image src={t.poster_url} alt="" fill unoptimized className="object-cover" sizes="14vw" />
              ) : (
                <div className="h-full w-full bg-zinc-900" />
              )}
            </div>
          ))
        )}
        <Hint label="Remove from list">
          <Button
            variant="glass"
            size="icon-xs"
            aria-label="Remove from list"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute right-1.5 top-1.5 z-10 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X />
          </Button>
        </Hint>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-text-primary">{list.name}</p>
      </div>
    </div>
  );
}

export function InList({ mediaItemId, userId }: Props) {
  const router = useRouter();
  const setSelectedListId = useWatchingUIStore((s) => s.setSelectedListId);

  const { data: allLists = [], isLoading: listsLoading } = useMediaLists(userId);
  const { data: mediaLists = [], isLoading: mediaListsLoading } = useListsForMedia(mediaItemId);
  const { data: withThumbs = [] } = useListsWithThumbnails(userId);

  const createList = useCreateMediaList(userId);
  const addToList = useAddToList(mediaItemId, userId);
  const removeFromList = useRemoveFromList(mediaItemId);

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mediaListIds = new Set(mediaLists.map((l) => l.id));
  const cards = withThumbs.filter((l) => mediaListIds.has(l.id));
  const isLoading = listsLoading || mediaListsLoading;
  const showNav = cards.length > 1;

  const openList = (id: string) => { setSelectedListId(id); router.push("/perso/watching/lists"); };
  const seeAll = () => { setSelectedListId(null); router.push("/perso/watching/lists"); };
  const scroll = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * scrollRef.current.clientWidth * 0.66, behavior: "smooth" });

  const handleToggle = async (listId: string) => {
    try {
      if (mediaListIds.has(listId)) await removeFromList.mutateAsync(listId);
      else await addToList.mutateAsync(listId);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update list.");
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
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to create list.");
    }
  };

  return (
    <div>
      <SectionHeader
        title="In List"
        actions={
          <>
          {showNav && <CarouselNav size="sm" onPrev={() => scroll(-1)} onNext={() => scroll(1)} />}
          {/* See all first, then the primary action — the toolbar reads left→right, and the
              button you press most sits at the end, next to nothing that can steal the click. */}
          {cards.length > 0 && (
            <Button variant="subtle" size="sm" onClick={seeAll}>
              See all
            </Button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            {/* Hint wraps the trigger (not the reverse): PopoverTrigger forwards its ref,
                a plain wrapper component would swallow it and the popover would never open. */}
            <Hint label="Add to a list">
              <PopoverTrigger asChild>
                <Button variant="quiet" size="sm">
                  <Plus />
                  Add
                </Button>
              </PopoverTrigger>
            </Hint>
            <PopoverContent align="end" sideOffset={6} className="w-56 border-border-subtle bg-surface-3 p-0 shadow-md">
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
                      className="flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                    >
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        inList ? "border-accent-watching bg-accent-watching" : "border-border-default bg-transparent",
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
                      className="min-w-0 flex-1 rounded-chip border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim() || createList.isPending}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-accent-watching text-white disabled:opacity-40"
                    >
                      {createList.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsCreating(false); setNewName(""); }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-text-tertiary hover:text-text-primary"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsCreating(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="flex w-full items-center gap-2 rounded-chip px-2.5 py-2 text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
                  >
                    <Plus size={12} />
                    New list
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          </>
        }
      />

      {isLoading ? (
        <div className="h-44 w-2/3 animate-pulse rounded-tile bg-surface-1" />
      ) : cards.length === 0 ? (
        <div className="flex items-center gap-2.5 py-0.5">
          <List size={14} className="shrink-0 text-text-tertiary/50" />
          <p className="text-xs text-text-tertiary">Not in any list yet</p>
        </div>
      ) : (
        <div ref={scrollRef} className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scrollbar-hide px-1 pb-1">
          {cards.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onOpen={() => openList(list.id)}
              onRemove={() => handleToggle(list.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
