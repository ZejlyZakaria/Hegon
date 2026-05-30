import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { deleteMediaItem } from "../service";
import { toast } from "@/shared/utils/toast";

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMediaItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: () => {
      toast.error("Impossible de supprimer ce média. Réessaie.");
    },
  });
}
