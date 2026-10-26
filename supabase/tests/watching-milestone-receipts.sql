-- Disposable local fixture only. No production credentials/data.
RESET ROLE;
INSERT INTO public.goals(id,org_id,user_id,title,status,progress_mode,metric_module,metric_key,metric_period,metric_target)
VALUES('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Watch50','active','auto','watching','films','all_time',50);
DO $$
DECLARE org uuid:='10000000-0000-0000-0000-000000000001'; actor uuid:='00000000-0000-0000-0000-000000000001';
 hash text; metric jsonb; receipt_time timestamptz; goal_time timestamptz; observation jsonb;
BEGIN
 hash:=md5(watching.receipt_source(org,actor)::text);
 metric:='[{"achievement_key":"cinephile","rule_version":1,"metric_key":"watching:cinephile:v1","target":350,"actual_value":349.6}]';
 PERFORM watching.record_achievement_unlocks(org,actor,hash,metric);
 PERFORM public.test_assert(NOT EXISTS(SELECT FROM watching.achievement_unlocks),'raw fractional value does not unlock');
 metric:=jsonb_set(metric,'{0,actual_value}','350');
 PERFORM watching.record_achievement_unlocks(org,actor,hash,metric);
 SELECT observed_at INTO receipt_time FROM watching.achievement_unlocks;
 PERFORM watching.record_achievement_unlocks(org,actor,hash,metric);
 PERFORM watching.record_achievement_unlocks(org,actor,hash,jsonb_set(metric,'{0,actual_value}','349'));
 PERFORM public.test_assert((SELECT count(*)=1 AND min(observed_at)=receipt_time AND min(actual_value)=350 FROM watching.achievement_unlocks),'retry/drop preserve first evidence');
 PERFORM public.test_assert((SELECT observation_kind='FIRST_OBSERVED_SATISFIED' FROM watching.achievement_unlocks),'date is observation, not reconstructed first unlock');
 BEGIN PERFORM watching.record_achievement_unlocks(org,actor,'stale',metric); RAISE EXCEPTION 'FAILED stale accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 observation:=jsonb_build_array(jsonb_build_object('goalId','70000000-0000-0000-0000-000000000001','metricKey','films','target',50,'period','all_time','year',NULL,'shouldComplete',false,'currentValue',49.6,'liveValue',49.6,'measuredAt',clock_timestamp(),'source','WATCHING_HISTORY_V1','evidenceVersion',1));
 PERFORM public.record_goal_completion_receipts(org,actor,observation);
 PERFORM public.test_assert(NOT EXISTS(SELECT FROM public.goal_completion_receipts),'49.6/50 does not complete');
 PERFORM public.test_assert((SELECT status='active' AND progress=99 FROM public.goals WHERE id='70000000-0000-0000-0000-000000000001'),'floor percentage independent from status');
 observation:=jsonb_set(observation,'{0,shouldComplete}','true');
 observation:=jsonb_set(observation,'{0,currentValue}','50');
 observation:=jsonb_set(observation,'{0,liveValue}','50');
 PERFORM public.record_goal_completion_receipts(org,actor,observation);
 SELECT completed_at INTO goal_time FROM public.goals WHERE id='70000000-0000-0000-0000-000000000001';
 PERFORM public.record_goal_completion_receipts(org,actor,observation);
 observation:=jsonb_set(observation,'{0,shouldComplete}','false');
 observation:=jsonb_set(observation,'{0,currentValue}','49');
 observation:=jsonb_set(observation,'{0,liveValue}','49');
 PERFORM public.record_goal_completion_receipts(org,actor,observation);
 PERFORM public.test_assert((SELECT count(*)=1 AND min(actual_value)=50 FROM public.goal_completion_receipts),'single Goal receipt');
 PERFORM public.test_assert((SELECT status='completed' AND progress=98 AND completed_at=goal_time FROM public.goals WHERE id='70000000-0000-0000-0000-000000000001'),'Goal live49, historical completed50 and stable date');
 UPDATE public.goals SET status='active',completed_at=NULL WHERE id='70000000-0000-0000-0000-000000000001';
 PERFORM public.test_assert((SELECT status='completed' AND completed_at=goal_time FROM public.goals WHERE id='70000000-0000-0000-0000-000000000001'),'ordinary edit cannot revoke');
 BEGIN PERFORM public.record_goal_completion_receipts(org,actor,jsonb_set(observation,'{0,target}','100')); RAISE EXCEPTION 'FAILED stale target'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.test_assert((watching.receipt_snapshot('10000000-0000-0000-0000-000000000001')->>'source_hash') IS NOT NULL,'owner snapshot works');
DO $$ BEGIN
 BEGIN PERFORM watching.record_achievement_unlocks('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','forged','[]'); RAISE EXCEPTION 'FAILED client writer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.record_goal_completion_receipts('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','[]'); RAISE EXCEPTION 'FAILED client goal writer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE watching.achievement_unlocks SET actual_value=999; RAISE EXCEPTION 'FAILED receipt overwrite'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.goal_completion_receipts; RAISE EXCEPTION 'FAILED receipt delete'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(NOT EXISTS(SELECT FROM watching.achievement_unlocks),'foreign achievements hidden');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.goal_completion_receipts),'foreign Goal receipts hidden');
RESET ROLE;
SELECT public.test_assert(NOT has_function_privilege('anon','watching.record_achievement_unlocks(uuid,uuid,text,jsonb)','execute'),'anon denied');
SELECT 'PASS: receipt thresholds, permanence, retries, stale observations/definitions and ownership/RLS.';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
 BEGIN PERFORM watching.receipt_snapshot('10000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'FAILED foreign organization'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT public.test_assert(has_function_privilege('service_role','watching.record_achievement_unlocks(uuid,uuid,text,jsonb)','execute'),'trusted writer allowed');
SELECT public.test_assert(has_function_privilege('service_role','public.record_goal_completion_receipts(uuid,uuid,jsonb)','execute'),'Goals trusted writer allowed');
SELECT public.test_assert((SELECT status='completed' AND completed_at='2024-05-02'::timestamptz FROM public.goals WHERE id='70000000-0000-0000-0000-000000000099'),'legacy explicit completion/date preserved without receipt');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.goal_completion_receipts WHERE goal_id='70000000-0000-0000-0000-000000000099'),'no guessed legacy receipt');

-- Marathoner uses the same fresh mixed total as Stats, never a rounded percentage.
DO $$
DECLARE org uuid:='10000000-0000-0000-0000-000000000001'; actor uuid:='00000000-0000-0000-0000-000000000001'; h text; m jsonb; stamp timestamptz;
BEGIN
 h:=md5(watching.receipt_source(org,actor)::text);
 PERFORM public.test_assert(watching.receipt_source(org,actor) ? 'rewatches','snapshot fingerprints legacy rewatch inputs too');
 m:='[{"achievement_key":"marathoner","rule_version":1,"metric_key":"watching:marathoner:v1","target":3000,"actual_value":2999.999}]';
 PERFORM watching.record_achievement_unlocks(org,actor,h,m);
 PERFORM public.test_assert(NOT EXISTS(SELECT FROM watching.achievement_unlocks WHERE achievement_key='marathoner'),'rounded3000 is not raw3000');
 stamp:=transaction_timestamp();
 m:=jsonb_set(m,'{0,actual_value}','3331.0333333333333');
 PERFORM watching.record_achievement_unlocks(org,actor,h,m);
 PERFORM watching.record_achievement_unlocks(org,actor,h,m);
 PERFORM public.test_assert((SELECT count(*)=1 AND min(actual_value)=3331.0333333333333 AND min(observed_at)>=stamp FROM watching.achievement_unlocks WHERE achievement_key='marathoner'),'raw mixed hours unlock prospectively once');
 PERFORM public.test_assert((SELECT observation_kind='FIRST_OBSERVED_SATISFIED' AND evidence->>'source'='WATCHING_STATS_HOURS_V1' FROM watching.achievement_unlocks WHERE achievement_key='marathoner'),'Marathoner observation is not a reconstructed watch date');
END $$;
