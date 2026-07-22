"use client";

import { useQuery } from "@tanstack/react-query";
import { getRatingsForType } from "../service";
import { WATCHING_KEYS } from "./query-keys";
import type { MediaType } from "../types";

// Below this, a percentile is flattery, not information ("top 1% of your 4 films").
const MIN_SAMPLE = 20;

export interface RatingStanding {
  /**
   * Percentile among your other titles of this type, TIES COUNTED HALF.
   *
   * It used to count only ratings strictly lower, and that broke on the two cases that matter
   * most. Rate a film 5.5 when everything else is higher and it said "above 0% of your films" —
   * true, and useless. Worse: rate twenty films 8.0 and this one 8.0, and it ALSO said 0%, because
   * no rating was strictly lower — a mid-pack title reported as your worst. Splitting ties puts a
   * shared rating where it belongs, in the middle.
   */
  beats: number;
  /** Rank among your rated titles of this type (1 = your best). */
  rank: number;
  total: number;
  /** True when it sits in your top 10% — worth saying out loud. */
  elite: boolean;
  /** True in your bottom 10%: the sentence has to flip, "above N%" says nothing down there. */
  weak: boolean;
}

/**
 * Where this rating stands among YOUR ratings for the same type. Returns null when the
 * sample is too small to mean anything, so the UI simply says nothing rather than lying.
 */
export function useRatingStanding(
  userId: string | null,
  type: MediaType,
  rating: number,
): RatingStanding | null {
  const { data: ratings = [] } = useQuery({
    queryKey: WATCHING_KEYS.ratingsByType(userId ?? "", type),
    queryFn: () => getRatingsForType(userId!, type),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!rating || ratings.length < MIN_SAMPLE) return null;

  // Exclude this title's own rating once, so it isn't compared against itself.
  const others = [...ratings];
  const self = others.indexOf(rating);
  if (self >= 0) others.splice(self, 1);
  if (others.length < MIN_SAMPLE - 1) return null;

  const lower = others.filter((r) => r < rating).length;
  const equal = others.filter((r) => r === rating).length;
  const higher = others.filter((r) => r > rating).length;
  const beats = Math.round(((lower + equal / 2) / others.length) * 100);
  const total = others.length + 1;
  const rank = higher + 1;

  return {
    beats,
    rank,
    total,
    elite: rank / total <= 0.1,
    weak: rank / total >= 0.9,
  };
}
