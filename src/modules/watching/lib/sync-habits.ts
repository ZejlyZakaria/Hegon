import type { QueryClient } from "@tanstack/react-query";
import {
  autoTickHabitsFromActivity,
  type ActivityTick,
} from "@/modules/habits/service";
import { HABIT_KEYS } from "@/modules/habits/hooks/query-keys";
import { getRecentWatchedActivity } from "../service";
import { showHabitRipple } from "../components/detail/HabitRippleToast";

// How far back a watch can reach to satisfy a habit period. Keeps auto-ticks about
// ongoing tracking — adding an old film to the library never rewrites past streaks.
const WINDOW_DAYS = 14;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Cross-module bridge: after a watch change, auto-tick habits linked to Watching
// and refresh the Habits UI. Best-effort — the watch already succeeded, so any
// failure here is swallowed. Shows a subtle toast for habits ticked this week.
export async function syncWatchingHabits(queryClient: QueryClient): Promise<ActivityTick[]> {
  let ticked: ActivityTick[] = [];
  try {
    const activity = await getRecentWatchedActivity(daysAgo(WINDOW_DAYS));
    ticked = await autoTickHabitsFromActivity(
      "watching",
      activity.map((a) => ({ type: a.type, date: a.watched_at.slice(0, 10) })),
    );
  } catch {
    /* non-fatal */
  }

  if (ticked.length > 0) {
    queryClient.invalidateQueries({ queryKey: HABIT_KEYS.all });

    // Only celebrate ticks for the current week — older reconciled ticks stay silent.
    const weekFloor = daysAgo(7);
    showHabitRipple(ticked.filter((t) => t.date >= weekFloor));
  }

  return ticked;
}
