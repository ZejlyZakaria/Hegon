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
import { useTitleBundle } from "@/modules/watching/hooks/useTitleBundle";
import { useAddMedia } from "@/modules/watching/hooks/useAddMedia";
import { buildMediaView } from "@/modules/watching/lib/media-view";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { toast } from "@/shared/utils/toast";
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
import { getMediaItemById, type TitleBundle } from "@/modules/watching/service";
import { WATCHING_KEYS } from "@/modules/watching/hooks/query-keys";
import type { ListType, MediaType } from "@/modules/watching/types";

const TYPE_LABEL: Record<MediaType, string> = { film: "Movie", serie: "TV Show", anime: "Anime" };

/** `useTitleBundle` re-derives on every render, so the identity `select` must be a module constant. */
const RAW_BUNDLE = (b: TitleBundle) => b;

/**
 * The far end of what has actually AIRED, in storage coordinates — the honest answer to
 * "mark as watched" on a series. Read from `season_aired`, never from `season_episodes`: the
 * announcement would claim episodes nobody has seen because they do not exist yet.
 * Returns null when nothing has aired, which `addStatusPatch` reads as "no claim".
 */
function lastAiredPosition(aired: number[] | null | undefined): { season: number; episode: number } | null {
  const list = aired ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i] ?? 0;
    if (n > 0) return { season: i + 1, episode: n };
  }
  return null;
}

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
  /**
   * The modal now serves ONE case: adding a RECOMMENDATION. This page's own title is added by the
   * buttons, directly, with nothing to ask — so the second piece of state that used to say "which
   * intent did you click" is gone, and with it the "self" fallback item. One state, one meaning:
   * non-null = a recommendation is waiting to be added.
   *
   * (A recommendation opens on ITSELF, not on the title you are reading — recommendations of a
   * series are series. It was inert here while it worked on the owned fiche: same row, same cards,
   * one of them silently decorative.)
   */
  const [addItem, setAddItem] = useState<any | null>(null);

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

  /**
   * ADDING, WITHOUT THE MODAL.
   *
   * `useAddMedia` wants the RAW TMDB record (its seasons are objects, `last_episode_to_air` lives on
   * it). We already have it: `useTmdbDetails` is a `select` over `useTitleBundle`, so subscribing to
   * the same key with an identity select costs zero requests — the bundle is already in cache.
   */
  const { data: raw } = useTitleBundle(id, mediaType, !!id, RAW_BUNDLE);
  const addMedia = useAddMedia();
  const [adding, setAdding] = useState<ListType | null>(null);

  /**
   * The lens for a title that is not yours yet — the same one the modal builds, for the same
   * reason: a lumped anime must stamp its year in `cour_years`, not in a `season_years` map the
   * Watch History never reads. Without it this door would speak the wrong coordinates.
   */
  const addView = useMemo(
    () =>
      buildMediaView(
        {
          type: mediaType,
          status: media?.status,
          caught_up_at: null,
          episodes: undefined,
          // eslint-disable-next-line no-restricted-syntax -- these ARE the lens's raw input: buildMediaView is what turns storage columns into display space, so it must be handed the columns.
          season_episodes: media?.season_episodes ?? null,
          // eslint-disable-next-line no-restricted-syntax -- same: the lens is being built here, it cannot consume its own output.
          season_aired: media?.season_aired ?? null,
          season_posters: null,
          season_end_dates: null,
          current_season: undefined,
          current_episode: undefined,
          season_years: null,
          season_ratings: null,
          cour_years: null,
          cour_ratings: null,
        },
        coursRow,
      ),
    // eslint-disable-next-line no-restricted-syntax -- dependency list of the lens itself; see above.
    [mediaType, media?.status, media?.season_episodes, media?.season_aired, coursRow],
  );

  /**
   * Each button carries its own answer, so nothing is asked:
   *   · want to watch  → no position at all; it is a plan, not a claim.
   *   · start watching → S1E1. "Start" means start; the StatusCard is where you say otherwise.
   *   · watched/caught up → the far end of what aired. `addStatusPatch` then DERIVES the status
   *     from that position, so a running series lands caught-up and a finished one lands watched.
   *     Nothing here asserts either word.
   */
  const runAdd = async (target: ListType) => {
    if (!raw || !media || adding) return;
    setAdding(target);
    try {
      const position =
        target === "inProgress"
          ? { season: 1, episode: 1 }
          : target === "recentlyWatched" && isSeries
            // eslint-disable-next-line no-restricted-syntax -- deliberately STORAGE space: `position` is documented as already being in storage units, and the lens (`view`) converts the year stamp, not this.
            ? lastAiredPosition(media.season_aired)
            : null;

      const row = await addMedia.mutateAsync({
        selectedItem: raw,
        defaultType: mediaType,
        listContext: target,
        userRating: 0,
        notes: "",
        favorite: false,
        priority: null,
        priorityLevel: "medium",
        seasons: media.seasons ?? null,
        episodes: media.episodes ?? null,
        runtime: media.runtime,
        directors: credits?.directors ?? null,
        cast: credits?.cast ?? [],
        studio: media.studio ?? null,
        status: media.status ?? null,
        genres: media.tags ?? [],
        position,
        stance: "watching",
        view: addView,
      });

      /**
       * GO WITH THE ID WE WERE JUST HANDED.
       *
       * The mutation returns the row it created. Waiting for `useOwnedMediaId` to rediscover it
       * over the network cost ~1.6s of measured nothing — the app throwing away what it already
       * knew. The detail query is seeded from the same object, so the fiche paints from cache.
       */
      if (row?.id) {
        queryClient.setQueryData(WATCHING_KEYS.detail(row.id), row);
        router.replace(`/perso/watching/${row.id}`);
      }
    } catch (err) {
      if (!isDemoReadOnlyError(err)) toast.error("Could not add this title.");
      setAdding(null);
    }
  };

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
   * While ownership is still UNKNOWN, though, the bet goes the other way — and this used to be
   * wrong. The old note argued the owned shape was safe because it is a superset: extra panels can
   * appear, a missing one cannot be un-drawn. True going from unknown to OWNED; backwards for this
   * route, where the ordinary case is that the title is NOT yours — that is why you are here at
   * all. So it bet on the rare shape and then had to shed panels: measured on an unowned film, the
   * right column went 619px → 879px, a 260px jump, every single time.
   *
   * Unknown now draws the GUEST shape, which is what the answer almost always turns out to be. The
   * rare deep-link to something you own still gets the owned shape the moment we know, and it is
   * about to be replaced by a redirect anyway.
   *
   * `isSeries` comes from the ROUTE here, so both variants know their type from the first frame.
   */
  if (ownedRow) return <DetailSkeleton isSeries={isSeries} />;
  // An anime waits for its cours as well. Painting the flat count first and correcting it a moment
  // later is the same fault the owned page closed with `view.pending`: "not resolved yet" is not
  // "no overlay". The skeleton holds until the coordinates are known.
  if (ownedLoading || isLoading || (mediaType === "anime" && coursLoading))
    return <DiscoverSkeleton isSeries={isSeries} isAnime={mediaType === "anime"} />;
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
  };

  /**
   * THE ACTIONS RUN HERE — no modal.
   *
   * The modal exists to answer questions. On this page there are none left: you are looking at one
   * specific title, and each button already states the intent. "Want to watch" has nothing to ask —
   * priority defaults to medium, which wears no mark and can be raised from the fiche. "Start
   * watching" means START, so S1E1; the StatusCard is where you say otherwise, and it is better at
   * it than a modal ever was. "Mark as watched" carries its own answer too — the far end of what
   * has aired — and the rating and the note belong to the fiche you are about to land on.
   *
   * A dialog that asks nothing is a dialog too many, on the most common gesture in the module.
   */
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
          disabled={adding !== null}
          onClick={() => runAdd("wantToWatch")}
        >
          <Plus />
          Want to watch
        </Button>
        {isSeries && (
          <Button variant="quiet" size="sm" className="w-full" disabled={adding !== null} onClick={() => runAdd("inProgress")}>
            <Play />
            Start watching
          </Button>
        )}
        {/* THE LABEL FOLLOWS THE FACT. On a running series you cannot have finished it — you can
            only be up to date, and that is what gets written. Calling it "watched" here would be
            the very sentence this module spent weeks removing. */}
        <Button variant="quiet" size="sm" className="w-full" disabled={adding !== null} onClick={() => runAdd("recentlyWatched")}>
          <Check />
          {isSeries && media.status !== "ended" ? "I'm caught up" : "Mark as watched"}
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
        isOpen={!!addItem}
        onClose={() => setAddItem(null)}
        onAdded={() => setAddItem(null)}
        defaultType={mediaType}
        listContext="wantToWatch"
        initialItem={addItem}
      />
    </div>
  );
}
