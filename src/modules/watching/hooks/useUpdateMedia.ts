import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { updateMediaItem } from "../service";
import { syncWatchingGoals } from "../lib/sync-goals";
import { syncWatchingHabits } from "../lib/sync-habits";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "../lib/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import type { UpdateMediaInput } from "../schemas/media.schema";

const STATUS_FIELDS = ["watched", "in_progress", "want_to_watch", "is_reference", "recently_watched"] as const;

// Any field whose change can move a number on the Stats page (counts, hours,
// ratings, genres, top picks, activity). Notes are the only common edit that does
// NOT affect Stats, so we skip the stats refetch for a notes-only save.
const STATS_FIELDS = [
  "watched", "in_progress", "recently_watched", "want_to_watch", "is_reference",
  "user_rating", "favorite", "watched_at", "season_years", "season_ratings",
  "current_season", "current_episode",
] as const;

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (input: UpdateMediaInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      const { id, ...updates } = input;
      return updateMediaItem(id, updates);
    },

    onMutate: async (input) => {
      if (isDemo) return; // read-only demo: skip the optimistic update
      const { id, ...updates } = input;

      // Cancel only the detail query + list-items — avoid disrupting sections/ForYou
      await queryClient.cancelQueries({ queryKey: WATCHING_KEYS.detail(id) });
      await queryClient.cancelQueries({ queryKey: [...WATCHING_KEYS.all, "list-items"] });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshot = queryClient.getQueriesData<any>({ queryKey: WATCHING_KEYS.all });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueriesData<any>({ queryKey: WATCHING_KEYS.all }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return old.map((item: any) => item.id === id ? { ...item, ...updates } : item);
        }
        if (old?.id === id) return { ...old, ...updates };
        return old;
      });

      return { snapshot };
    },

    onError: (err, _input, context) => {
      if (handledDemoError(err)) return;
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Update failed. Please try again.");
    },

    onSuccess: (_, input) => {
      const { id } = input;
      const isStatusChange = STATUS_FIELDS.some((f) => input[f] != null);

      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "list-items"] });

      if (isStatusChange) {
        queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.movies() });
        queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.series() });
        queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.animes() });
        for (const type of ["film", "serie", "anime"] as const) {
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.inProgress(type) });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.recentlyWatched(type) });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.wantToWatch(type) });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.topRated(type) });
        }
        // Cross-module: a watched-status change can move a Goal's progress and
        // auto-tick a Watching-linked habit.
        void syncWatchingGoals(queryClient);
        void syncWatchingHabits(queryClient);
      }

      // A season/episode progress change must refresh the In Progress carousels so
      // their progress bar reflects the new position (status change already does).
      if (!isStatusChange && (input.current_season != null || input.current_episode != null)) {
        for (const type of ["film", "serie", "anime"] as const) {
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.inProgress(type) });
        }
      }

      // Stats reads ratings / season years / hours / favorites — refetch it whenever
      // any of those change (prefix-match invalidates the per-user stats key). Keeps
      // Stats honest after a rating or Watch-History edit, not only after the
      // optimistic patch. Notes-only saves are skipped.
      if (STATS_FIELDS.some((f) => input[f] != null)) {
        queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "stats"] });
      }
    },
  });
}
