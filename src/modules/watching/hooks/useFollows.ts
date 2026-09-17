import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
import { toast } from "@/shared/utils/toast";
import { STALE } from "@/shared/lib/stale";
import { PEOPLE_KEYS } from "./query-keys";
import { followPerson, getFollowedIds, getFollows, getOwnedStatus, getPeopleRanking, getPersonUpcoming, syncPersonUpcoming, unfollowPerson } from "../service";
import { AWARD_KEYS } from "./query-keys";
import type { PersonFollowInput, RankingKind } from "../types";

/** Every people list on Library › People grows 50 at a time, each page a database call (owner). */
export const PEOPLE_PAGE = 50;

/** The library as a status index (7 columns) — enough for a tile to know it is yours. */
export function useOwnedStatus(userId: string | null) {
  return useQuery({
    queryKey: AWARD_KEYS.ownedStatus(),
    queryFn: () => getOwnedStatus(userId!),
    staleTime: STALE.TWO_MINUTES,
    gcTime: STALE.TWO_MINUTES,
    enabled: !!userId,
  });
}

/** The ids you follow — what a FollowMark needs, and nothing more. Small, read once. */
export function useFollowedIds(userId: string | null) {
  return useQuery({
    queryKey: PEOPLE_KEYS.followedIds(userId ?? ""),
    queryFn: () => getFollowedIds(userId!),
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!userId,
  });
}

const nextOffset = <T,>(last: T[], pages: T[][]) => (last.length === PEOPLE_PAGE ? pages.length * PEOPLE_PAGE : undefined);

/** The people you follow, newest first, 50 a page. */
export function useFollowsPages(userId: string | null) {
  return useInfiniteQuery({
    queryKey: PEOPLE_KEYS.follows(userId ?? ""),
    queryFn: ({ pageParam }) => getFollows(userId!, PEOPLE_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    staleTime: STALE.DAY,
    gcTime: STALE.DAY,
    enabled: !!userId,
  });
}

/** What is coming from the people you follow — the robot's table joined to your follows, 50 a page. */
export function useUpcomingPages(userId: string | null) {
  return useInfiniteQuery({
    queryKey: PEOPLE_KEYS.upcoming(userId ?? ""),
    queryFn: ({ pageParam }) => getPersonUpcoming(userId!, PEOPLE_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    staleTime: STALE.HALF_HOUR,
    gcTime: STALE.DAY,
    enabled: !!userId,
  });
}

/** Your most watched actors / voice actors / directors — ranked in SQL, 50 a page. */
export function usePeopleRanking(kind: RankingKind, enabled = true) {
  return useInfiniteQuery({
    queryKey: PEOPLE_KEYS.ranking(kind),
    queryFn: ({ pageParam }) => getPeopleRanking(kind, PEOPLE_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    staleTime: STALE.HALF_HOUR,
    gcTime: STALE.HALF_HOUR,
    enabled,
  });
}

/**
 * Follow / unfollow, optimistic on the ids: the « + » turns into the teal check on the click, not
 * on the round trip. The lists refetch once the write lands; a new follow also asks the robot for
 * that person's slate right away, then refreshes Upcoming.
 */
export function useFollowActions(userId: string | null) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const idsKey = PEOPLE_KEYS.followedIds(userId ?? "");
  return useMutation({
    mutationFn: async ({ person, undo }: { person: PersonFollowInput; undo?: boolean }) => {
      if (isDemo) throw new DemoReadOnlyError();
      if (!userId) throw new Error("Not signed in.");
      if (undo) await unfollowPerson(userId, person.person_tmdb_id);
      else await followPerson(userId, person);
    },
    onMutate: async ({ person, undo }) => {
      await queryClient.cancelQueries({ queryKey: idsKey });
      const previous = queryClient.getQueryData<number[]>(idsKey) ?? [];
      queryClient.setQueryData<number[]>(
        idsKey,
        undo ? previous.filter((id) => id !== person.person_tmdb_id) : [person.person_tmdb_id, ...previous.filter((id) => id !== person.person_tmdb_id)],
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(idsKey, ctx.previous);
      if (handledDemoError(err)) return;
      toast.error("Couldn't save that.");
    },
    onSuccess: async (_data, { person, undo }) => {
      void queryClient.invalidateQueries({ queryKey: PEOPLE_KEYS.follows(userId ?? "") });
      if (undo) { void queryClient.invalidateQueries({ queryKey: PEOPLE_KEYS.upcoming(userId ?? "") }); return; }
      try { await syncPersonUpcoming(person.person_tmdb_id); } catch { /* the weekly run will */ }
      void queryClient.invalidateQueries({ queryKey: PEOPLE_KEYS.upcoming(userId ?? "") });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: idsKey }),
  });
}
