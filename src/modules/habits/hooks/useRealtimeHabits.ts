"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/shared/hooks/useRealtimeSync";
import { HABIT_KEYS } from "./query-keys";

export function useRealtimeHabits() {
  const queryClient = useQueryClient();

  useRealtimeSync({
    channelName: "habits-changes",
    table: "habits",
    onchange: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });
    },
  });

  useRealtimeSync({
    channelName: "habit-completions-changes",
    table: "habit_completions",
    onchange: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });
    },
  });
}
