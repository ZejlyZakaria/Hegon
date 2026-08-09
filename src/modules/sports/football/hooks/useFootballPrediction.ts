import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFootballPrediction, upsertFootballPrediction, getUserPredictions } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

export function useFootballPrediction(userId: string, externalId: number) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.prediction(externalId),
    queryFn: () => getFootballPrediction(userId, externalId),
    enabled: !!userId && Number.isFinite(externalId) && externalId > 0,
  });
}

// All the user's predictions as a map by match — the Upcoming cards read this to show "your pick".
export function useUserPredictions(userId: string | null) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.userPredictions(),
    queryFn: () => getUserPredictions(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
}

export function useUpsertFootballPrediction(userId: string, externalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ home, away }: { home: number; away: number }) =>
      upsertFootballPrediction(userId, externalId, home, away),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.prediction(externalId) });
      qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.userPredictions() });
    },
  });
}
