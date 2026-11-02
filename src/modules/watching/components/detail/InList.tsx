"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { tmdbImageFor } from "../../lib/tmdb-image";
import { Check, ChevronRight, List, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { useAlignedRail } from "../../hooks/useAlignedRail";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { Panel } from "@/shared/components/ui/panel";
import { Hint } from "@/shared/components/ui/tooltip";
import {
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

/** One door per list. Membership is edited only through Manage. */
function ListCard({ list, onOpen }: { list: MediaListWithThumbnails; onOpen: () => void }) {
  const posters=list.thumbnails.filter(t=>t?.poster_url).slice(0,3);
  return <li className="w-[65%] min-w-0 shrink-0">
    <button type="button" onClick={onOpen} aria-label={`Open list ${list.name}`} className="group relative block aspect-2/1 w-full overflow-hidden rounded-control bg-surface-2 text-left outline-offset-2 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-watching-vivid">
      <span aria-hidden="true" className="absolute inset-0 flex gap-0.5">
        {posters.length ? Array.from({length:3},(_,i)=>{const poster=posters[i];return <span key={i} className="relative min-w-0 flex-1 overflow-hidden">
          {poster && <Image src={tmdbImageFor(poster.poster_url,120) || poster.poster_url!} alt="" fill sizes="(min-width: 1024px) 7vw, 22vw" loading="lazy" className="object-contain"/>}
        </span>}) : <span className="flex h-full w-full items-center justify-center bg-surface-2 text-text-tertiary"><List size={28}/></span>}
      </span>
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/90 via-black/15 to-transparent"/>
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-2 text-white"><List size={15} className="shrink-0"/><span className="min-w-0 line-clamp-2 text-xs font-semibold leading-snug">{list.name}</span></span>
    </button>
  </li>;
}

export function InList({ mediaItemId, userId }: Props) {
  const router = useRouter();
  const setSelectedListId = useWatchingUIStore((s) => s.setSelectedListId);

  /**
   * ONE question, once. This used to call `useMediaLists` AND `useListsWithThumbnails`, which are
   * two query keys over the SAME rows — `media_lists?user_id=…&deleted_at=is.null` went out twice,
   * five milliseconds apart, on every detail page. The thumbnails version returns each list plus a
   * count and its covers, so it is a strict superset: the plain one had nothing to add.
   */
  const { data: allLists = [], isLoading: listsLoading } = useListsWithThumbnails(userId);
  const { data: mediaLists = [], isLoading: mediaListsLoading } = useListsForMedia(mediaItemId);

  const createList = useCreateMediaList(userId);
  const addToList = useAddToList(mediaItemId, userId);
  const removeFromList = useRemoveFromList(mediaItemId);

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const mediaListIds = new Set(mediaLists.map((l) => l.id));
  const cards = allLists.filter((l) => mediaListIds.has(l.id));
  const isLoading = listsLoading || mediaListsLoading;
  const {ref:railRef,scroll,canPrev,canNext}=useAlignedRail<HTMLUListElement>(cards.length);

  const openList = (id: string) => { setSelectedListId(id); router.push("/perso/watching/lists"); };
  const seeAll = () => { setSelectedListId(null); router.push("/perso/watching/lists"); };

  const handleToggle = async (listId: string) => {
    if(addToList.isPending || removeFromList.isPending) return;
    try {
      if (mediaListIds.has(listId)) await removeFromList.mutateAsync(listId);
      else await addToList.mutateAsync(listId);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update list.");
    }
  };

  const handleCreate = async () => {
    if(createList.isPending || addToList.isPending) return;
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
    <Panel
        title="In Lists"
        actions={
          <>
          {(canPrev || canNext) && <CarouselNav size="sm" canPrev={canPrev} canNext={canNext} onPrev={()=>scroll(-1)} onNext={()=>scroll(1)}/>}
          {/* See all first, then the primary action — the toolbar reads left→right, and the
              button you press most sits at the end, next to nothing that can steal the click. */}
          {cards.length > 0 && (
            <Button variant="subtle" size="sm" onClick={seeAll}>
              See all <ChevronRight size={12} aria-hidden="true" />
            </Button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            {/* Hint wraps the trigger (not the reverse): PopoverTrigger forwards its ref,
                a plain wrapper component would swallow it and the popover would never open. */}
            <Hint label="Manage list membership">
              <PopoverTrigger asChild>
                <Button variant="quiet" size="sm">
                  {cards.length ? "Manage" : "Add to list"}
                </Button>
              </PopoverTrigger>
            </Hint>
            <PopoverContent align="end" sideOffset={6} className="w-56 border-border-subtle bg-surface-3 p-0 shadow-md">
              <div className="max-h-64 overflow-y-auto p-1.5">
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
                      disabled={addToList.isPending || removeFromList.isPending}
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
                      aria-label="Create list"
                      onClick={handleCreate}
                      disabled={!newName.trim() || createList.isPending}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-accent-watching text-white disabled:opacity-40"
                    >
                      {createList.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel new list"
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
      >

      {isLoading ? (
        <div className="h-12 w-full animate-pulse rounded-tile bg-surface-2" />
      ) : cards.length === 0 ? (
        <div className="flex items-center gap-3">
          <List size={18} className="shrink-0 text-text-tertiary" />
          <p className="text-xs leading-relaxed text-text-secondary">Keep related titles together.</p>
        </div>
      ) : (
        <ul ref={railRef} className="flex gap-3 overflow-x-auto py-1 scrollbar-hide">
          {cards.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onOpen={() => openList(list.id)}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
