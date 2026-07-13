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
import { StatusCard } from "@/modules/watching/components/detail/StatusCard";
import { MyTake } from "@/modules/watching/components/detail/MyTake";
import { MoreLikeThis } from "@/modules/watching/components/detail/MoreLikeThis";
import { CastCrew } from "@/modules/watching/components/detail/CastCrew";
import DeleteConfirmModal from "@/modules/watching/components/modals/DeleteConfirmModal";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { CaptureSheet } from "@/modules/watching/components/shared/CaptureSheet";
import { DROP_REASONS } from "@/modules/watching/lib/drop-reasons";
import { RESET_STATUS } from "@/modules/watching/lib/status-flags";
import { SeasonHistoryStrip } from "@/modules/watching/components/detail/SeasonHistoryStrip";
import { Episodes } from "@/modules/watching/components/detail/Episodes";
import { stampSeasons, seasonRange } from "@/modules/watching/lib/season-years";
import { caughtUpAt, isSeasonComplete, isSeasonDatable, lastAiredPosition, seriesState } from "@/modules/watching/lib/series-state";
import { MediaDetails } from "@/modules/watching/components/detail/MediaDetails";
import { QuickStats } from "@/modules/watching/components/detail/QuickStats";
import { InList } from "@/modules/watching/components/detail/InList";
import { AnimeThemes } from "@/modules/watching/components/detail/AnimeThemes";
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
  const { data: trailer, isLoading: trailerLoading } = useMediaTrailer(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  const { data: providers } = useWatchProviders(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  const { data: watchingGoals = [] } = useWatchingGoals();
  const [addItem, setAddItem] = useState<any | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [dropSheetOpen, setDropSheetOpen] = useState(false);

  // "More Like This" — drop titles already in the library (like For You), then
  // keep 6. Over-fetched upstream so this still yields 6 addable recommendations.
  const recommendations = useMemo(() => {
    const owned = new Set(ownedIds);
    return (similar as any[]).filter((s) => !owned.has(s.id)).slice(0, 6);
  }, [similar, ownedIds]);

  const [favorite, setFavorite] = useState(false);
  const [forceTakeOpen, setForceTakeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMedia = useDeleteMedia();
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaIdRef = useRef<string | null>(null);
  useEffect(() => () => { if (progressTimerRef.current) clearTimeout(progressTimerRef.current); }, []);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(0);

  useEffect(() => {
    if (media && media.id !== mediaIdRef.current) {
      mediaIdRef.current = media.id;
      setFavorite(media.favorite);
      setCurrentSeason(media.current_season ?? 1);
      setCurrentEpisode(media.current_episode ?? 0);
      setForceTakeOpen(false);
    }
  }, [media]);

  // Delete lives in the StatusCard's "…" menu — same modal + hook as the Library.
  const confirmDelete = async () => {
    if (!media) return;
    try {
      await deleteMedia.mutateAsync(media.id);
      setDeleteOpen(false);
      toast("Deleted from your library.");
      router.back();
    } catch {
      // errors (incl. demo read-only) are toasted by the hook
      setDeleteOpen(false);
    }
  };

  const handleMarkWatched = async () => {
    if (!media) return;
    try {
      // A `watched` series with NO POSITION is the exact row this whole model exists to prevent:
      // `watchedCount()` reads a null position as zero episodes seen, so the title claims to be
      // finished while every derived rule believes you've watched nothing. Twenty-three rows in
      // the library looked like that, and this function is where they came from. Finishing a show
      // therefore MOVES you to its last aired episode — the claim and its evidence, together.
      const last = isSeries ? lastAiredPosition(media) : null;

      // ...and it only stamps seasons that have FULLY AIRED. Stamping every announced season put
      // "2026" on House of the Dragon's season 3 — four episodes out of eight. Same bug as
      // "Set all year"; it was born here. Rows with no airing data yet keep the old behaviour
      // rather than silently stamping nothing.
      const hasAiring = (media.season_aired?.length ?? 0) > 0;
      const stampable = (media.season_episodes ?? [])
        .map((_, idx) => idx + 1)
        .filter((s) => !hasAiring || isSeasonComplete(media, s));
      const seasonYears = stampable.length > 0 && media.season_years !== undefined
        ? stampSeasons(media.season_years, stampable, new Date().getFullYear())
        : undefined;

      await updateMedia.mutateAsync({
        id: media.id,
        watched: true,
        recently_watched: true,
        in_progress: false,
        want_to_watch: false,
        is_reference: false,
        ...RESET_STATUS,
        watched_at: new Date().toISOString(),
        ...(last ? { current_season: last.season, current_episode: last.episode } : {}),
        ...(seasonYears ? { season_years: seasonYears } : {}),
      });
      if (last) { setCurrentSeason(last.season); setCurrentEpisode(last.episode); }
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

  /**
   * "I've seen everything that's out." The truthful action for a show that isn't over, and the
   * one the app never had — which is why people reached for "Mark as watched" and lied.
   *
   * It lands you exactly where you are: at the last AIRED episode, in progress, caught up. Then
   * the day season 4 drops, the sync raises what has aired, you are mechanically behind again,
   * and the card lights up as NEW. No boolean anyone has to remember to flip back.
   */
  const handleMarkCaughtUp = async () => {
    if (!media) return;
    const last = lastAiredPosition(media);
    if (!last) {
      toast.error("We don't know what has aired for this title yet.");
      return;
    }
    try {
      const facts = { ...media, current_season: last.season, current_episode: last.episode };
      const stampable = (media.season_episodes ?? [])
        .map((_, idx) => idx + 1)
        .filter((s) => isSeasonDatable(facts, s));
      const seasonYears = stampable.length > 0 && media.season_years !== undefined
        ? stampSeasons(media.season_years, stampable, new Date().getFullYear())
        : undefined;

      await updateMedia.mutateAsync({
        id: media.id,
        in_progress: true,
        watched: false,
        want_to_watch: false,
        is_reference: false,
        ...RESET_STATUS,
        current_season: last.season,
        current_episode: last.episode,
        caught_up_at: caughtUpAt(facts, media.caught_up_at),
        last_watched_at: new Date().toISOString(),
        ...(seasonYears ? { season_years: seasonYears } : {}),
      });
      setCurrentSeason(last.season);
      setCurrentEpisode(last.episode);
      toast("All caught up — waiting on what comes next.");
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
        ...RESET_STATUS,
      });
      toast("Started watching.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const handleDrop = async (reason: string | null) => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, dropped: true, drop_reason: reason, paused: false, in_progress: false });
      toast("Marked as dropped.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const handlePause = async () => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, paused: true, dropped: false, drop_reason: null, in_progress: false });
      toast("Paused.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const handleResume = async () => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, dropped: false, drop_reason: null, paused: false, in_progress: true });
      toast("Back to watching.");
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

    // FORWARD only. Stepping back is a CORRECTION — you're fixing what the app believed, not
    // telling it you watched something today. Stamping a date there would turn every fix into
    // a fresh lie.
    const prevSeason = media.current_season ?? 1;
    const prevEpisode = media.current_episode ?? 0;
    const movedForward = season > prevSeason || (season === prevSeason && episode > prevEpisode);

    // Auto-capture: any season we just moved PAST is now watched → stamp its year
    // (current year), without overwriting a year you set manually.
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
          // Every write of a POSITION recomputes this — it's a function of where you stand, not
          // a flag anybody sets. Reach the frontier by stepping to it and the app knows you were
          // caught up; step away and it forgets. That's what makes "New episodes" fire later.
          ...(isSeries
            ? { caught_up_at: caughtUpAt({ ...media, current_season: season, current_episode: episode }, media.caught_up_at) }
            : {}),
          ...(seasonYears ? { season_years: seasonYears } : {}),
          ...(movedForward ? { last_watched_at: new Date().toISOString() } : {}),
        });
      } catch (err) {
        if (isDemoReadOnlyError(err)) return;
        toast.error("Failed to update progress.");
      }
    }, 500);
  };

  /**
   * "I watched through season 3." — the edit the app never had.
   *
   * You marked Seven Deadly Sins as watched because that was the only word on offer, and you had
   * in fact seen three of its four seasons. Or you dropped a show and want to say you left after
   * season 2, not season 3. Both are the SAME gesture — move where you stand — and neither was
   * possible from the detail page: the steppers only walk one episode at a time, and the season
   * strip was read-only.
   *
   * TWO THINGS FOLLOW FROM THE MOVE, and neither is a checkbox anyone has to remember:
   *
   * · THE STATUS. `watched` is a claim about the whole show; step back to season 3 of four and
   *   it stops being true. So the status is re-derived from the new position, exactly as it is
   *   everywhere else. (Stepping to the very end of a finished show does the opposite: it
   *   completes it.) A stance you chose — paused, dropped — survives: moving the marker doesn't
   *   change your mind about the show, it corrects WHERE the marker is.
   *
   * · THE YEARS ARE NOT TOUCHED. Claiming seasons 2 and 3 today does not mean you watched them
   *   today — Seven Deadly Sins was years ago. Stamping the current year here would replace one
   *   false claim with another. The seasons simply become datable, and you date them yourself.
   */
  const handleSetPosition = async (season: number, episode: number) => {
    if (!media) return;
    const facts = { ...media, current_season: season, current_episode: episode };
    const completed = seriesState(facts) === "completed";
    const hadStance = media.paused || media.dropped;

    setCurrentSeason(season);
    setCurrentEpisode(episode);
    try {
      await updateMedia.mutateAsync({
        id: media.id,
        current_season: season,
        current_episode: episode,
        caught_up_at: caughtUpAt(facts, media.caught_up_at),
        ...(completed
          ? { watched: true, in_progress: false, want_to_watch: false, is_reference: false, ...RESET_STATUS }
          : media.watched
            // It was "finished". It isn't any more — and it must leave the finished rails too,
            // or it keeps showing up in Recently Watched as a show you completed.
            ? { watched: false, recently_watched: false, in_progress: !hadStance }
            : {}),
      });
      toast(completed ? "Marked as watched." : `Watched through season ${season}.`);
    } catch (err) {
      setCurrentSeason(media.current_season ?? 1);
      setCurrentEpisode(media.current_episode ?? 0);
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
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
    media.directors?.map((d) => ({ id: d.id ?? -1, name: d.name, profile_url: d.profile_url ?? null })) ??
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

  const isUnwatched = !!(media.is_reference || (media.want_to_watch && !media.watched && !media.in_progress));

  // THE state-aware surface — the module's branded hero card. Rendered twice:
  // right under the hero on mobile (the daily action must never sink below the
  // fold) and first in the right rail on desktop.
  const statusCard = (
    <StatusCard
      media={media}
      isSeries={isSeries}
      providers={providers}
      currentSeason={currentSeason}
      currentEpisode={currentEpisode}
      onUpdateProgress={updateProgress}
      favorite={favorite}
      onFavoriteToggle={toggleFavorite}
      onMarkWatched={handleMarkWatched}
      onMarkCaughtUp={handleMarkCaughtUp}
      onStartWatching={handleStartWatching}
      onPause={handlePause}
      onDrop={() => setDropSheetOpen(true)}
      onResume={handleResume}
      onAddNote={() => setForceTakeOpen(true)}
      onWatchedYearChange={handleWatchedYearChange}
      onDelete={() => setDeleteOpen(true)}
      isUpdating={updateMedia.isPending}
    />
  );

  return (
    <div className="min-h-screen bg-surface-0">

      <MediaHero
        media={media}
        isSeries={isSeries}
        onBack={() => router.back()}
        hasTrailer={!!trailer?.key}
        trailerLoading={trailerLoading}
        onPlayTrailer={() => setTrailerOpen(true)}
      />

      {/* Mobile slot — the StatusCard right after the hero, before everything */}
      <div className="px-4 pt-4 lg:hidden">
        {statusCard}
      </div>

      {/* Content rises slightly into the hero's lower gradient — magazine overlap. */}
      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">

        {/* ── LEFT — primary column ─────────────────────────────────── */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">

          {/* Left = you & the work: verdict → memory → progress → catalogue (people, recos) */}
          <MyTake media={media} forceNoteOpen={forceTakeOpen} />

          {isSeries && (media.season_episodes?.length ?? 0) > 1 && (media.in_progress || media.watched || media.paused || media.dropped) && (
            <SeasonHistoryStrip
              seasonEpisodes={media.season_episodes ?? []}
              seasonAired={media.season_aired}
              currentEpisode={currentEpisode}
              seasonPosters={media.season_posters}
              seasonAirDates={media.season_air_dates}
              seasonEndDates={media.season_end_dates}
              seasonYears={media.season_years}
              seasonRatings={media.season_ratings}
              showPoster={media.poster_url}
              releaseYear={media.year ?? null}
              currentSeason={currentSeason}
              inProgress={media.in_progress}
              incomplete={!media.watched}
              onYearChange={handleSeasonYearsChange}
              onRatingChange={handleSeasonRatingsChange}
              onSetPosition={handleSetPosition}
            />
          )}

          {/* want_to_watch: read-only (catalogue scope — no rating/best-ep on unwatched episodes) */}
          {isSeries && media.tmdb_id && (
            <Episodes media={media} currentSeason={currentSeason} readOnly={isUnwatched} />
          )}

          {hasCastCrew && (
            <CastCrew cast={cast} directors={directors} isSeries={isSeries} />
          )}

          {recommendations.length > 0 && (
            <MoreLikeThis items={recommendations} onAddClick={handleAddSimilar} />
          )}

        </div>

        {/* ── RIGHT — quiet utility rail (flows with the page, one natural scroll) ── */}
        <div className="min-w-0">
          <div className="space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">

            {/* Desktop slot — the branded hero card leads the rail */}
            <div className="hidden lg:block">
              {statusCard}
            </div>

            {/* Your numbers first, the world's numbers (Details) after. */}
            <QuickStats media={media} />

            <AnimeThemes media={media} />

            <MediaDetails media={media} typeLabel={typeLabel} isSeries={isSeries} />

            <InList mediaItemId={media.id} userId={media.user_id} />

            {/* The link out to another module closes the rail — it's the least "about this
                title" thing here, so it earns the last slot, not a middle one. */}
            <ContributingToGoals media={media} />

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

      <CaptureSheet
        open={dropSheetOpen}
        onOpenChange={setDropSheetOpen}
        title="Why did you drop it?"
        subtitle="Optional — helps you remember later."
        options={DROP_REASONS}
        onPick={(reason) => handleDrop(reason)}
        onSkip={() => handleDrop(null)}
        skipLabel="Drop without a reason"
      />

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={`Delete "${media.title}"?`}
        description="It will be removed from your library, along with your take, history and rewatches. This cannot be undone."
        isDeleting={deleteMedia.isPending}
      />
    </div>
  );
}
