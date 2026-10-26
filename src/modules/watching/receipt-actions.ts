"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/infrastructure/supabase/server";
import { getReceiptGoals, recordGoalReceipts } from "@/modules/goals/receipt-service";
import { receiptMetrics, type ReceiptSnapshot, type UnlockReceipt } from "./lib/milestone-receipts";

async function freshObservation(orgId:string) {
  const db=await createServerClient();
  const {data:auth,error:authError}=await db.auth.getClaims();
  const userId=auth?.claims.sub;
  if(authError || !userId) throw new Error("Authentication required");
  // RPC enforces owner/organization read isolation; writer additionally rejects demo accounts.
  const {data,error}=await db.schema("watching").rpc("receipt_snapshot",{p_org:orgId});
  if(error) throw error;
  const snapshot=data as ReceiptSnapshot;
  return {db,userId,snapshot,metrics:receiptMetrics(snapshot)};
}

/** No metric/threshold/date input is accepted from the browser. No client-cache eligibility. */
async function observeAchievements(orgId:string) {
  const {db,userId,snapshot,metrics}=await freshObservation(orgId);
  const {data:demo,error:demoError}=await db.rpc("is_demo_user");
  if(demoError) throw demoError;
  if(demo) throw new Error("Demo accounts cannot create receipts");
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret) throw new Error("Receipt service is unavailable");
  const writer=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await writer.schema("watching").rpc("record_achievement_unlocks",{
    p_org:orgId,p_user:userId,p_hash:snapshot.source_hash,p_metrics:metrics.achievements,
  });
  if(error) throw error; // A changed observation fails closed; next explicit observation may retry.
  const {data:receipts,error:readError}=await db.schema("watching").from("achievement_unlocks").select("*").eq("org_id",orgId).eq("user_id",userId);
  if(readError) throw readError;
  return {db,userId,snapshot,metrics,writer,receipts:(receipts ?? []) as UnlockReceipt[]};
}

/** Stats observes only its own badges; Goals never blocks a Watching badge read. */
export async function observeWatchingAchievements(orgId:string) {
  return {receipts:(await observeAchievements(orgId)).receipts};
}

/** Goals bridge keeps its existing explicit completion policy. */
export async function observeWatchingReceipts(orgId:string) {
  const {db,userId,snapshot,metrics,writer,receipts}=await observeAchievements(orgId);
  const goals=await getReceiptGoals(db,orgId,userId);
  await recordGoalReceipts(writer,orgId,userId,goals,g=>({metricKey:g.metric_key ?? "titles",
    currentValue:metrics.goalValue(g.metric_key,g.metric_period==="year" ? g.metric_year:null),
    liveValue:metrics.liveGoalValue(g.metric_key,g.metric_period==="year" ? g.metric_year:null),
    measuredAt:snapshot.measured_at,source:"WATCHING_HISTORY_V1",evidenceVersion:1}));
  return {receipts,deltas:goals.map(g=>({id:g.id,title:g.title,metric_key:g.metric_key,metric_target:g.metric_target,
    oldProgress:g.progress,newProgress:g.metric_target && g.metric_target>0 ? Math.min(100,Math.floor(metrics.liveGoalValue(g.metric_key,g.metric_period==="year" ? g.metric_year:null)*100/g.metric_target)):0}))};
}


export async function readWatchingGoalMetric(orgId:string,key:string|null,year:number|null) {
  const {metrics}=await freshObservation(orgId);
  if(key!=null && !["titles","films","series","anime"].includes(key)) throw new Error("Unknown Watching metric");
  return metrics.liveGoalValue(key,year);
}


export async function readWatchingGoalMetrics(orgId:string,requests:{metricKey:string|null;year:number|null}[]) {
  if(requests.length>1000) throw new Error("Too many metric requests");
  const {metrics}=await freshObservation(orgId);
  return requests.map(r=>{
    if(r.metricKey!=null && !["titles","films","series","anime"].includes(r.metricKey)) throw new Error("Unknown Watching metric");
    return metrics.liveGoalValue(r.metricKey,r.year);
  });
}
