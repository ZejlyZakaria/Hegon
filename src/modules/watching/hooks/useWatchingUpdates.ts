"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrgStore } from "@/shared/stores/useOrgStore";
import { STALE } from "@/shared/lib/stale";
import { WATCHING_KEYS } from "./query-keys";
import { getWatchingUpdatesData } from "../service";

export function useWatchingUpdates(userId: string) {
  const orgId = useOrgStore(s => s.orgId);
  return useQuery({
    queryKey: WATCHING_KEYS.updates(userId, orgId),
    queryFn: () => getWatchingUpdatesData(userId, orgId!),
    enabled: !!userId && !!orgId,
    staleTime: STALE.MINUTE,
    gcTime: STALE.HOUR,
    refetchInterval: STALE.DEFAULT,
  });
}
