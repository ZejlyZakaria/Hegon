import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { bulkUpdatePriorities } from "../service";
import { toast } from "@/shared/utils/toast";
import { DemoReadOnlyError, handledDemoError } from "../lib/demo-guard";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";

export function useUpdatePriorities() {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  return useMutation({
    mutationFn: ({ items, userId }: { items: Array<{ id: string; priority: number }>; userId: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return bulkUpdatePriorities(items, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WATCHING_KEYS.all });
    },
    onError: (error) => {
      if (handledDemoError(error)) return;
      toast.error("Impossible de mettre à jour l'ordre. Réessaie.");
    },
  });
}
