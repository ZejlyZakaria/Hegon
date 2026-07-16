"use client";

import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { MediaCarousel } from "@/modules/watching/components/shared/MediaCarousel";
import { CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { useMovies } from "@/modules/watching/hooks/useMovies";
import { useDeleteMedia } from "@/modules/watching/hooks/useDeleteMedia";
import { isAwaitingRelease } from "@/modules/watching/utils";
import type { WatchingConfig } from "@/modules/watching/types";

interface Props {
  userId: string;
  config: WatchingConfig;
}

/**
 * "Waiting for" — the films on your watchlist that aren't out yet.
 *
 * It's not a list you fill and it has no move-on-release trigger: it's a DERIVED slice of your
 * watchlist (`isAwaitingRelease`). A film sits here because its release date is in the future; the
 * day it comes out it crosses the line and rejoins plain "Want to Watch" on its own — the same
 * "state is a calculation, not a stored flag" rule as Last Watched. It reads the SAME cached
 * `wantToWatch` query the watchlist rail uses (no extra fetch); the two just split it.
 *
 * Films only — a series' "not aired yet" is a different model (announced seasons). Hidden entirely
 * when nothing is waiting.
 */
export default function WaitingForSectionClient({ userId, config }: Props) {
  const { data: items = [], isLoading } = useMovies({ userId, wantToWatch: true, limit: 50 });
  const deleteMediaMutation = useDeleteMedia();

  if (config.type !== "film") return null;
  if (isLoading) return <CarouselSkeleton />;

  const waiting = items
    .filter(isAwaitingRelease)
    // Soonest release first; a legacy row with no stored date (awaiting via status) sinks to the end.
    .sort((a, b) => {
      if (!a.release_date) return 1;
      if (!b.release_date) return -1;
      return a.release_date.localeCompare(b.release_date);
    });

  // Nothing coming? Don't show an empty rail — the section only exists when there's anticipation.
  if (waiting.length === 0) return null;

  const handleDelete = async (itemId: string) => {
    try {
      await deleteMediaMutation.mutateAsync(itemId);
      toast.success("Removed from watchlist.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Error occurred while deleting.");
    }
  };

  return (
    <MediaCarousel
      title="Waiting for"
      subtitle={`Coming soon — ${waiting.length}`}
      items={waiting}
      onDelete={handleDelete}
      showCountdown
    />
  );
}
