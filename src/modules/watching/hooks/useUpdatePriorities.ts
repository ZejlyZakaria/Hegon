import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { bulkUpdatePriorities } from "../service";
import { toast } from "@/shared/utils/toast";

export function useUpdatePriorities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ items, userId }: { items: Array<{ id: string; priority: number }>; userId: string }) =>
      bulkUpdatePriorities(items, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: () => {
      toast.error("Impossible de mettre à jour l'ordre. Réessaie.");
    },
  });
}
