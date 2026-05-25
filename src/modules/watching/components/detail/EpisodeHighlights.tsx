"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/shared/utils/toast";
import {
  useEpisodeHighlights,
  useAddEpisodeHighlight,
  useRemoveEpisodeHighlight,
} from "../../hooks/useEpisodeHighlights";
import type { EpisodeHighlight } from "../../types";

const MAX = 20;
const PAGE_SIZE = 4;

interface Props {
  mediaItemId: string;
  tmdbId: number;
  userId: string;
  orgId: string;
  seasons: number | null;
  episodes: number | null;
}

export function EpisodeHighlights({ mediaItemId, tmdbId, userId, orgId, seasons, episodes }: Props) {
  const { data: highlights = [], isLoading } = useEpisodeHighlights(mediaItemId);
  const addHighlight = useAddEpisodeHighlight(mediaItemId);
  const removeHighlight = useRemoveEpisodeHighlight(mediaItemId);

  const [page, setPage] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");

  const totalPages = Math.ceil(highlights.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visible = highlights.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleAdd = async () => {
    const s = parseInt(season);
    const e = parseInt(episode);
    if (!s || !e || s < 1 || e < 1) return;
    try {
      await addHighlight.mutateAsync({ tmdbId, userId, orgId, season: s, episode: e });
      setSeason("");
      setEpisode("");
      setIsAdding(false);
      toast("Episode added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add episode.");
    }
  };

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Best Episodes</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Pin your favorite moments
            {highlights.length > 0 && (
              <> · <span className="text-white/50 font-medium">{highlights.length}/{MAX}</span></>
            )}
          </p>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-text-tertiary">{safePage + 1}/{totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-30"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages - 1}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-surface-2 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-30"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-video animate-pulse rounded-xl bg-surface-1" />
          ))}
        </div>
      )}

      {/* Cards */}
      {!isLoading && visible.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {visible.map((h) => (
            <EpisodeCard
              key={h.id}
              highlight={h}
              onRemove={() => {
                removeHighlight.mutate(h.id);
                if (safePage > 0 && visible.length === 1) setPage(safePage - 1);
              }}
            />
          ))}
        </div>
      )}

      {/* Add form */}
      {!isLoading && isAdding && (
        <div className="space-y-2.5 rounded-xl border border-border-subtle bg-surface-1/50 p-3">
          {(seasons != null || episodes != null) && (
            <p className="text-[11px] text-text-tertiary">
              TMDB:{" "}
              {seasons != null && <span>{seasons} season{seasons > 1 ? "s" : ""}</span>}
              {seasons != null && episodes != null && <span className="mx-1 opacity-40">·</span>}
              {episodes != null && <span>{episodes} episodes</span>}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-tertiary">Season</span>
              <input
                type="number"
                min={1}
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="1"
                className="w-14 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-center text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-tertiary">Episode</span>
              <input
                type="number"
                min={1}
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                placeholder="1"
                className="w-14 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-center text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={addHighlight.isPending || !season || !episode}
              className="flex items-center gap-1.5 rounded-lg bg-accent-watching px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {addHighlight.isPending && <Loader2 size={12} className="animate-spin" />}
              Add
            </button>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setSeason(""); setEpisode(""); }}
              className="rounded-lg px-2 py-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add button — hidden when max reached or form open */}
      {!isLoading && !isAdding && highlights.length < MAX && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-default px-4 py-3 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
        >
          <Plus size={13} />
          Add episode highlight
        </button>
      )}

    </div>
  );
}

function EpisodeCard({
  highlight,
  onRemove,
}: {
  highlight: EpisodeHighlight;
  onRemove: () => void;
}) {
  const stillUrl = highlight.still_path
    ? `https://image.tmdb.org/t/p/w500${highlight.still_path}`
    : null;

  return (
    <div className="group relative">
      {/* Colored glass border — blurred still as background */}
      <div className="relative overflow-hidden rounded-xl p-0.75">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: stillUrl ? `url(${stillUrl})` : undefined,
            backgroundColor: stillUrl ? undefined : "#27272a",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(8px) saturate(160%) brightness(1.1)",
          }}
        />
        <div className="absolute inset-0 bg-black/20" />

        {/* Card inner */}
        <div className="relative overflow-hidden rounded-[9px]">
          <div className="relative aspect-video w-full">
            {stillUrl ? (
              <Image
                src={stillUrl}
                alt={highlight.title ?? `S${highlight.season} E${highlight.episode}`}
                fill
                sizes="30vw"
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                <span className="text-[10px] text-zinc-600">No image</span>
              </div>
            )}
          </div>

          {/* Bottom info */}
          <div className="rounded-b-[9px] bg-[#0f0f11]/70 px-3 py-2.5 backdrop-blur-md">
            <p className="truncate text-[12px] font-semibold leading-snug text-text-primary">
              {highlight.title ?? `Episode ${highlight.episode}`}
            </p>
            <p className="mt-0.5 text-[10px] text-text-tertiary">
              S{highlight.season} · E{highlight.episode}
            </p>
          </div>
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 hover:text-white"
      >
        <X size={11} />
      </button>
    </div>
  );
}
