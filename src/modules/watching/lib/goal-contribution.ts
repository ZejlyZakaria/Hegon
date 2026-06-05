import type { WatchingGoalSummary } from "@/modules/goals/service";

const KEY_TO_TYPE: Record<string, string> = { films: "film", series: "serie", anime: "anime" };

// Does a watched media count toward this goal? (type match + period match)
export function goalMatchesMedia(
  goal: WatchingGoalSummary,
  media: { type: string; watched_at: string | null },
): boolean {
  if (goal.metric_key && goal.metric_key !== "titles" && KEY_TO_TYPE[goal.metric_key] !== media.type) {
    return false;
  }
  if (goal.metric_period === "year" && goal.metric_year) {
    if (!media.watched_at) return false;
    if (new Date(media.watched_at).getFullYear() !== goal.metric_year) return false;
  }
  return true;
}

// Would marking a media (type) watched NOW count toward this goal? (watched_at = today)
export function goalWouldCount(goal: WatchingGoalSummary, type: string): boolean {
  if (goal.metric_key && goal.metric_key !== "titles" && KEY_TO_TYPE[goal.metric_key] !== type) {
    return false;
  }
  if (goal.metric_period === "year" && goal.metric_year) {
    return goal.metric_year === new Date().getFullYear();
  }
  return true;
}

// Reconstruct the current count from the stored progress %.
export function goalCount(goal: WatchingGoalSummary): number {
  const target = goal.metric_target ?? 0;
  return Math.round((goal.progress / 100) * target);
}

export function goalMetricLabel(goal: WatchingGoalSummary): string {
  return goal.metric_key === "films" ? "films"
    : goal.metric_key === "series" ? "TV shows"
    : goal.metric_key === "anime" ? "animes"
    : "titles";
}
