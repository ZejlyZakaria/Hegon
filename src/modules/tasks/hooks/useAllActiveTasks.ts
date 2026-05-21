"use client";

import { useQuery } from "@tanstack/react-query";
import * as TaskService from "../service";
import { NOW_TASK_KEYS } from "./query-keys";

export function useAllActiveTasks() {
  return useQuery({
    queryKey: NOW_TASK_KEYS.all,
    queryFn: TaskService.getAllActiveTasks,
    staleTime: 1000 * 60 * 2,
  });
}
