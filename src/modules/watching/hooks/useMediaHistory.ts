"use client";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/shared/lib/stale";
import { getMediaHistory } from "../service";
import { WATCHING_KEYS } from "./query-keys";

/** Shared by the detail season periods and the expandable audit history. */
export function useMediaHistory(mediaId:string,enabled=true) {
  return useQuery({queryKey:WATCHING_KEYS.history(mediaId),queryFn:()=>getMediaHistory(mediaId),
    enabled:!!mediaId && enabled,staleTime:STALE.MINUTE,gcTime:STALE.HOUR});
}
