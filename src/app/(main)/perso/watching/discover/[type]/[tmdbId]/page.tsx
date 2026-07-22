/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * A title you do NOT own — the same page, minus you.
 *
 * The owned detail page is really "a tmdb_id + your row": the hero, the genres, the cast, the
 * episodes and the recommendations all derive from the tmdb_id alone. So this route mounts those
 * very components against a VIRTUAL row (`mapTmdbDetails`), and simply does not mount the ones
 * that describe YOU — My Take, Quick Stats, Watch History, the StatusCard. There is no history to
 * show on something you have never watched, and a panel that renders empty is worse than absent.
 *
 * It is a SEPARATE route on purpose. The owned page is the module's most worked-on surface; making
 * it also serve a guest case would have meant threading "do I own this?" through every branch of a
 * 486-line component. A second, smaller page that reuses the same parts is the cheaper truth.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Play, Plus } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { Button } from "@/shared/components/ui/button";
import { Panel } from "@/shared/components/ui/panel";
import { useTmdbDetails } from "@/modules/watching/hooks/useTmdbDetails";
import { useSimilarTitles } from "@/modules/watching/hooks/useSimilarTitles";
import { useMediaCredits } from "@/modules/watching/hooks/useMediaCredits";
import { useMediaTrailer } from "@/modules/watching/hooks/useMediaTrailer";
import { useOwnedTmdbIds, useOwnedMediaId } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useWatchProviders } from "@/modules/watching/hooks/useWatchProviders";
import { WhereToWatch } from "@/modules/watching/components/shared/WhereToWatch";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import { MediaHero } from "@/modules/watching/components/detail/MediaHero";
import { MediaDetails } from "@/modules/watching/components/detail/MediaDetails";
import { CastCrew, CastCrewSkeleton } from "@/modules/watching/components/detail/CastCrew";
import { MoreLikeThis } from "@/modules/watching/components/detail/MoreLikeThis";
import { Episodes } from "@/modules/watching/components/detail/Episodes";
import { useAnimeCours } from "@/modules/watching/hooks/useAnimeCours";
import { shouldOverlay } from "@/modules/watching/lib/anime-overlay";
import { AnimeThemes } from "@/modules/watching/components/detail/AnimeThemes";
import { TrailerModal } from "@/modules/watching/components/detail/TrailerModal";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import { DetailSkeleton, DiscoverSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { WATCHING_ACCENT } from "@/modules/watching/ui";
import { tmdbPathFromUrl, getMediaItemById } from "@/modules/watching/service";
import { WATCHING_KEYS } from "@/modules/watching/hooks/query-keys";
import type { ListType, MediaType } from "@/modules/watching/types";

const TYPE_LABEL: Record<MediaType, string> = { film: "Movie", serie: "TV Show", anime: "Anime" };

export default function DiscoverDetailPage() {
  const { type, tmdbId } = useParams<{ type: string; tmdbId: string }>();
  const router = useRouter();
  const userId = useCurrentUserId();

  const mediaType = (["film", "serie", "anime"].includes(type) ? type : "film") as MediaType;
  const id = Number(tmdbId) || 0;
  const isSeries = mediaType !== "film";

  const { data: media, isLoading } = useTmdbDetails(id, mediaType);
  const setPageLabel = useWatchingUIStore((s) => s.setPageLabel);

  const [trailerOpen, setTrailerOpen] = useState(false);
  // null = closed. The value IS the intent, so the modal opens already knowing what you meant.
  const [addContext, setAddContext] = useState<ListType | null>(null);
  /**
   * WHICH title the modal is about — null meaning "the one this page is about".
   *
   * More Like This was inert here while it added titles on the owned fiche: the same row, the same
   * cards, one of them silently decorative. A recommendation you cannot act on is just a picture.
   */
  const [addItem, setAddItem] = useState<any | null>(null);
  const openAdd = (ctx: ListType) => { setAddItem(null); setAddContext(ctx); };
  const closeAdd = () => { setAddContext(null); setAddItem(null); };

  // ── Already yours? Then this page is the wrong one: the real fiche has your history, your
  //    rating and every action. Send you there instead of showing a stranger's copy.
  const { data: ownedIds = [] } = useOwnedTmdbIds(userId ?? "", mediaType, !!userId);
  const { data: ownedRow, isLoading: ownedLoading } = useOwnedMediaId(userId ?? "", id, !!userId);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ownedRow) return;
    /**
     * ARRIVE WARM. Redirecting is only half the job — landing on a page that then shows its OWN
     * skeleton means you waited twice for one click, which is worse than the flash we removed.
     * The row is fetched here, in parallel with the navigation, so the fiche usually renders with
     * its data already in cache.
     *
     * (The ordinary path no longer comes through here at all: the search resolves ownership before
     * it routes. This is the deep-link case — a pasted URL, a link from elsewhere.)
     */
    void queryClient.prefetchQuery({
      queryKey: WATCHING_KEYS.detail(ownedRow.id),
      queryFn: () => getMediaItemById(ownedRow.id),
    });
    router.replace(`/perso/watching/${ownedRow.id}`);
  }, [ownedRow, router, queryClient]);

  useEffect(() => {
    if (!media) return;
    const section = media.type === "film" ? "Movies" : media.type === "serie" ? "TV Shows" : "Animes";
    setPageLabel({ section, title: media.title });
    return () => setPageLabel(null);
  }, [media, setPageLabel]);

  const { data: similar = [], isLoading: similarLoading } = useSimilarTitles(id, mediaType, !!media);
  const { data: credits, isLoading: creditsLoading } = useMediaCredits(id, mediaType, !!media);
  const { data: trailer, isLoading: trailerLoading } = useMediaTrailer(id, mediaType, !!media);
  // Free: it's another slice of the bundle this page already fetches, not a new request.
  const { data: providers } = useWatchProviders(id, mediaType, !!media);

  /**
   * A lumped anime has to be cut into cours HERE too. Without this, the same title told two
   * different stories: 38 flat episodes in one season on discover, then S1 E1-12 / S2 E13-24 the
   * moment you added it — the coordinates changed under a title that had not changed at all.
   * `shouldOverlay` is the rule that decides, the same one the add modal and the owned page ask;
   * a second opinion here is how this module got sick in the first place.
   */
  const { data: coursRow, isLoading: coursLoading } = useAnimeCours(id, mediaType === "anime");
  const cours = media && shouldOverlay(media, coursRow) ? coursRow.cours : undefined;

  // Same rule as the owned page: never recommend what you already have.
  const recommendations = useMemo(() => {
    const owned = new Set(ownedIds);
    return (similar as any[]).filter((s) => !owned.has(s.id)).slice(0, 6);
  }, [similar, ownedIds]);

  /**
   * "NOT YET KNOWN" IS NOT "NO" — the same confusion that made a card print a flat episode number
   * before its cours arrived (MediaView.pending).
   *
   * Possession is an async answer, and `ownedRow === undefined` was read as "you don't own it". So
   * a title already in your library painted the WHOLE guest page — hero, cast, three add buttons —
   * and only then bounced to your real fiche. The flash was the page announcing something false.
   *
   * So we wait while the question is open (`ownedLoading`), and we keep waiting once the answer is
   * yes (`ownedRow`): the redirect fires in an effect, i.e. after this render, and painting the
   * guest page for that one frame is the very flash we are removing. A disabled query (no user)
   * reports `isLoading: false`, so a logged-out visitor is never held here.
   */
  /**
   * THE SKELETON ANNOUNCES WHERE YOU WILL LAND, NOT WHERE YOU ARE.
   *
   * If the title turns out to be yours, this page is a doorway you pass through — so it draws the
   * OWNED fiche's shape, and the redirect lands on a layout that was already promised. Drawing the
   * guest shape here and then handing you a different page would replace the flash of wrong CONTENT
   * we removed with a flash of wrong LAYOUT, which is the same fault with better manners.
   *
   * While ownership is still unknown, the owned shape is the safe bet for the same reason: it is a
   * superset. Its extra panels can appear; a missing one cannot be un-drawn without a jump.
   *
   * `isSeries` comes from the ROUTE here, so both variants know their type from the first frame.
   */
  if (ownedLoading || ownedRow) return <DetailSkeleton isSeries={isSeries} />;
  // An anime waits for its cours as well. Painting the flat count first and correcting it a moment
  // later is the same fault the owned page closed with `view.pending`: "not resolved yet" is not
  // "no overlay". The skeleton holds until the coordinates are known.
  if (isLoading || (mediaType === "anime" && coursLoading)) return <DiscoverSkeleton isSeries={isSeries} />;
  if (!media) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-secondary">We couldn&apos;t find that title.</p>
        <Button variant="quiet" size="sm" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const cast = media.cast_members?.length ? media.cast_members : (credits?.cast ?? []);
  const directors = credits?.directors ?? [];

  // Same gesture as on the owned fiche, deliberately: a recommendation opens the add modal on
  // ITSELF, not on the title you're reading. Recommendations of a series are series.
  const handleAddSimilar = (sim: any) => {
    setAddItem({
      id: sim.id,
      title: sim.title ?? sim.name,
      name: sim.name ?? sim.title,
      poster_path: sim.poster_path,
      backdrop_path: sim.backdrop_path ?? null,
      vote_average: sim.vote_average ?? 0,
      overview: sim.overview ?? "",
      genre_ids: sim.genre_ids ?? [],
      media_type: mediaType === "film" ? "movie" : "tv",
      ...(mediaType === "film"
        ? { release_date: sim.release_date }
        : { first_air_date: sim.first_air_date }),
    });
    setAddContext("wantToWatch");
  };

  // This page's own title, in the shape the modal speaks (TMDB search result).
  const selfItem = {
    id: media.tmdb_id,
    media_type: (mediaType === "film" ? "movie" : "tv") as "movie" | "tv",
    title: media.title,
    original_title: media.original_title,
    // Hand it real paths — not null, which rendered an <img src=""> and made the browser
    // re-fetch the page.
    poster_path: tmdbPathFromUrl(media.poster_url),
    backdrop_path: tmdbPathFromUrl(media.backdrop_url),
    release_date: media.release_date ?? null,
    first_air_date: null,
    vote_average: media.rating,
    overview: media.description ?? "",
    genre_ids: [],
    origin_country: [],
  };

  // The actions replace the StatusCard's whole surface. Not ONE generic "add": by the time you
  // are on a title's page you already know what you mean by it — you want to see it later, you
  // are starting it now, or you saw it years ago. Each intent opens the add modal in its own
  // context, which is where the rating, the date and the position get collected.
  const addCard = (
    <Panel title="Not in your library">
      <div className="space-y-2.5 px-4 pb-1 sm:px-5">
        <p className="text-xs leading-relaxed text-text-tertiary">
          Add it to track where you are, rate it and keep it in your history.
        </p>
        <Button
          variant="accent"
          size="sm"
          style={WATCHING_ACCENT}
          className="w-full"
          onClick={() => openAdd("wantToWatch")}
        >
          <Plus />
          Want to watch
        </Button>
        {isSeries && (
          <Button variant="quiet" size="sm" className="w-full" onClick={() => openAdd("inProgress")}>
            <Play />
            Start watching
          </Button>
        )}
        <Button variant="quiet" size="sm" className="w-full" onClick={() => openAdd("recentlyWatched")}>
          <Check />
          Mark as watched
        </Button>
        {/* On a title you own, this is reference. Here it is part of the decision you came to make:
            "can I actually watch this?" belongs next to "do I want to". */}
        <WhereToWatch providers={providers} />
      </div>
    </Panel>
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

      {/* Mobile slot — the action leads, exactly where the StatusCard leads on the owned page. */}
      <div className="px-4 pt-4 lg:hidden">{addCard}</div>

      <div className="relative z-10 grid grid-cols-1 lg:-mt-6 lg:grid-cols-[2fr_1fr]">
        {/* ── LEFT — the work itself ── */}
        <div className="min-w-0 space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-8 lg:pr-2">
          {isSeries && (
            <Episodes media={media} currentSeason={1} readOnly cours={cours} />
          )}

          {/* Hold the rail's height while the faces are in flight, so More Like This doesn't get
              shoved down the page a beat after you started reading it. */}
          {creditsLoading ? (
            <CastCrewSkeleton />
          ) : (cast.length > 0 || directors.length > 0) ? (
            <CastCrew cast={cast} directors={directors} isSeries={isSeries} />
          ) : null}

          {recommendations.length > 0 && (
            <MoreLikeThis items={recommendations} loading={similarLoading} onAddClick={handleAddSimilar} />
          )}
        </div>

        {/* ── RIGHT — quiet utility rail ── */}
        <div className="min-w-0">
          <div className="space-y-5 px-4 py-6 lg:space-y-6 lg:py-8 lg:pl-2 lg:pr-8">
            <div className="hidden lg:block">{addCard}</div>

            <AnimeThemes media={media} />

            <MediaDetails media={media} typeLabel={TYPE_LABEL[mediaType]} isSeries={isSeries} />
          </div>
        </div>
      </div>

      <TrailerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        youtubeKey={trailer?.key}
        title={media.title}
      />

      {/* Adding THIS title sends you to the real page — the `ownedRow` effect above picks it up.
          Adding a recommendation just adds it; you stay where you are. */}
      <AddMediaModal
        isOpen={!!addContext}
        onClose={closeAdd}
        onAdded={closeAdd}
        defaultType={mediaType}
        listContext={addContext ?? "wantToWatch"}
        initialItem={addItem ?? selfItem}
      />
    </div>
  );
}
