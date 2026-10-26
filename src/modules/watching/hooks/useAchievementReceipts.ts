"use client";
import { useMemo } from "react";
import { useOrgStore } from "@/shared/stores/useOrgStore";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/shared/lib/stale";
import { WATCHING_KEYS } from "./query-keys";
import { observeWatchingAchievements } from "../receipt-actions";
import { getAchievementReceipts } from "../service";

export function useAchievementReceipts(userId:string) {
  const orgId=useOrgStore(s=>s.orgId);
  const key=[...WATCHING_KEYS.all,"receipts",userId,orgId];
  const existing=useQuery({queryKey:key,
    queryFn:async()=>{
      if(!orgId) throw new Error("Organization required");
      return getAchievementReceipts(userId,orgId);
    },enabled:!!userId && !!orgId,staleTime:STALE.MINUTE,gcTime:STALE.HOUR,retry:false});
  const observation=useQuery({queryKey:[...key,"observation"],
    queryFn:async()=>{
      if(!orgId) throw new Error("Organization required");
      return observeWatchingAchievements(orgId);
    },enabled:!!userId && !!orgId && !!existing.isSuccess,
    staleTime:STALE.MINUTE,gcTime:STALE.HOUR,retry:false});
  // Merge immutable receipts: an older cached observation must not hide a newer read.
  const data=useMemo(()=>({receipts:[...new Map([...(existing.data?.receipts ?? []),...(observation.data?.receipts ?? [])]
    .map(r=>[r.achievement_key,r])).values()]}),[existing.data,observation.data]);
  return {data,error:existing.error ?? observation.error};
}
