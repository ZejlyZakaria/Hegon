/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS, TMDB_KEYS } from "./query-keys";
import {
  getExistingMediaItem,
  insertMediaItem,
  updateMediaItem,
} from "../service";
import { createClient } from "@/infrastructure/supabase/client";
import { syncWatchingGoals } from "../lib/sync-goals";
import { syncWatchingHabits } from "../lib/sync-habits";
import { toast } from "@/shared/utils/toast";
import { resolveTransition } from "../lib/resolve-transition";
import { RESET_STATUS } from "../lib/status-flags";
import { airedFromTmdb } from "../lib/series-state";
import { addStatusPatch, claimedStatus } from "../lib/watch-status";
import { insertMediaSchema, toColumns, updateMediaSchema } from "../schemas/media.schema";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import type { ListType, MediaType } from "../types";

interface AddMediaInput {
  selectedItem: any; // TMDB result
  defaultType: MediaType;
  listContext: ListType;
  userRating: number;
  notes: string;
  favorite: boolean;
  priority: number | null;
  priorityLevel: "high" | "medium" | "low";
  seasons: number | null;
  episodes: number | null;
  runtime: number | null;
  directors: { id?: number; name: string; profile_url: string | null }[] | null;
  cast: { id: number; name: string; character: string | null; profile_url: string | null }[];
  studio: string | null;
  status: string | null;
  customPosterUrl?: string | null;
  genres: string[];
  watchedAt?: string | null;
  /**
   * HOW FAR YOU GOT — for a series, the ONLY honest input. `null` = "not started".
   * The list you came from no longer decides your status; this does. See below.
   */
  position?: { season: number; episode: number } | null;
  /** What happened after you stopped partway: still watching, paused, or done with it. */
  stance?: "watching" | "paused" | "dropped";
}

export function useAddMedia() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: async (input: AddMediaInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const {
        selectedItem,
        defaultType,
        listContext,
        userRating,
        notes,
        favorite,
        priority,
        priorityLevel,
        seasons,
        episodes,
        runtime,
        directors,
        cast,
        studio,
        status,
        customPosterUrl,
        genres,
        watchedAt,
        position,
        stance,
      } = input;

      const isSeries = defaultType === "serie" || defaultType === "anime";

      // ── THE GUARD ────────────────────────────────────────────────────────────────────────
      // `watched` used to be decided by the DOOR you came through:
      //     watched: listContext === "recentlyWatched" || "topTen" || "library"
      // Three doors that simply ASSERTED you'd finished the thing. For a film that's fine — "seen
      // it / haven't" is binary. For a SERIES it's a lie, and it is the line that manufactured 23
      // rows claiming you'd watched shows that are still running. Adding an ongoing series to your
      // Top 10 marked it finished, silently.
      //
      // Now the status is DERIVED from how far you got, by the same seriesState() the whole app
      // uses. The word "watched" doesn't get refused for an ongoing series — it simply cannot be
      // produced. No future door can re-open this, because there's nothing left to re-open.
      const tmdbSeasons = (selectedItem.seasons ?? []).filter((s: any) => s.season_number > 0);
      const seasonAiredList = isSeries
        ? airedFromTmdb(
            tmdbSeasons as { season_number: number; episode_count: number }[],
            selectedItem.last_episode_to_air as { season_number: number; episode_number: number } | undefined,
          )
        : null;
      // ANNOUNCED, not aired. These two were the same array here — a copy-paste that quietly told
      // every rule downstream that a season still coming out had already finished.
      const seasonEpisodesList: number[] | null = isSeries
        ? tmdbSeasons.map((s: any) => (s.episode_count ?? 0) as number)
        : null;

      // The world's facts about this title — what aired, and whether it is over. A claim is
      // answered by these and by your position; the row's own flags have no say.
      const worldFacts = {
        season_aired: seasonAiredList,
        season_episodes: seasonEpisodesList,
        status,
      };
      // A BRAND-NEW row has never been caught up — but an EXISTING one may have been, and that
      // stamp records WHEN YOU GOT THERE, not when you last looked. The update branches below
      // therefore keep the row's own value; only a fresh add starts from null.
      const claimFacts = { ...worldFacts, caught_up_at: null };

      // THE WHOLE STATUS, DERIVED, IN ONE CALL. This hook used to assemble it one boolean at a
      // time from the DOOR you came through — and for a series that is the lie the model exists to
      // kill. Worse, it did so via a `claimedStatus` that answers `null` to "you claimed nothing":
      // the In Progress door never collected a position, so every flag fell to false and the row
      // landed in LIMBO — in your library, in no rail, reading "Want to Watch" on its own page.
      const claim = addStatusPatch(
        listContext,
        { position: position ?? null, stance, facts: claimFacts, watchedAt },
        defaultType,
      );
      if (!claim) {
        // The door needs a claim and the UI failed to collect one. Refusing is the only honest
        // answer: we will not invent a status, and the barrier below would refuse it anyway.
        const err = new Error("Tell us how far you got before adding this one.");
        err.name = "TransitionError";
        throw err;
      }
      const { season_years: seasonYears, ...statusColumns } = claim;

      const posterUrl =
        customPosterUrl ||
        (selectedItem.poster_path
          ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`
          : null);

      const insertData = {
        user_id: userId,
        type: defaultType,
        // THE STATUS, WHOLE, FROM ONE PLACE. Every flag, the position, `caught_up_at`, `watched_at`
        // and `is_reference` are stated here — none is left to a default, because re-adding a
        // title MERGES onto its existing row and an omitted flag is not a cleared one.
        ...statusColumns,
        ...(seasonYears ? { season_years: seasonYears } : {}),
        title: selectedItem.title || selectedItem.name,
        original_title: selectedItem.original_title || selectedItem.original_name,
        description: selectedItem.overview,
        poster_url: posterUrl,
        backdrop_url: selectedItem.backdrop_path
          ? `https://image.tmdb.org/t/p/original${selectedItem.backdrop_path}`
          : null,
        year:
          new Date(
            selectedItem.release_date || selectedItem.first_air_date,
          ).getFullYear() || null,
        // FILM release date → the "Waiting for" rail derives from it (future = not out yet). One
        // source of truth: TMDB's own release_date, the same value shown on the detail page.
        release_date: defaultType === "film" ? (selectedItem.release_date || null) : null,
        runtime,
        rating: selectedItem.vote_average,
        user_rating:
          listContext === "wantToWatch" || listContext === "inProgress"
            ? null
            : userRating > 0
              ? userRating
              : null,
        season_aired: seasonAiredList,
        // Ranking and rating are NOT status: you may love a show you are three seasons into.
        favorite: listContext === "topTen" ? true : favorite,
        priority: listContext === "topTen" ? priority : null,
        priority_level: listContext === "wantToWatch" ? priorityLevel : null,
        seasons:
          defaultType === "serie" || defaultType === "anime" ? seasons : null,
        season_episodes:
          (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
            ? selectedItem.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => s.episode_count as number)
            : null,
        // [] (not null) for non-series — these columns are NOT NULL DEFAULT '[]'.
        season_posters:
          (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
            ? selectedItem.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => (s.poster_path ?? null) as string | null)
            : [],
        season_air_dates:
          (defaultType === "serie" || defaultType === "anime") && Array.isArray(selectedItem.seasons)
            ? selectedItem.seasons
                .filter((s: any) => s.season_number > 0)
                .map((s: any) => (s.air_date ?? null) as string | null)
            : [],
        episodes:
          defaultType === "serie" || defaultType === "anime" ? episodes : null,
        tmdb_id: selectedItem.id,
        tags: genres,
        notes,
        directors: directors || null,
        cast_members: cast ?? [],
        studio: studio || null,
        status: status || null,
      };

      const existing = await getExistingMediaItem(userId, defaultType, selectedItem.id);

      // Single source of truth for what's allowed and which write branch to run (shared with
      // AddMediaModal's conflict banner). It gets the world's facts too — the UI can be bypassed,
      // the write cannot: an ongoing series never enters Recently Watched, whoever asks.
      const releaseYear = new Date(selectedItem.release_date || selectedItem.first_air_date).getFullYear() || null;
      const transition = resolveTransition(existing, listContext, {
        type: defaultType,
        status,
        year: releaseYear,
        release_date: defaultType === "film" ? (selectedItem.release_date ?? null) : null,
      });
      if (!transition.allowed) {
        const err = new Error(transition.message ?? "Transition not allowed.");
        err.name = "TransitionError";
        throw err;
      }

      // The world's season facts, refreshed from the TMDB payload this door just read. Undefined
      // for a film — an update must not blank columns it has nothing to say about.
      const seasonMeta = isSeries && Array.isArray(selectedItem.seasons)
        ? {
            season_episodes: seasonEpisodesList ?? undefined,
            season_posters: selectedItem.seasons
              .filter((s: any) => s.season_number > 0)
              .map((s: any) => (s.poster_path ?? null) as string | null),
            season_air_dates: selectedItem.seasons
              .filter((s: any) => s.season_number > 0)
              .map((s: any) => (s.air_date ?? null) as string | null),
          }
        : {};

      // THE UPDATE BRANCHES GO THROUGH THE BARRIER TOO. They called `updateMediaItem` directly —
      // the one gate in the module, walked around by three of its own callers. `update:inProgress`
      // wrote a POSITION without recomputing `caught_up_at`: precisely the write the gate exists to
      // refuse, performed by the hook that documents it.
      const guarded = (patch: Record<string, unknown>) =>
        updateMediaItem(existing!.id, toColumns(updateMediaSchema.parse({ id: existing!.id, type: defaultType, ...patch })));

      switch (transition.action) {
        /**
         * in_progress onto a row you already own.
         *
         * "Same gesture, opposite result depending on whether you already owned the row": the fresh
         * insert derived nothing and landed in limbo, while this branch forced `in_progress: true`
         * regardless of where you said you were — so typing the last episode of a finished show
         * into this door left it "watching" forever. One derivation now answers both.
         */
        case "update:inProgress": {
          const claimed = isSeries
            ? claimedStatus({ ...existing!, ...worldFacts, type: defaultType }, position ?? null, stance)
            : { in_progress: true, watched: false, ...RESET_STATUS };
          if (!claimed) {
            const err = new Error("Tell us how far you got before adding this one.");
            err.name = "TransitionError";
            throw err;
          }
          return guarded({
            ...claimed,
            ...seasonMeta,
            season_aired: seasonAiredList ?? undefined,
            want_to_watch: false,
            is_reference: false,
            priority: existing!.priority,
          });
        }

        /**
         * topTen — RANKING IS NOT WATCHING.
         *
         * This branch wrote `watched: true`, unconditionally, forever. So putting House of the
         * Dragon in your Top 10 declared a running show FINISHED — the fourth door, wide open,
         * underneath a comment claiming the doors were shut. A Top 10 is a favourite and a rank;
         * loving something is not having seen the end of it.
         *
         * The rank is written. The STATUS only moves if you claimed a position (the modal asks) —
         * and then it is derived, by the same function every other door uses. Claim nothing, change
         * nothing: an existing In Progress stays exactly as it was.
         */
        case "update:topTen": {
          const claimed = isSeries
            ? claimedStatus({ ...existing!, ...worldFacts, type: defaultType }, position ?? null, stance)
            : { watched: true, watched_at: existing!.watched_at ?? new Date().toISOString(), ...RESET_STATUS, in_progress: false };

          return guarded({
            ...(claimed ?? {}),
            season_aired: seasonAiredList ?? undefined,
            ...(seasonYears ? { season_years: seasonYears } : {}),
            favorite: true,
            priority,
            user_rating: userRating > 0 ? userRating : null,
            rating: selectedItem.vote_average,
            want_to_watch: false,
            // Claiming nothing leaves the status alone — but a bare list stub is not a status you
            // keep: you have just ranked this title, so it is yours.
            is_reference: false,
          });
        }

        // recentlyWatched, library, wantToWatch onto an existing entry. The row is rebuilt whole,
        // so the INSERT barrier is the right shape — and the same three invariants apply.
        case "update:merge": {
          const updateData: Record<string, unknown> = { ...insertData };
          if (existing!.priority != null) {
            updateData.priority = existing!.priority;
            updateData.favorite = true;
          }
          insertMediaSchema.parse(updateData);
          return updateMediaItem(existing!.id, updateData);
        }

        // no existing entry → fresh insert
        default:
          return insertMediaItem(insertData);
      }
    },
    onSuccess: (_, variables) => {
      // refetchType "all" so sections refetch even while inactive — adding from the
      // detail route (e.g. "More Like This") must leave the main-page carousels fresh
      // on Back (Next's Router Cache would otherwise restore them stale).
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all, refetchType: "all" });

      // Remove only the added item from For You cache — refetch only when running low
      const forYouKey = TMDB_KEYS.forYou(variables.defaultType);
      const current = queryClient.getQueryData<{ id: number }[]>(forYouKey) ?? [];
      const updated = current.filter((item) => item.id !== variables.selectedItem.id);
      queryClient.setQueryData(forYouKey, updated);
      if (updated.length < 3) {
        queryClient.invalidateQueries({ queryKey: forYouKey });
      }

      // Cross-module: adding a watched title can move a Goal's progress and
      // auto-tick a Watching-linked habit.
      void syncWatchingGoals(queryClient);
      void syncWatchingHabits(queryClient);
    },
    onError: (error: Error) => {
      if (handledDemoError(error)) return;
      const msg = error.name === "TransitionError"
        ? error.message
        : "Couldn't add this media. Please try again.";
      toast.error(msg);
    },
  });
}
