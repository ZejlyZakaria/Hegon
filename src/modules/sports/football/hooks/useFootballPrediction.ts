import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFootballPrediction, upsertFootballPrediction } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

export function useFootballPrediction(userId: string, externalId: number) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.prediction(externalId),
    queryFn: () => getFootballPrediction(userId, externalId),
    enabled: !!userId && Number.isFinite(externalId) && externalId > 0,
  });
}

export function useUpsertFootballPrediction(userId: string, externalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ home, away }: { home: number; away: number }) =>
      upsertFootballPrediction(userId, externalId, home, away),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.prediction(externalId) });
    },
  });
}
