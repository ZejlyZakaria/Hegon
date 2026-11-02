import { computeStats } from "../components/stats/computeStats";
import { deduplicateFirstViewing, workKeyOf, type HistoryAnalytics } from "./history-analytics";
import type { StatsRawItem } from "../service";
import type { AnimeCoursRow } from "../types";

/** One evaluator for live goal counters and the detail-page contribution explanation. */
export function createLiveGoalEvaluator(items: StatsRawItem[], cours: Map<number, AnimeCoursRow>, history: HistoryAnalytics) {
  const completed = new Set(deduplicateFirstViewing(history.records.filter(r=>r.origin==="USER_ACTION" || r.origin==="USER_CORRECTION")).filter(r => !r.retracted_at && r.kind === "COMPLETION" && r.completion_basis === "FINISHED_TITLE").map(r => r.work_key));
  const periods = new Map<number|null, ReturnType<typeof computeStats>>();
  return (key: string|null, year: number|null) => {
    let stats = periods.get(year);
    if (!stats) { stats = computeStats(items, [], year, cours, history); periods.set(year, stats); }
    const ids = new Set([...stats.breakdown.film,...stats.breakdown.serie,...stats.breakdown.anime,...stats.breakdown.rewatches].map(e=>e.item.id));
    return items.filter(i => (key==="films" ? i.type==="film" : key==="series" ? i.type==="serie" : key==="anime" ? i.type==="anime" : true)
      && ids.has(i.id) && (i.type==="film" || i.watched || completed.has(workKeyOf(i)))).length;
  };
}
