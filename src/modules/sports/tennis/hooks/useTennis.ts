import { useQuery } from "@tanstack/react-query";
import { getTennisPageData } from "../service";
import { TENNIS_KEYS } from "./query-keys";

export function useTennisData() {
  return useQuery({
    queryKey: TENNIS_KEYS.page(),
    queryFn: () => getTennisPageData(),
    staleTime: 1000 * 60 * 10,
  });
}
