import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { markMediaAsWatched } from "../service";
import { toast } from "@/shared/utils/toast";

export function useMarkAsWatched() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markMediaAsWatched,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: () => {
      toast.error("Impossible de marquer comme regardé. Réessaie.");
    },
  });
}
