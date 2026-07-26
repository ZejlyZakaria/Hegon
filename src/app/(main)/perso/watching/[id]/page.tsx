/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { useMediaItem } from "@/modules/watching/hooks/useMediaItem";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { useWatchActions } from "@/modules/watching/hooks/useWatchActions";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import { useSimilarTitles } from "@/modules/watching/hooks/useSimilarTitles";
import { useMediaCredits } from "@/modules/watching/hooks/useMediaCredits";
import { useMediaTrailer } from "@/modules/watching/hooks/useMediaTrailer";
import { useWatchProviders } from "@/modules/watching/hooks/useWatchProviders";
import { useOwnedTmdbIds } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import { ContributingToGoals } from "@/modules/watching/components/detail/ContributingToGoals";
import { MediaHero } from "@/modules/watching/components/detail/MediaHero";
import { TrailerModal } from "@/modules/watching/components/detail/TrailerModal";
import { StatusCard } from "@/modules/watching/components/detail/StatusCard";
import { MyTake } from "@/modules/watching/components/detail/MyTake";
import { MoreLikeThis } from "@/modules/watching/components/detail/MoreLikeThis";
import { CastCrew, CastCrewSkeleton } from "@/modules/watching/components/detail/CastCrew";
import DeleteConfirmModal from "@/modules/watching/components/modals/DeleteConfirmModal";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { CaptureSheet } from "@/modules/watching/components/shared/CaptureSheet";
import { DROP_REASONS } from "@/modules/watching/lib/drop-reasons";
import { SeasonHistoryStrip } from "@/modules/watching/components/detail/SeasonHistoryStrip";
import { Episodes } from "@/modules/watching/components/detail/Episodes";
import { useMediaView } from "@/modules/watching/hooks/useMediaView";
import { yearsPatch, type StatusPatch } from "@/modules/watching/lib/watch-status";
import type { WatchingMedia } from "@/modules/watching/types";
import { buildWatchedAt, type WatchDateParts } from "@/modules/watching/lib/watched-date";
import { MediaDetails } from "@/modules/watching/components/detail/MediaDetails";
import { QuickStats } from "@/modules/watching/components/detail/QuickStats";
import { InList } from "@/modules/watching/components/detail/InList";
import { TopTenRank } from "@/modules/watching/components/detail/TopTenRank";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useRewatches } from "@/modules/watching/hooks/useRewatches";
import { useListsForMedia, useListsWithThumbnails } from "@/modules/watching/hooks/useMediaLists";
import { AnimeThemes } from "@/modules/watching/components/detail/AnimeThemes";
import { DetailSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { toast } from "@/shared/utils/toast";

/**
 * THE ROW'S POSITION, IN STORAGE UNITS — and the only place this page is allowed to read it raw.
 *
 * The steppers hold their own state so they feel instant, and that state deliberately mirrors the
 * row byte for byte: storage space, TMDB seasons, flat episodes for a lumped anime. The lens
 * translates it for display (`shown`) and back again on write (`toStorage`), so the UI never sees a
 * flat episode number and the database never sees a cour one.
 *
 * Six identical raw reads were scattered across this file to do it. Gathering them here is what
 * makes the coordinate guard readable: one suppression with one reason, instead of six that a
 * reader would learn to skip past.
 */
// eslint-disable-next-line no-restricted-syntax -- the page's single sanctioned storage-space read; see above.
const storedPosition = (m: WatchingMedia) => ({ season: m.current_season ?? 1, episode: m.current_episode ?? 0 });

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: media, isLoading } = useMediaItem(id);
  const updateMedia = useUpdateMedia();

  /**
   * THE QUERIES THAT NEVER NEEDED TO WAIT — started here, at t=0.
   *
   * Opening a fiche used to fire in three waves: the row and the session facts, then ~640ms later
   * everything else, then a third round. The second wave looked like a data dependency and mostly
   * wasn't: `rewatches`, `media_list_items` and `media_lists` are keyed by the id in the URL and the
   * signed-in user — both known before the first byte comes back. They started late only because the
   * components that ask for them do not MOUNT until the row has rendered.
   *
   * So we ask here instead, where the page mounts immediately. Same query keys, so the components
   * below get a warm cache rather than a second request.
   *
   * Only what is ALWAYS needed: QuickStats and InList render on every fiche. `episode_highlights`
   * stays where it is — it belongs to Episodes, which a film never mounts, and warming it here
   * would add a request for every film to save one for a series.
   */
  const sessionUserId = useCurrentUserId();
  useRewatches(id);
  useListsForMedia(id);
  useListsWithThumbnails(sessionUserId ?? "");
  // `useSeasonRefresh` used to fire here on every open of an ongoing title: a TMDB call, and a
  // write of the ANNOUNCED counts that never touched the AIRED ones. A second writer of the
  // world's facts, with its own rules and its own clock. The hourly sync owns that now.
  const setPageLabel = useWatchingUIStore((s) => s.setPageLabel);

  useEffect(() => {
    if (!media) return;
    const section = media.type === "film" ? "Movies" : media.type === "serie" ? "TV Shows" : "Animes";
    setPageLabel({ section, title: media.title });
    return () => setPageLabel(null);
  }, [media, setPageLabel]);
  const isSeries = media?.type === "serie" || media?.type === "anime";

  const { data: similar = [], isLoading: similarLoading } = useSimilarTitles(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  // Cast is cached in the DB (stored at add time / backfilled) → render straight
  // from there and skip the TMDB credits call. Only fall back to TMDB when absent.
  const hasStoredCast = (media?.cast_members?.length ?? 0) > 0;
  const { data: credits, isLoading: creditsLoading } = useMediaCredits(media?.tmdb_id ?? 0, media?.type ?? "film", !!media && !hasStoredCast);
  const { data: ownedIds = [] } = useOwnedTmdbIds(media?.user_id ?? "", media?.type ?? "film", !!media);
  const { data: trailer, isLoading: trailerLoading } = useMediaTrailer(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  const { data: providers } = useWatchProviders(media?.tmdb_id ?? 0, media?.type ?? "film", !!media);
  // THE LENS — the one object that knows which coordinate space this title lives in. It fetches the
  // AniList cours itself when they matter, and hands back everything in DISPLAY space.
  const view = useMediaView(media);
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
      const at = storedPosition(media);
      setCurrentSeason(at.season);
      setCurrentEpisode(at.episode);
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

  // Every status transition on this page now comes from the same place as the one on a poster card
  // and the one inside a list. They used to be three hand-written copies, and they drifted.
  const actions = useWatchActions(media);

  // The steppers hold their own state so they feel instant; a transition that MOVES the position
  // (finishing a show, catching up) has to bring them along.
  const follow = (patch: StatusPatch | null) => {
    // A PATCH, not a row — and a patch is written in storage units by construction (positionPatch
    // takes storage coordinates), which is the same space this state lives in. No lens to apply.
    // eslint-disable-next-line no-restricted-syntax -- reading a storage-space patch into storage-space state.
    if (patch?.current_season != null) { setCurrentSeason(patch.current_season); setCurrentEpisode(patch.current_episode ?? 0); }
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

  /**
   * The steppers. Moving them is a VIEWING when you go forward and a CORRECTION when you go back —
   * you are not telling the app you watched something today, you are fixing what it believed. That
   * one word decides whether the move gets dated and whether a finished season gets its year, and
   * `positionPatch` does the rest.
   *
   * Debounced: the local state moves at once so the "+" feels instant, the write follows.
   */
  const updateProgress = (displaySeason: number, displayEpisode: number) => {
    if (!media) return;
    // The steppers speak DISPLAY units; storage speaks TMDB. One conversion, at the boundary.
    const to = view ? view.toStorage(displaySeason, displayEpisode) : { season: displaySeason, episode: displayEpisode };
    // Both sides in storage units — comparing a converted target against the row is only meaningful
    // in one space, and mixing them is precisely what the guard exists to catch.
    const at = storedPosition(media);
    const forward = to.season > at.season || (to.season === at.season && to.episode > at.episode);

    setCurrentSeason(to.season);
    setCurrentEpisode(to.episode);

    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(() => {
      void actions.setPosition(to.season, to.episode, forward ? "viewing" : "correction");
    }, 500);
  };

  /**
   * "I watched through season 3." — the edit the app never had, from the Watch History strip.
   *
   * You marked Seven Deadly Sins as watched because that was the only word on offer, and you had in
   * fact seen three of its four seasons. Or you dropped a show and want to say you left after
   * season 2, not season 3. Both are the SAME gesture — move where you stand — and neither was
   * possible: the steppers walk one episode at a time, and the strip was read-only.
   *
   * It is a CORRECTION, always: it re-derives the status (a "watched" show stops being watched, and
   * landing on the end of a finished one completes it) and it stamps NO years, because claiming a
   * season today does not mean you watched it today.
   */
  const handleSetPosition = async (displaySeason: number, displayEpisode: number) => {
    // The strip speaks DISPLAY units too — cours for an overlaid anime, plain seasons otherwise.
    const to = view ? view.toStorage(displaySeason, displayEpisode) : { season: displaySeason, episode: displayEpisode };
    setCurrentSeason(to.season);
    setCurrentEpisode(to.episode);
    const patch = await actions.setPosition(to.season, to.episode, "correction", `Watched through season ${displaySeason}.`);
    if (!patch && media) {
      // The write was refused — put the steppers back where the row still says they are.
      const at = storedPosition(media);
      setCurrentSeason(at.season);
      setCurrentEpisode(at.episode);
    }
  };

  // FOUR handlers became two. There used to be a season pair and a cour pair, and every call site
  // had to pick — `overlay ? handleCourYearsChange : handleSeasonYearsChange`. Choosing the column
  // is exactly what the lens is for, so the choice is gone: the strip says "this season, this year"
  // in display units and `writeYears` puts it where it belongs.
  const handleYearsChange = async (next: Record<string, number>) => {
    if (!media || !view) return;
    try {
      // `watched_at` FOLLOWS the years — see yearsPatch. Correcting Blue Lock to 2023/2024 after
      // marking it watched used to leave the date at today, so Last Watched claimed you finished it
      // this afternoon.
      await updateMedia.mutateAsync({
        id: media.id,
        type: media.type,
        ...yearsPatch(media, next, view.writeYears),
      });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  const handleRatingsChange = async (next: Record<string, number>) => {
    if (!media || !view) return;
    try {
      const key = view.overlaid ? "cour_ratings" : "season_ratings";
      await updateMedia.mutateAsync({ id: media.id, [key]: next });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  // A FILM's date is a real timestamp. The shared picker (month + day) feeds buildWatchedAt, the
  // same construction the add flow uses, so a corrected date sorts precisely in Recently Watched.
  const handleWatchedDateChange = async (parts: WatchDateParts) => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({ id: media.id, type: media.type, watched_at: buildWatchedAt(parts) });
      toast("Date updated.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update.");
    }
  };

  // A ONE-SEASON series keeps its year in `season_years` (Stats reads that). We move `watched_at`
  // with it too, so the Recently Watched rail — which orders by watched_at — agrees with Stats
  // instead of stranding a back-dated show at "now".
  // THE YEAR OF A SINGLE-SEASON TITLE — one writer for both "finished it" and "caught up on it".
  // The year lives in the season's stamp (`cour_years["1"]` through the lens, `season_years["1"]`
  // without one) — the same column Watch History edits, so there is never a second source. Only a
  // FINISHED series gets a `watched_at` too (its precise finish timestamp); a caught-up one has not
  // finished, so it gets the stamp alone and nothing writes a completion date it doesn't have.
  const handleSeasonYearChange = async (yr: number) => {
    if (!media) return;
    try {
      await updateMedia.mutateAsync({
        id: media.id,
        type: media.type,
        // eslint-disable-next-line no-restricted-syntax -- explicit `view ? lens : raw` fallback; the raw side only runs when there is no overlay.
        ...(view ? view.writeYear(1, yr) : { season_years: { ...(media.season_years ?? {}), "1": yr } }),
        ...(media.watched ? { watched_at: buildWatchedAt({ year: yr, month: null, day: null }) } : {}),
      });
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

  // Hold the skeleton until the LENS is resolved too, not just the row. Painting with the flat
  // position and re-rendering into cour coordinates a beat later made the hero visibly change its
  // mind ("Episode 59 / 59" → "Season 3 · Episode 12"). The cours are a tiny, hour-cached read, so
  // this costs one round trip on a cold open and nothing afterwards.
  if (isLoading || view?.pending) return <DetailSkeleton />;

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

  // Where you stand, in the space the UI speaks. The local stepper state stays in STORAGE units (it
  // mirrors the row); the lens translates for display, and back again on write.
  const shown = view
    ? view.fromStorage(currentSeason, currentEpisode)
    : { season: currentSeason, episode: currentEpisode };

  // THE state-aware surface — the module's branded hero card. Rendered twice:
  // right under the hero on mobile (the daily action must never sink below the
  // fold) and first in the right rail on desktop.
  const statusCard = (
    <StatusCard
      media={media}
      isSeries={isSeries}
      providers={providers}
      currentSeason={shown.season}
      currentEpisode={shown.episode}
      view={view}
      onUpdateProgress={updateProgress}
      favorite={favorite}
      onFavoriteToggle={toggleFavorite}
      onMarkWatched={() => actions.markWatched().then(follow)}
      onMarkCaughtUp={() => actions.markCaughtUp().then(follow)}
      onStartWatching={actions.startWatching}
      onPause={actions.pause}
      onDrop={() => setDropSheetOpen(true)}
      onResume={actions.resume}
      onAddNote={() => setForceTakeOpen(true)}
      onSeasonYearChange={handleSeasonYearChange}
      onWatchedDateChange={handleWatchedDateChange}
      onDelete={() => setDeleteOpen(true)}
      isUpdating={actions.isPending}
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

          {isSeries && (view?.seasons.length ?? 0) > 1 && (media.in_progress || media.watched || media.paused || media.dropped) && (
            <SeasonHistoryStrip
              seasonEpisodes={view?.seasons.map((s) => s.episodes) ?? []}
              seasonAired={view?.seasons.map((s) => s.aired)}
              currentEpisode={shown.episode}
              seasonPosters={view?.seasons.map((s) => s.poster)}
              seasonAirDates={view?.overlaid ? undefined : media.season_air_dates}
              seasonEndDates={view?.seasons.map((s) => s.endDate)}
              seasonYears={view?.yearMap}
              seasonRatings={view?.ratingMap}
              showPoster={media.poster_url}
              releaseYear={media.year ?? null}
              currentSeason={shown.season}
              inProgress={media.in_progress}
              incomplete={!media.watched}
              onYearChange={handleYearsChange}
              onRatingChange={handleRatingsChange}
              onSetPosition={handleSetPosition}
            />
          )}

          {/* want_to_watch: read-only (catalogue scope — no rating/best-ep on unwatched episodes) */}
          {isSeries && media.tmdb_id && (
            <Episodes media={media} currentSeason={shown.season} readOnly={isUnwatched} cours={view?.cours ?? undefined} />
          )}

          {/* A title whose cast we stored renders instantly and never shifts. One we have to ask
              TMDB for arrives late — hold the rail's height so More Like This doesn't jump. */}
          {creditsLoading ? (
            <CastCrewSkeleton />
          ) : hasCastCrew ? (
            <CastCrew cast={cast} directors={directors} isSeries={isSeries} />
          ) : null}

          {recommendations.length > 0 && (
            <MoreLikeThis items={recommendations} loading={similarLoading} onAddClick={handleAddSimilar} />
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
            <QuickStats media={media} view={view} />

            <AnimeThemes media={media} />

            <MediaDetails media={media} typeLabel={typeLabel} isSeries={isSeries} />

            {/* Ranking sits beside the lists because it IS one — the one list that is ordered.
                Shown for anything you've spent real watch time on: RANKING IS NOT WATCHING, so a show
                you're mid-way through, caught up on, paused, or stopped-but-loved (Prison Break after
                a poor final season; a True Detective anthology season) can all be a favourite. Only
                want-to-watch is out — a Top 10 is a verdict, and you cannot rank what you've not seen. */}
            {(media.watched || media.in_progress || media.paused || media.dropped) && (
              <TopTenRank media={media} />
            )}

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
        onPick={(reason) => actions.drop(reason)}
        onSkip={() => actions.drop(null)}
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
