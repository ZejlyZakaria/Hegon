import { useQuery } from "@tanstack/react-query";
import { getFootballPageData } from "../service";
import { FOOTBALL_KEYS } from "./query-keys";

export function useFootballData() {
  return useQuery({
    queryKey: FOOTBALL_KEYS.page(),
    queryFn: () => getFootballPageData(),
    staleTime: 1000 * 60 * 10,
  });
}
