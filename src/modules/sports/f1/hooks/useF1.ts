import { useQuery } from "@tanstack/react-query";
import { getF1PageData } from "../service";
import { F1_KEYS } from "./query-keys";

export function useF1Data() {
  return useQuery({
    queryKey: F1_KEYS.page(),
    queryFn: () => getF1PageData(),
    staleTime: 1000 * 60 * 10,
  });
}
