import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { updateMediaItem } from "../service";
import type { UpdateMediaInput } from "../schemas/media.schema";

export function useUpdateMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMediaInput) => {
      const { id, ...updates } = input;
      return updateMediaItem(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: (error) => {
      console.error("Error updating media:", error);
    },
  });
}
