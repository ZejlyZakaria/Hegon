-- Disposable PostgreSQL fixture only. No production data or credentials.
INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,runtime,watched) VALUES
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','film','Wave2C movie',9010,120,true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE c jsonb; result jsonb; rid uuid; replacement uuid; op uuid; frozen jsonb;
  fact jsonb:='{"kind":"REWATCH","scope_kind":"WHOLE_TITLE","scope_key":null,"completion_basis":null,"year":null,"month":null,"day":null,"date_precision":"UNKNOWN","date_confidence":"UNKNOWN","scope_confidence":"CONFIRMED","origin":"USER_ACTION","ranges":[{"season_key":"movie","season_number_at_recording":0,"episode_from":1,"episode_to":1,"episode_ids":null,"minutes":120,"duration_basis":"RUNTIME_SNAPSHOT"}]}';
BEGIN
 c:=jsonb_build_object('mode','rewatch','media_id','50000000-0000-0000-0000-000000000001','expected_revision',0,'operation_key',gen_random_uuid(),'patch','{}'::jsonb,'records',jsonb_build_array(fact));
 result:=watching.personal_history_command(c);
 SELECT id INTO rid FROM watching.viewing_records WHERE operation_key=(c->>'operation_key')::uuid;
 PERFORM public.test_assert((SELECT date_precision='UNKNOWN' AND year IS NULL AND scope_kind='WHOLE_TITLE' FROM watching.viewing_records WHERE id=rid),'UNKNOWN date preserved');
 PERFORM public.test_assert(NOT EXISTS(SELECT 1 FROM watching.rewatches WHERE id=rid),'no fabricated compatibility day for UNKNOWN');
 PERFORM public.test_assert((SELECT minutes=120 FROM watching.viewing_ranges WHERE viewing_record_id=rid),'frozen movie runtime');
 PERFORM watching.personal_history_command(c);
 PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records WHERE operation_key=(c->>'operation_key')::uuid),'rewatch retry idempotent');
 PERFORM public.test_assert((SELECT watched AND runtime=120 AND user_rating IS NULL AND personal_revision=1 FROM watching.media_items WHERE id='50000000-0000-0000-0000-000000000001'),'rewatch does not change personal posture/rating');
 PERFORM public.test_reject(c||jsonb_build_object('operation_key',gen_random_uuid()),'stale revision');
 PERFORM public.test_reject(c||jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',1,'viewing_context',jsonb_build_object('snapshot_id',gen_random_uuid(),'mapping_snapshot_id',NULL)),'stale provider context');
 fact:=fact||'{"year":2026,"month":10,"day":null,"date_precision":"MONTH","date_confidence":"CONFIRMED","origin":"USER_CORRECTION"}'::jsonb||jsonb_build_object('supersedes_id',rid);
 c:=c||jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',1,'retract_ids',jsonb_build_array(rid),'reason','Correct date','records',jsonb_build_array(fact));
 result:=watching.personal_history_command(c);
 SELECT id INTO replacement FROM watching.viewing_records WHERE supersedes_id=rid;
 PERFORM public.test_assert((SELECT retracted_at IS NOT NULL FROM watching.viewing_records WHERE id=rid),'correction retains retracted original');
 PERFORM public.test_assert((SELECT date_precision='MONTH' AND day IS NULL AND retracted_at IS NULL FROM watching.viewing_records WHERE id=replacement),'replacement preserves month precision');
 c:=jsonb_build_object('mode','update','media_id','50000000-0000-0000-0000-000000000001','operation_key',gen_random_uuid(),'expected_revision',2,'patch','{}'::jsonb,'records','[]'::jsonb,'retract_ids',jsonb_build_array(replacement),'reason','Remove incorrect rewatch');
 result:=watching.personal_history_command(c);
 PERFORM watching.personal_history_command(c);
 PERFORM public.test_assert((SELECT count(*)=2 FROM watching.viewing_records WHERE media_item_id='50000000-0000-0000-0000-000000000001'),'removal retains both historical assertions');
 PERFORM public.test_assert(NOT EXISTS(SELECT 1 FROM watching.viewing_records WHERE media_item_id='50000000-0000-0000-0000-000000000001' AND retracted_at IS NULL),'removal leaves no active watch');
 PERFORM public.test_assert(NOT EXISTS(SELECT 1 FROM watching.rewatches WHERE media_item_id='50000000-0000-0000-0000-000000000001'),'removed compatibility row gone');
 PERFORM public.test_reject(c||jsonb_build_object('media_id','20000000-0000-0000-0000-000000000002','operation_key',gen_random_uuid()),'foreign owner write');
 BEGIN UPDATE watching.viewing_records SET title_snapshot='overwrite'; RAISE EXCEPTION 'FAILED direct history write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM watching.viewing_records WHERE media_item_id='50000000-0000-0000-0000-000000000001'),'foreign history hidden');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM watching.viewing_ranges r WHERE r.viewing_record_id IN (SELECT id FROM watching.viewing_records WHERE user_id='00000000-0000-0000-0000-000000000001')),'foreign ranges hidden');
RESET ROLE;
SELECT 'PASS: Wave2C UNKNOWN dates, frozen durations, correction/retraction, retry, stale revision/context, ownership and RLS.';
