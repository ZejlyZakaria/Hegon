import { describe,it,expect } from "vitest";
import { completionEligible,type MetricObservation } from "./completion-receipts";
const metric=(currentValue:number):MetricObservation=>({metricKey:"films",currentValue,measuredAt:"2026-10-21T12:00:00Z",source:"WATCHING_HISTORY_V1",evidenceVersion:1});
describe("Goals raw receipt threshold",()=>{
  it.each([37,49,49.6,49.999])("does not complete %s/50",n=>expect(completionEligible(metric(n),50)).toBe(false));
  it("accepts exact target and larger values without percentage rounding",()=>{
    expect(completionEligible(metric(50),50)).toBe(true);expect(completionEligible(metric(51),50)).toBe(true);
    expect(completionEligible(metric(Infinity),50)).toBe(false);expect(completionEligible(metric(50),null)).toBe(false);
  });
});
