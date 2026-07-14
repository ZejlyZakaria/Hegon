import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { updateMediaItem } from "../service";
import { syncWatchingGoals } from "../lib/sync-goals";
import { syncWatchingHabits } from "../lib/sync-habits";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { toColumns, updateMediaSchema, type UpdateMediaInput } from "../schemas/media.schema";

const STATUS_FIELDS = ["watched", "in_progress", "want_to_watch", "is_reference", "recently_watched", "dropped", "paused"] as const;

// Any field whose change can move a number on the Stats page (counts, hours,
// ratings, genres, top picks, activity). Notes are the only common edit that does
// NOT affect Stats, so we skip the stats refetch for a notes-only save.
const STATS_FIELDS = [
  "watched", "in_progress", "recently_watched", "want_to_watch", "is_reference",
  "user_rating", "favorite", "watched_at", "season_years", "season_ratings",
  "current_season", "current_episode",
] as const;

// "Recently Watched" must follow the watch DATE, not a sticky flag. Whenever an
// update sets `watched_at` (e.g. back-dating from the detail page), recompute
// `recently_watched` from it — same 30-day window as the add flow's recency. This
// also makes it a status change → the Recently Watched query re-fetches, so a
// back-dated item correctly leaves the section. (Skip if the caller set the flag
// explicitly.)
const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

function withRecency(input: UpdateMediaInput): UpdateMediaInput {
  if (!("watched_at" in input) || "recently_watched" in input) return input;
  const wa = input.watched_at;
  const recent = !!wa && new Date(wa).getTime() >= Date.now() - RECENT_MS;
  return { ...input, recently_watched: recent };
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (rawInput: UpdateMediaInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      // The schema was a TYPE and nothing else — declared, never run, so its rules were suggestions.
      // Parsing it here turns it into a gate: an update that moves a position without recomputing
      // `caught_up_at` now fails loudly, at the door, instead of quietly poisoning a row.
      const input = withRecency(updateMediaSchema.parse(rawInput));
      return updateMediaItem(input.id, toColumns(input));
    },

    onMutate: async (rawInput) => {
      if (isDemo) return; // read-only demo: skip the optimistic update
      const input = withRecency(rawInput);
      const { id } = input;
      const updates = toColumns(input);

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

      // Optimistically remove the item from a section it's leaving (e.g. drop/pause →
      // out of In Progress instantly, instead of waiting for the refetch). Removal-only
      // (a status turned false) — the section snapshot restores it on error.
      const leaves = (flag: "in_progress" | "want_to_watch", keyFor: (t: "film" | "serie" | "anime") => readonly unknown[]) => {
        if ((updates as Record<string, unknown>)[flag] !== false) return;
        for (const t of ["film", "serie", "anime"] as const) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          queryClient.setQueryData(keyFor(t), (old: any) =>
            Array.isArray(old) ? old.filter((i: { id: string }) => i.id !== id) : old);
        }
      };
      leaves("in_progress", WATCHING_KEYS.inProgress);
      leaves("want_to_watch", WATCHING_KEYS.wantToWatch);

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

    onSuccess: (_, rawInput) => {
      const input = withRecency(rawInput);
      const { id } = input;
      const isStatusChange = STATUS_FIELDS.some((f) => input[f] != null);

      // Only the type that actually moved. A caller that doesn't say falls back to all three —
      // correct, just wasteful, so nothing breaks while surfaces adopt it.
      const touched = input.type ? [input.type] : (["film", "serie", "anime"] as const);
      const sectionKey = { film: WATCHING_KEYS.movies, serie: WATCHING_KEYS.series, anime: WATCHING_KEYS.animes };

      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "list-items"] });

      if (isStatusChange) {
        for (const type of touched) {
          // refetchType "all" so the main-page section carousels refetch even while
          // INACTIVE (e.g. you marked watched from the detail route → the movies page
          // is unmounted). Without it they'd only refetch on remount, but Next's Router
          // Cache (staleTimes) restores the page from cache on Back → stale sections.
          queryClient.invalidateQueries({ queryKey: sectionKey[type](), refetchType: "all" });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.inProgress(type), refetchType: "all" });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.recentlyWatched(type), refetchType: "all" });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.wantToWatch(type), refetchType: "all" });
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.topRated(type), refetchType: "all" });
        }
        // Library shows watched/in-progress/paused/dropped with a status badge, so a
        // status change must refresh it live too (it can be unmounted → refetch "all",
        // and Next's Router Cache restores it stale on Back without this). Prefix-match
        // hits library(userId). One list, all types → never scoped.
        queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "library"], refetchType: "all" });
        // Cross-module: a watched-status change can move a Goal's progress and
        // auto-tick a Watching-linked habit.
        void syncWatchingGoals(queryClient);
        void syncWatchingHabits(queryClient);
      }

      // A season/episode progress change must refresh the In Progress carousels so
      // their progress bar reflects the new position (status change already does).
      if (!isStatusChange && (input.current_season != null || input.current_episode != null)) {
        for (const type of touched) {
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
