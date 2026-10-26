import type { SupabaseClient } from "@supabase/supabase-js";
import type { Goal } from "./types";
import { completionEligible, type MetricObservation } from "./lib/completion-receipts";

/** Goals owns its definitions and writer; Watching supplies only observed metrics. */
export async function getReceiptGoals(db:SupabaseClient,orgId:string,userId:string):Promise<Goal[]> {
  const rows:Goal[]=[];
  // Complete owner-scoped pagination, not a query per Goal; PostgREST caps pages at1000.
  for(let from=0;;from+=1000) {
    const {data,error}=await db.from("goals").select("*").eq("org_id",orgId).eq("user_id",userId)
      .eq("progress_mode","auto").eq("metric_module","watching").in("status",["active","completed"]).order("id").range(from,from+999);
    if(error) throw error;
    rows.push(...(data ?? []));
    if((data?.length ?? 0)<1000) return rows;
  }
}
export async function recordGoalReceipts(db:SupabaseClient,orgId:string,userId:string,goals:Goal[],metric:(g:Goal)=>MetricObservation) {
  const observations=goals.map(g=>{
    if(!["titles","films","series","anime"].includes(g.metric_key ?? "titles") || g.metric_period==="year" && g.metric_year==null) throw new Error("Unsupported Watching goal metric");
    const observation=metric(g);
    return ({...observation,shouldComplete:completionEligible(observation,g.metric_target),goalId:g.id,target:g.metric_target,period:g.metric_period ?? "all_time",year:g.metric_year});});
  if(!observations.length) return;
  const {error}=await db.rpc("record_goal_completion_receipts",{p_org:orgId,p_user:userId,p_observations:observations});
  if(error) throw error;
}
