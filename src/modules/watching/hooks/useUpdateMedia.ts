import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { updateMediaItem } from "../service";
import { syncWatchingGoals } from "../lib/sync-goals";
import { syncWatchingHabits } from "../lib/sync-habits";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { toColumns, updateMediaSchema, type UpdateMediaInput } from "../schemas/media.schema";

// A status change → the browse sections must refetch. `watched_at` counts too now: "Last Watched"
// is DERIVED from it (ordered by the date), so back-dating a title on its detail page must move it
// in the rail. There is no `recently_watched` flag here any more — the column is dead, the section
// reads the date directly.
const STATUS_FIELDS = ["watched", "in_progress", "want_to_watch", "is_reference", "dropped", "paused", "watched_at"] as const;

// Any field whose change can move a number on the Stats page (counts, hours, ratings, genres, top
// picks, activity). Notes are the only common edit that does NOT affect Stats.
const STATS_FIELDS = [
  "watched", "in_progress", "want_to_watch", "is_reference",
  "user_rating", "favorite", "watched_at", "season_years", "season_ratings",
  "current_season", "current_episode",
] as const;

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (rawInput: UpdateMediaInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      // The schema was a TYPE and nothing else — declared, never run, so its rules were suggestions.
      // Parsing it here turns it into a gate: an update that moves a position without recomputing
      // `caught_up_at` now fails loudly, at the door, instead of quietly poisoning a row.
      const input = updateMediaSchema.parse(rawInput);
      return updateMediaItem(input.id, toColumns(input));
    },

    onMutate: async (rawInput) => {
      if (isDemo) return; // read-only demo: skip the optimistic update
      const input = rawInput;
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
      const input = rawInput;
      const { id } = input;
      const isStatusChange = STATUS_FIELDS.some((f) => input[f] != null);

      // Only the type that actually moved. A caller that doesn't say falls back to all three —
      // correct, just wasteful, so nothing breaks while surfaces adopt it.
      const touched = input.type ? [input.type] : (["film", "serie", "anime"] as const);
      const sectionKey = { film: WATCHING_KEYS.movies, serie: WATCHING_KEYS.series, anime: WATCHING_KEYS.animes };

      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: [...WATCHING_KEYS.all, "list-items"] });

      /**
       * A RANK CHANGE IS NOT A STATUS CHANGE — but it REORDERS a rail, and that is a different
       * kind of staleness. The Top 10 is sorted by `priority` in the query; the optimistic patch
       * can only rewrite each row's number where it already sits, never move it. So swapping two
       * titles left the badges correct and the positions wrong until a full reload.
       * `priority` sits in neither STATUS_FIELDS nor the section invalidations, so it needs saying.
       */
      if (input.priority !== undefined) {
        for (const type of touched) {
          queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.topRated(type), refetchType: "all" });
        }
      }

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
