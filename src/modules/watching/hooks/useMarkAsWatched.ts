import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { markMediaAsWatched } from "../service";

export function useMarkAsWatched() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markMediaAsWatched,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: (error) => {
      console.error("Error marking as watched:", error);
    },
  });
}
