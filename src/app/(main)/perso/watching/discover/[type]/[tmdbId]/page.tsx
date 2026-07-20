/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * A title you do NOT own — the same page, minus you.
 *
 * The owned detail page is really "a tmdb_id + your row": the hero, the genres, the cast, the
 * episodes and the recommendations all derive from the tmdb_id alone. So this route mounts those
 * very components against a VIRTUAL row (`getTmdbDetails`), and simply does not mount the ones
 * that describe YOU — My Take, Quick Stats, Watch History, the StatusCard. There is no history to
 * show on something you have never watched, and a panel that renders empty is worse than absent.
 *
 * It is a SEPARATE route on purpose. The owned page is the module's most worked-on surface; making
 * it also serve a guest case would have meant threading "do I own this?" through every branch of a
 * 486-line component. A second, smaller page that reuses the same parts is the cheaper truth.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Play, Plus } from "lucide-react";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { Button } from "@/shared/components/ui/button";
import { Panel } from "@/shared/components/ui/panel";
import { useTmdbDetails } from "@/modules/watching/hooks/useTmdbDetails";
import { useSimilarTitles } from "@/modules/watching/hooks/useSimilarTitles";
import { useMediaCredits } from "@/modules/watching/hooks/useMediaCredits";
import { useMediaTrailer } from "@/modules/watching/hooks/useMediaTrailer";
import { useOwnedTmdbIds, useOwnedMediaId } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useWatchingUIStore } from "@/modules/watching/hooks/useWatchingUIStore";
import { MediaHero } from "@/modules/watching/components/detail/MediaHero";
import { MediaDetails } from "@/modules/watching/components/detail/MediaDetails";
import { CastCrew } from "@/modules/watching/components/detail/CastCrew";
import { MoreLikeThis } from "@/modules/watching/components/detail/MoreLikeThis";
import { Episodes } from "@/modules/watching/components/detail/Episodes";
import { AnimeThemes } from "@/modules/watching/components/detail/AnimeThemes";
import { TrailerModal } from "@/modules/watching/components/detail/TrailerModal";
import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import { DetailSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { WATCHING_ACCENT } from "@/modules/watching/ui";
import { tmdbPathFromUrl } from "@/modules/watching/service";
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
  const openAdd = (ctx: ListType) => setAddContext(ctx);

  // ── Already yours? Then this page is the wrong one: the real fiche has your history, your
  //    rating and every action. Send you there instead of showing a stranger's copy.
  const { data: ownedIds = [] } = useOwnedTmdbIds(userId ?? "", mediaType, !!userId);
  const { data: ownedRow } = useOwnedMediaId(userId ?? "", id, !!userId);
  useEffect(() => {
    if (ownedRow) router.replace(`/perso/watching/${ownedRow.id}`);
  }, [ownedRow, router]);

  useEffect(() => {
    if (!media) return;
    const section = media.type === "film" ? "Movies" : media.type === "serie" ? "TV Shows" : "Animes";
    setPageLabel({ section, title: media.title });
    return () => setPageLabel(null);
  }, [media, setPageLabel]);

  const { data: similar = [] } = useSimilarTitles(id, mediaType, !!media);
  const { data: credits } = useMediaCredits(id, mediaType, !!media);
  const { data: trailer, isLoading: trailerLoading } = useMediaTrailer(id, mediaType, !!media);

  // Same rule as the owned page: never recommend what you already have.
  const recommendations = useMemo(() => {
    const owned = new Set(ownedIds);
    return (similar as any[]).filter((s) => !owned.has(s.id)).slice(0, 6);
  }, [similar, ownedIds]);

  if (isLoading) return <DetailSkeleton />;
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
            <Episodes media={media} currentSeason={1} readOnly />
          )}

          {(cast.length > 0 || directors.length > 0) && (
            <CastCrew cast={cast} directors={directors} isSeries={isSeries} />
          )}

          {recommendations.length > 0 && <MoreLikeThis items={recommendations} />}
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

      {/* Adding sends you to the real page — the `ownedRowId` effect above picks it up. */}
      <AddMediaModal
        isOpen={!!addContext}
        onClose={() => setAddContext(null)}
        onAdded={() => setAddContext(null)}
        defaultType={mediaType}
        listContext={addContext ?? "wantToWatch"}
        initialItem={{
          id: media.tmdb_id,
          media_type: mediaType === "film" ? "movie" : "tv",
          title: media.title,
          original_title: media.original_title,
          // The modal speaks TMDB's shape, so hand it real paths — not null, which rendered an
          // <img src=""> and made the browser re-fetch the page.
          poster_path: tmdbPathFromUrl(media.poster_url),
          backdrop_path: tmdbPathFromUrl(media.backdrop_url),
          release_date: media.release_date ?? null,
          first_air_date: null,
          vote_average: media.rating,
          overview: media.description ?? "",
          genre_ids: [],
          origin_country: [],
        }}
      />
    </div>
  );
}
