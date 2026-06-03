import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { markMediaAsWatched } from "../service";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "../lib/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";

export function useMarkAsWatched() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: (mediaId: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return markMediaAsWatched(mediaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Impossible de marquer comme regardé. Réessaie.");
    },
  });
}
