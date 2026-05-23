import { useQuery } from "@tanstack/react-query";
import { WATCHING_KEYS } from "./query-keys";
import { getMediaItemById } from "../service";

export function useMediaItem(id: string) {
  return useQuery({
    queryKey: WATCHING_KEYS.detail(id),
    queryFn: () => getMediaItemById(id),
    enabled: !!id,
  });
}
