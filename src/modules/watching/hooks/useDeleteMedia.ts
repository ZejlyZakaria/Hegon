import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { deleteMediaItem } from "../service";
import { syncWatchingGoals } from "../lib/sync-goals";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
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
      // refetchType "all" so sections refetch even while inactive — a delete from
      // the detail route must leave the main-page carousels fresh on Back (Next's
      // Router Cache would otherwise restore them stale). Mirrors useUpdateMedia.
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all, refetchType: "all" });
      void syncWatchingGoals(queryClient);
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Impossible de supprimer ce média. Réessaie.");
    },
  });
}
