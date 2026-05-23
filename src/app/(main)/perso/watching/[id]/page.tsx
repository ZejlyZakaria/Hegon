/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clapperboard, Network } from "lucide-react";
import { useMediaItem } from "@/modules/watching/hooks/useMediaItem";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import { useSimilarTitles } from "@/modules/watching/hooks/useSimilarTitles";
import { useMediaCredits } from "@/modules/watching/hooks/useMediaCredits";
import { MediaHero } from "@/modules/watching/components/detail/MediaHero";
import { MyTakeRecord } from "@/modules/watching/components/detail/MyTakeRecord";
import { EpisodeHighlights } from "@/modules/watching/components/detail/EpisodeHighlights";
import { MoreLikeThis } from "@/modules/watching/components/detail/MoreLikeThis";
import { CastCrew } from "@/modules/watching/components/detail/CastCrew";
import { CurrentlyWatching } from "@/modules/watching/components/detail/CurrentlyWatching";
import { MediaDetails } from "@/modules/watching/components/detail/MediaDetails";
import { InList } from "@/modules/watching/components/detail/InList";
import { FloatingSaveBar } from "@/modules/watching/components/detail/FloatingSaveBar";
import { toast } from "@/shared/utils/toast";

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="relative w-full animate-pulse bg-surface-1" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 280 }}>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 md:px-10">
          <div className="flex items-end gap-6">
            <div className="aspect-2/3 w-32 shrink-0 rounded-xl bg-surface-2 md:w-40" />
            <div className="flex-1 space-y-3 pb-2">
              <div className="h-7 w-2/3 rounded-lg bg-surface-2" />
              <div className="h-4 w-1/3 rounded bg-surface-1" />
              <div className="h-12 w-full max-w-xl rounded-lg bg-surface-1" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5 p-6 md:p-10">
          <div className="h-3 w-1/4 rounded bg-surface-2" />
          <div className="h-40 rounded-2xl bg-surface-1" />
        </div>
        <div className="space-y-5 border-l border-border-subtle bg-[#0c0c0f] p-6">
          <div className="h-3 w-1/3 rounded bg-surface-2" />
          <div className="h-20 rounded-xl bg-surface-2" />
        </div>
      </div>
    </div>
  );
}

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: media, isLoading } = useMediaItem(id);
  const updateMedia = useUpdateMedia();
  const setPageLabel = useWatchingUIStore((s) => s.setPageLabel);

  useEffect(() => {
    if (!media) return;
    const section = media.type === "film" ? "Movies" : media.type === "serie" ? "TV Shows" : "Animes";
    setPageLabel({ section, title: media.title });
    return () => setPageLabel(null);
  }, [media, setPageLabel]);
  const isSeries = media?.type === "serie" || media?.type === "anime";

  const { data: similar = [] } = useSimilarTitles(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  const { data: credits } = useMediaCredits(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);

  const [notes, setNotes] = useState("");
  const [starRating, setStarRating] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const savedRef = useRef({ notes: "", starRating: 0 });
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (progressTimerRef.current) clearTimeout(progressTimerRef.current); }, []);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(0);

  useEffect(() => {
    if (media) {
      const stars = media.user_rating ?? 0;
      setNotes(media.notes ?? "");
      setStarRating(stars);
      setFavorite(media.favorite);
      setCurrentSeason(media.current_season ?? 1);
      setCurrentEpisode(media.current_episode ?? 0);
      savedRef.current = { notes: media.notes ?? "", starRating: stars };
      setIsDirty(false);
    }
  }, [media]);

  const markDirty = (n: string, r: number) => {
    setIsDirty(n !== savedRef.current.notes || r !== savedRef.current.starRating);
  };

  const handleSave = async () => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, notes, user_rating: starRating > 0 ? starRating : null, favorite });
      savedRef.current = { notes, starRating };
      setIsDirty(false);
      toast("Saved.");
    } catch {
      toast.error("Failed to save.");
    }
  };

  const handleDiscard = () => {
    setNotes(savedRef.current.notes);
    setStarRating(savedRef.current.starRating);
    setIsDirty(false);
  };

  const toggleFavorite = async () => {
    if (!media) return;
    const next = !favorite;
    setFavorite(next);
    try {
      await updateMedia.mutateAsync({ id: media.id, favorite: next });
      toast(next ? "Added to favorites." : "Removed from favorites.");
    } catch {
      setFavorite(!next);
      toast.error("Failed.");
    }
  };

  const updateProgress = (season: number, episode: number) => {
    if (!media) return;
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(async () => {
      try {
        await updateMedia.mutateAsync({ id: media.id, current_season: season, current_episode: episode });
      } catch {
        toast.error("Failed to update progress.");
      }
    }, 500);
  };

  const typeLabel = useMemo(() => {
    if (!media) return "";
    return media.type === "film" ? "Movie" : media.type === "serie" ? "TV Show" : "Anime";
  }, [media]);

  if (isLoading) return <DetailSkeleton />;

  if (!media) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Clapperboard size={32} className="text-text-tertiary" />
        <p className="text-sm text-text-secondary">This title could not be found.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Go back
        </button>
      </div>
    );
  }

  const directors =
    credits?.directors ??
    media.directors?.map((d) => ({ id: -1, name: d.name, profile_url: d.profile_url ?? null })) ??
    [];
  const cast = credits?.cast ?? [];

  return (
    <div className="min-h-screen bg-zinc-950">

      <MediaHero media={media} typeLabel={typeLabel} isSeries={isSeries} onBack={() => router.back()} />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]">

        {/* ── LEFT ──────────────────────────────────────────────────── */}
        <div className="space-y-4 p-3">

          <div className="rounded-2xl bg-surface-1 p-4">
            <MyTakeRecord
              notes={notes}
              onNotesChange={(v) => { setNotes(v); markDirty(v, starRating); }}
              starRating={starRating}
              onStarRatingChange={(v) => { setStarRating(v); markDirty(notes, v); }}
              media={media}
              favorite={favorite}
              onFavoriteToggle={toggleFavorite}
            />
          </div>

          <div className="rounded-2xl bg-surface-1 p-4">
            <CastCrew cast={cast} directors={directors} isSeries={isSeries} />
          </div>

          {isSeries && (media.in_progress || media.watched) && (
            <div className="rounded-2xl bg-surface-1 p-4">
              <EpisodeHighlights mediaItemId={media.id} tmdbId={media.tmdb_id} userId={media.user_id} orgId={media.org_id} seasons={media.seasons ?? null} episodes={media.episodes ?? null} />
            </div>
          )}

          <div className="rounded-2xl bg-surface-1 p-4">
            <MoreLikeThis items={similar as any[]} />
          </div>

          {/* Connections — placeholder */}
          <div className="rounded-2xl bg-surface-1 p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">Connections</h2>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-default px-4 py-3.5">
              <Network size={14} className="shrink-0 text-text-tertiary/50" />
              <p className="text-xs text-text-tertiary">Goals & Books — coming soon</p>
            </div>
          </div>

        </div>

        {/* ── RIGHT ─────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
          <div className="space-y-4 p-3">

            {isSeries && media.in_progress && (
              <div className="rounded-2xl bg-surface-1 p-4">
                <CurrentlyWatching
                  currentSeason={currentSeason}
                  currentEpisode={currentEpisode}
                  onUpdate={updateProgress}
                />
              </div>
            )}

            <div className="rounded-2xl bg-surface-1 p-4">
              <InList mediaItemId={media.id} userId={media.user_id} />
            </div>

            <div className="rounded-2xl bg-surface-1 p-4">
              <MediaDetails media={media} typeLabel={typeLabel} isSeries={isSeries} />
            </div>

          </div>
        </div>

      </div>

      <FloatingSaveBar
        isDirty={isDirty}
        isPending={updateMedia.isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
