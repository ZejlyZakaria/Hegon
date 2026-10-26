import { watchingTargetReached } from "./watching-target";
export interface MetricObservation {
  metricKey:string; currentValue:number; liveValue?:number; measuredAt:string;
  source:"WATCHING_HISTORY_V1"; evidenceVersion:1;
}
export function completionEligible(metric:MetricObservation,target:number|null):boolean {
  return target!=null && Number.isFinite(target) && target>0 && Number.isFinite(metric.currentValue) && watchingTargetReached(metric.currentValue,target);
}
