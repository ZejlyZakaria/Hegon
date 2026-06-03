import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { deleteMediaItem } from "../service";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "../lib/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return deleteMediaItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Impossible de supprimer ce média. Réessaie.");
    },
  });
}
