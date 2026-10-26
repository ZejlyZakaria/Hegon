import type { Goal } from "../types";

export function WatchingCompletionStatus({goal,current}:{goal:Goal;current:number}) {
  if(goal.metric_module!=="watching" || goal.status!=="completed") return null;
  return <p className="text-xs text-text-secondary">Historically completed. Current progress: {current} / {goal.metric_target}</p>;
}
