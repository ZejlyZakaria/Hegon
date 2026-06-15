import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as GoalService from "../service";
import { REVIEW_KEYS, GOAL_KEYS } from "./query-keys";
import { JOURNAL_KEYS } from "@/modules/journal/hooks/query-keys";
import { toast } from "@/shared/utils/toast";
import type { CreateReviewInput } from "../types";

export function useReviews() {
  return useQuery({
    queryKey: REVIEW_KEYS.list(),
    queryFn:  () => GoalService.getReviews(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLastReview() {
  return useQuery({
    queryKey: REVIEW_KEYS.last(),
    queryFn:  () => GoalService.getLastReview(),
    staleTime: 1000 * 60 * 5,
  });
}

// The pre-computed "what moved" mirror — only fetched while the modal is open.
export function useReviewDraft(enabled: boolean) {
  return useQuery({
    queryKey: REVIEW_KEYS.draft(),
    queryFn:  () => GoalService.getReviewDraft(),
    enabled,
    staleTime: 0,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => GoalService.createReview(input),
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: REVIEW_KEYS.all });
      // The mirror copy may have created/updated today's journal entry — refetch
      // the whole journal tree (list keys are opts-scoped, so invalidate the root).
      if (review.journal_entry_id) {
        queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.all });
      }
      // Keep the goals list fresh (the review is a natural checkpoint to refetch).
      queryClient.invalidateQueries({ queryKey: GOAL_KEYS.lists() });
      toast.success("Review saved.");
    },
    onError: () => {
      toast.error("Failed to save review.");
    },
  });
}
