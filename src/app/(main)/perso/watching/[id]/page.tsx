/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { useMediaItem } from "@/modules/watching/hooks/useMediaItem";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { useSeasonRefresh } from "@/modules/watching/hooks/useSeasonRefresh";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import { useSimilarTitles } from "@/modules/watching/hooks/useSimilarTitles";
import { useMediaCredits } from "@/modules/watching/hooks/useMediaCredits";
import { useMediaTrailer } from "@/modules/watching/hooks/useMediaTrailer";
import { useWatchProviders } from "@/modules/watching/hooks/useWatchProviders";
import { useOwnedTmdbIds } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useWatchingGoals } from "@/modules/watching/hooks/useWatchingGoals";
import { goalWouldCount } from "@/modules/watching/lib/goal-contribution";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import { ContributingToGoals } from "@/modules/watching/components/detail/ContributingToGoals";
import { GoalRippleToast } from "@/modules/watching/components/detail/GoalRippleToast";
import { MediaHero } from "@/modules/watching/components/detail/MediaHero";
import { TrailerModal } from "@/modules/watching/components/detail/TrailerModal";
import { MyTakeRecord } from "@/modules/watching/components/detail/MyTakeRecord";
import { MoreLikeThis } from "@/modules/watching/components/detail/MoreLikeThis";
import { CastCrew } from "@/modules/watching/components/detail/CastCrew";
import { CurrentlyWatching } from "@/modules/watching/components/detail/CurrentlyWatching";
import { SeasonHistoryStrip } from "@/modules/watching/components/detail/SeasonHistoryStrip";
import { Episodes } from "@/modules/watching/components/detail/Episodes";
import { stampSeasons, seasonRange } from "@/modules/watching/lib/season-years";
import { MediaDetails } from "@/modules/watching/components/detail/MediaDetails";
import { InList } from "@/modules/watching/components/detail/InList";
import { WatchProviders } from "@/modules/watching/components/detail/WatchProviders";
import { ExternalRatings } from "@/modules/watching/components/detail/ExternalRatings";
import { FloatingSaveBar } from "@/modules/watching/components/detail/FloatingSaveBar";
import { DetailSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { toast } from "@/shared/utils/toast";

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: media, isLoading } = useMediaItem(id);
  const updateMedia = useUpdateMedia();
  useSeasonRefresh(media);  // ongoing shows: pull new/just-released seasons from TMDB
  const setPageLabel = useWatchingUIStore((s) => s.setPageLabel);

  useEffect(() => {
    if (!media) return;
    const section = media.type === "film" ? "Movies" : media.type === "serie" ? "TV Shows" : "Animes";
    setPageLabel({ section, title: media.title });
    return () => setPageLabel(null);
  }, [media, setPageLabel]);
  const isSeries = media?.type === "serie" || media?.type === "anime";

  const { data: similar = [] } = useSimilarTitles(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  // Cast is cached in the DB (stored at add time / backfilled) → render straight
  // from there and skip the TMDB credits call. Only fall back to TMDB when absent.
  const hasStoredCast = (media?.cast_members?.length ?? 0) > 0;
  const { data: credits } = useMediaCredits(media?.tmdb_id ?? 0, media?.type ?? "film", !!media && !hasStoredCast);
  const { data: ownedIds = [] } = useOwnedTmdbIds(media?.user_id ?? "", media?.type ?? "film", !!media);
  const { data: trailer } = useMediaTrailer(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  const { data: providers } = useWatchProviders(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  const { data: watchingGoals = [] } = useWatchingGoals();
  const [addItem, setAddItem] = useState<any | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);

  // "More Like This" — drop titles already in the library (like For You), then
  // keep 6. Over-fetched upstream so this still yields 6 addable recommendations.
  const recommendations = useMemo(() => {
    const owned = new Set(ownedIds);
    return (similar as any[]).filter((s) => !owned.has(s.id)).slice(0, 6);
  }, [similar, ownedIds]);

  const [notes, setNotes] = useState("");
  const [starRating, setStarRating] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const savedRef = useRef({ notes: "", starRating: 0 });
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaIdRef = useRef<string | null>(null);
  useEffect(() => () => { if (progressTimerRef.current) clearTimeout(progressTimerRef.current); }, []);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(0);

  useEffect(() => {
    if (media && media.id !== mediaIdRef.current) {
      mediaIdRef.current = media.id;
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
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to save.");
    }
  };

  const handleDiscard = () => {
    setNotes(savedRef.current.notes);
    setStarRating(savedRef.current.starRating);
    setIsDirty(false);
  };

  const handleMarkWatched = async () => {
    if (!media) return;
    try {
      // Stamp every season that has no year yet with the current year (seasons
      // captured earlier keep their real years; the rest default to now).
      const allSeasons = (media.season_episodes ?? []).map((_, idx) => idx + 1);
      const seasonYears = allSeasons.length > 0
        ? stampSeasons(media.season_years, allSeasons, new Date().getFullYear())
        : undefined;
      await updateMedia.mutateAsync({
        id: media.id,
        watched: true,
        recently_watched: true,
        in_progress: false,
        want_to_watch: false,
        is_reference: false,
        watched_at: new Date().toISOString(),
        ...(seasonYears ? { season_years: seasonYears } : {}),
      });
      // Ripple: the felt moment — animate the count + bar for each goal it moves.
      const matched = watchingGoals.filter((g) => goalWouldCount(g, media.type));
      if (matched.length > 0) {
        matched.forEach((g) => {
          const old = g.metric_current;
          toast.custom(() => (
            <GoalRippleToast title={g.title} oldCount={old} newCount={old + 1} target={g.metric_target ?? 0} />
          ));
        });
      } else {
        toast("Marked as watched.");
      }
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const handleStartWatching = async () => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({
        id: media.id,
        in_progress: true,
        watched: false,
        want_to_watch: false,
        is_reference: false,
      });
      toast("Started watching.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const toggleFavorite = async () => {
    if (!media) return;
    const next = !favorite;
    setFavorite(next);
    try {
      await updateMedia.mutateAsync({ id: media.id, favorite: next });
      toast(next ? "Added to favorites." : "Removed from favorites.");
    } catch (err) {
      setFavorite(!next);
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed.");
    }
  };

  const updateProgress = (season: number, episode: number) => {
    if (!media) return;
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    // Auto-capture: any season we just moved PAST is now watched → stamp its year
    // (current year), without overwriting a year you set manually.
    const prevSeason = media.current_season ?? 1;
    const seasonYears = season > prevSeason
      ? stampSeasons(media.season_years, seasonRange(prevSeason, season - 1), new Date().getFullYear())
      : null;
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(async () => {
      try {
        await updateMedia.mutateAsync({
          id: media.id,
          current_season: season,
          current_episode: episode,
          ...(seasonYears ? { season_years: seasonYears } : {}),
        });
      } catch (err) {
        if (isDemoReadOnlyError(err)) return;
        toast.error("Failed to update progress.");
      }
    }, 500);
  };

  const handleSeasonYearsChange = async (next: Record<string, number>) => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, season_years: next });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const handleSeasonRatingsChange = async (next: Record<string, number>) => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, season_ratings: next });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  // "Watched" year edit for titles without a Watch History strip — films stamp
  // watched_at (Dec 31 noon of that year, like the backfill), single-season shows
  // stamp season_years["1"]. Lets Stats attribute them to the real year.
  const handleWatchedYearChange = async (yr: number) => {
    if (!media) return;
    try {
      if (media.type === "film") {
        // watched_at moves → useUpdateMedia recomputes `recently_watched` from it
        await updateMedia.mutateAsync({ id: media.id, watched_at: `${yr}-12-31T12:00:00Z` });
      } else {
        // series/anime keep their year in season_years (Stats reads that, not
        // watched_at) — so recompute `recently_watched` here from the year, else a
        // back-dated show would stay stuck in "Recently Watched".
        await updateMedia.mutateAsync({
          id: media.id,
          season_years: { ...(media.season_years ?? {}), "1": yr },
          recently_watched: yr >= new Date().getFullYear(),
        });
      }
      toast("Year updated.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
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
  const cast = hasStoredCast ? (media.cast_members ?? []) : (credits?.cast ?? []);
  const hasCastCrew = cast.length > 0 || (!isSeries && directors.length > 0);

  const handleAddSimilar = (sim: any) => {
    const tmdbMediaType = media.type === "film" ? "movie" : "tv";
    setAddItem({
      id: sim.id,
      title: sim.title ?? sim.name,
      name: sim.name ?? sim.title,
      poster_path: sim.poster_path,
      backdrop_path: sim.backdrop_path ?? null,
      vote_average: sim.vote_average ?? 0,
      overview: sim.overview ?? "",
      genre_ids: sim.genre_ids ?? [],
      media_type: tmdbMediaType,
      ...(media.type === "film"
        ? { release_date: sim.release_date }
        : { first_air_date: sim.first_air_date }),
    });
  };

  return (
    <div className="min-h-screen bg-surface-0">

      <MediaHero
        media={media}
        typeLabel={typeLabel}
        isSeries={isSeries}
        onBack={() => router.back()}
        hasTrailer={!!trailer?.key}
        onPlayTrailer={() => setTrailerOpen(true)}
      />

      {/* Content rises slightly into the hero's lower gradient — magazine overlap. */}
      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">

        {/* ── LEFT — primary column ─────────────────────────────────── */}
        <div className="min-w-0 space-y-8 px-4 py-6 lg:py-8 lg:pl-8 lg:pr-2">

          {/* Manage/track surfaces = cards (rendered inside the components); browse = open */}
          <MyTakeRecord
            notes={notes}
            onNotesChange={(v) => { setNotes(v); markDirty(v, starRating); }}
            starRating={starRating}
            onStarRatingChange={(v) => { setStarRating(v); markDirty(notes, v); }}
            media={media}
            favorite={favorite}
            onFavoriteToggle={toggleFavorite}
            isSeries={isSeries}
            onMarkWatched={handleMarkWatched}
            onStartWatching={handleStartWatching}
            isUpdating={updateMedia.isPending}
          />

          {hasCastCrew && (
            <CastCrew cast={cast} directors={directors} isSeries={isSeries} />
          )}

          {isSeries && (media.season_episodes?.length ?? 0) > 1 && (media.in_progress || media.watched) && (
            <SeasonHistoryStrip
              seasonEpisodes={media.season_episodes ?? []}
              seasonPosters={media.season_posters}
              seasonAirDates={media.season_air_dates}
              seasonYears={media.season_years}
              seasonRatings={media.season_ratings}
              showPoster={media.poster_url}
              releaseYear={media.year ?? null}
              currentSeason={currentSeason}
              inProgress={media.in_progress}
              onYearChange={handleSeasonYearsChange}
              onRatingChange={handleSeasonRatingsChange}
            />
          )}

          {isSeries && media.tmdb_id && (
            <Episodes media={media} currentSeason={currentSeason} />
          )}

          {recommendations.length > 0 && (
            <MoreLikeThis items={recommendations} onAddClick={handleAddSimilar} />
          )}

          {/* Connections — goals this title contributes to (kept open: can render null) */}
          <ContributingToGoals media={media} />

        </div>

        {/* ── RIGHT — quiet utility rail (flows with the page, one natural scroll) ── */}
        <div>
          <div className="space-y-6 px-4 py-6 lg:py-8 lg:pl-2 lg:pr-8">

            {isSeries && media.in_progress && (
              <CurrentlyWatching
                currentSeason={currentSeason}
                currentEpisode={currentEpisode}
                onUpdate={updateProgress}
                media={media}
                onMarkCompleted={handleMarkWatched}
              />
            )}

            <WatchProviders info={providers} />

            <ExternalRatings media={media} />

            <InList mediaItemId={media.id} userId={media.user_id} />

            <MediaDetails media={media} typeLabel={typeLabel} isSeries={isSeries} onWatchedYearChange={handleWatchedYearChange} />

          </div>
        </div>

      </div>

      <TrailerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        youtubeKey={trailer?.key}
        title={media.title}
      />

      <AddMediaModal
        isOpen={!!addItem}
        onClose={() => setAddItem(null)}
        onAdded={() => setAddItem(null)}
        defaultType={media.type}
        listContext="wantToWatch"
        initialItem={addItem}
      />

      <FloatingSaveBar
        isDirty={isDirty}
        isPending={updateMedia.isPending}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
