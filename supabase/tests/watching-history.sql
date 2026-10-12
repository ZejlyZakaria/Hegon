-- Real PostgreSQL tests. The runner supplies isolated auth helpers and baseline Watching DDL.
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO public.organizations VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
INSERT INTO public.memberships VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,watched_at,season_aired,current_season,current_episode) VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','serie','Hannibal',400,'2022-12-31 12:00',ARRAY[13,13,13],2,13),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','film','Foreign user',400,null,null,1,0),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','film','Foreign org',401,null,null,1,0);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

CREATE FUNCTION public.test_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',label; END IF; END $$;
CREATE FUNCTION public.test_reject(command jsonb, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN PERFORM watching.personal_history_command(command);
  EXCEPTION WHEN OTHERS THEN RETURN; END;
  RAISE EXCEPTION 'FAILED: expected rejection: %',label;
END $$;

SET ROLE authenticated;
DO $$
DECLARE
  c jsonb; result jsonb; bad jsonb; rid uuid; revision bigint; n integer;
  fact jsonb := '{"kind":"FIRST_WATCH","scope_kind":"SEASON","scope_key":"tmdb-season:1","year":2022,"month":null,"day":null,"date_precision":"YEAR","date_confidence":"CONFIRMED","scope_confidence":"INFERRED","origin":"USER_ACTION","ranges":[{"season_key":"tmdb-season:1","season_number_at_recording":1,"episode_from":1,"episode_to":13,"episode_ids":null,"minutes":585,"duration_basis":"RUNTIME_SNAPSHOT"}]}';
BEGIN
  PERFORM public.test_assert((SELECT history_version=0 AND personal_revision=0 AND viewing_date IS NULL FROM watching.media_items WHERE title='Hannibal'),'legacy unchanged/no date fabrication');
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.viewing_records),'no migration reconstruction');
  c := jsonb_build_object('mode','update','media_id','20000000-0000-0000-0000-000000000001','operation_key',gen_random_uuid(),'expected_revision',0,'patch',jsonb_build_object('favorite',true),'records',jsonb_build_array(fact));
  result := watching.personal_history_command(c);
  PERFORM public.test_assert((result->>'personal_revision')::int=1 AND (result->>'history_version')::int=1,'revision once/history prospective');
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records),'idempotent retry');
  SELECT id INTO rid FROM watching.viewing_records LIMIT 1;
  PERFORM public.test_assert((SELECT year=2022 AND month IS NULL AND day IS NULL AND date_precision='YEAR' FROM watching.viewing_records WHERE id=rid),'YEAR precise/recorded_at not viewing date');
  PERFORM public.test_assert((SELECT episode_to-episode_from+1=13 AND minutes=585 AND episode_ids IS NULL FROM watching.viewing_ranges LIMIT 1),'inclusive frozen range/unknown IDs');
  PERFORM public.test_reject(c || '{"patch":{"favorite":false}}','operation-key payload mismatch');
  PERFORM public.test_reject(c || jsonb_build_object('operation_key',gen_random_uuid()),'stale revision');
  PERFORM public.test_reject(c || jsonb_build_object('operation_key',gen_random_uuid(),'media_id','20000000-0000-0000-0000-000000000002'),'cross-user same org');
  PERFORM public.test_reject(c || jsonb_build_object('operation_key',gen_random_uuid(),'media_id','20000000-0000-0000-0000-000000000003'),'cross-org own user');
  c := c || jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',1,'patch',jsonb_build_object('favorite',false));
  bad := jsonb_set(c,'{records,0,day}','29'); bad := jsonb_set(bad,'{records,0,month}','2'); bad := jsonb_set(bad,'{records,0,date_precision}','"DAY"');
  PERFORM public.test_reject(bad,'invalid nonleap date');
  PERFORM public.test_assert((SELECT favorite AND personal_revision=1 FROM watching.media_items WHERE title='Hannibal'),'history failure rolls back projection');
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records),'history failure leaves no receipt');
  PERFORM public.test_reject(c || '{"patch":{"priority":99}}','projection failure');
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records),'projection failure rolls back history');
  PERFORM public.test_reject(jsonb_set(c,'{records,0,ranges,0,episode_from}','14'),'reverse range');
  PERFORM public.test_reject(jsonb_set(c,'{records,0,ranges,0,episode_from}','0'),'zero episode');
  PERFORM public.test_reject(jsonb_set(c,'{records,0,ranges,0,episode_ids}','[]'),'empty IDs not unknown');
  PERFORM public.test_reject(jsonb_set(c,'{records,0,ranges}',jsonb_build_array(fact->'ranges'->0,fact->'ranges'->0)),'overlap rejected');
  PERFORM public.test_reject(jsonb_set(c,'{records,0,ranges,0,viewing_record_id}',to_jsonb(rid)),'foreign range parent');
  PERFORM public.test_reject(jsonb_set(c,'{records,0,kind}','"COMPLETION"'),'completion cannot double count');
  bad := jsonb_set(bad,'{records,0,year}','2024');
  result := watching.personal_history_command(bad);
  PERFORM public.test_assert((result->>'personal_revision')::int=2,'valid leap day and distinct action');
  c := c || jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',2);
  c := jsonb_set(c,'{records,0,month}','8'); c := jsonb_set(c,'{records,0,date_precision}','"MONTH"');
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records WHERE date_precision='MONTH' AND month=8 AND day IS NULL),'MONTH not first day');
  c := c || jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',3);
  c := jsonb_set(c,'{records,0}',fact || '{"kind":"COMPLETION","completion_basis":"FINISHED_TITLE","ranges":[]}');
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.viewing_ranges r JOIN watching.viewing_records v ON v.id=r.viewing_record_id WHERE v.kind='COMPLETION'),'milestone no duration');
  c := c || jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',4,'records',jsonb_build_array(fact || jsonb_build_object('supersedes_id',rid,'origin','USER_CORRECTION')),'retract_ids',jsonb_build_array(rid),'reason','Correct year');
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT retracted_at IS NOT NULL AND year=2022 FROM watching.viewing_records WHERE id=rid),'original preserved');
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records WHERE supersedes_id=rid),'correction linked');
  PERFORM watching.personal_history_command(c);
  BEGIN UPDATE watching.viewing_records SET year=2000 WHERE id=rid; RAISE EXCEPTION 'FAILED direct history edit'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,duration_basis) VALUES(rid,'x',1,1,1,'UNKNOWN'); RAISE EXCEPTION 'FAILED direct range insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE watching.media_items SET personal_revision=100 WHERE title='Hannibal'; RAISE EXCEPTION 'FAILED spoof revision'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE watching.media_items SET favorite=true WHERE title='Hannibal'; RAISE EXCEPTION 'FAILED bypass command'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.viewing_records),'RLS user isolation within org');
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.viewing_ranges),'RLS child isolation');
  PERFORM public.test_reject(c || jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',5),'foreign correction');
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  SELECT count(*) INTO n FROM watching.viewing_records;
  DELETE FROM watching.media_items WHERE title='Hannibal';
  PERFORM public.test_assert((SELECT count(*)=n FROM watching.viewing_records),'library delete retains history');
  PERFORM public.test_assert((SELECT bool_and(media_item_id IS NULL AND work_key='tv:400' AND title_snapshot='Hannibal') FROM watching.viewing_records),'retained immutable identity');
  PERFORM public.test_assert((SELECT count(*)>0 FROM watching.viewing_ranges),'delete retains bounded ranges');
END $$;
RESET ROLE;
-- New insert + exact precision, rewatch projection/correction/removal, trusted provider changes.
SET ROLE authenticated;
DO $$
DECLARE
  c jsonb; original jsonb; result jsonb; mid uuid := gen_random_uuid(); rid uuid; replacement uuid;
  fact jsonb := '{"kind":"FIRST_WATCH","scope_kind":"WHOLE_TITLE","scope_key":"movie","year":2024,"month":2,"day":29,"date_precision":"DAY","date_confidence":"CONFIRMED","scope_confidence":"CONFIRMED","origin":"USER_ACTION","ranges":[{"season_key":"movie","season_number_at_recording":0,"episode_from":1,"episode_to":1,"episode_ids":null,"minutes":90,"duration_basis":"RUNTIME_SNAPSHOT"}]}';
BEGIN
  c := jsonb_build_object('mode','insert','media_id',mid,'operation_key',gen_random_uuid(),'patch',
    jsonb_build_object('user_id','00000000-0000-0000-0000-000000000001','org_id','10000000-0000-0000-0000-000000000001',
      'type','film','title','New precise film','tmdb_id',400,'watched',true,'viewing_date',jsonb_build_object('year',2024,'month',2,'day',29)),
    'records',jsonb_build_array(fact));
  PERFORM public.test_reject(jsonb_set(c,'{records,0,day}','30'),'insert history failure');
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.media_items WHERE id=mid),'new projection insert rolled back');
  result := watching.personal_history_command(c);
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records WHERE media_item_id=mid),'insert idempotency');
  PERFORM public.test_assert(result->'viewing_date'= '{"year":2024,"month":2,"day":29}'::jsonb,'picker parts stored');
  PERFORM public.test_assert((SELECT work_key='movie:400' FROM watching.viewing_records WHERE media_item_id=mid),'movie/TV namespace');
  c := jsonb_build_object('mode','rewatch','media_id',mid,'operation_key',gen_random_uuid(),'expected_revision',1,'patch','{}'::jsonb,
    'records',jsonb_build_array(fact || '{"kind":"REWATCH","scope_kind":"UNKNOWN","scope_key":null,"scope_confidence":"UNKNOWN","month":8,"day":null,"date_precision":"MONTH","ranges":[]}'));
  original := c;
  PERFORM watching.personal_history_command(c);
  PERFORM watching.personal_history_command(c);
  SELECT id INTO rid FROM watching.viewing_records WHERE media_item_id=mid AND kind='REWATCH';
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.rewatches WHERE media_item_id=mid),'rewatch retry does not duplicate projection');
  PERFORM public.test_assert((SELECT day IS NULL AND month=8 AND date_precision='MONTH' FROM watching.viewing_records WHERE id=rid),'rewatch month not day 1');
  PERFORM public.test_assert((SELECT watched_on='2024-08-01' FROM watching.rewatches WHERE id=rid),'rewatch date projection only');
  c := c || jsonb_build_object('mode','update','operation_key',gen_random_uuid(),'expected_revision',2,'retract_ids',jsonb_build_array(rid),'reason','Correct rewatch date');
  c := jsonb_set(c,'{records,0}',(c->'records'->0) || jsonb_build_object('supersedes_id',rid,'year',2022,'origin','USER_CORRECTION'));
  PERFORM watching.personal_history_command(c);
  SELECT id INTO replacement FROM watching.viewing_records WHERE supersedes_id=rid;
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.rewatches WHERE id=rid),'old rewatch projection removed atomically');
  PERFORM public.test_assert((SELECT watched_on='2022-08-01' FROM watching.rewatches WHERE id=replacement),'corrected rewatch projection');
  PERFORM watching.personal_history_command(original);
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.rewatches WHERE media_item_id=mid),'old retry cannot resurrect corrected projection');
  c := jsonb_build_object('mode','remove_rewatch','media_id',mid,'operation_key',gen_random_uuid(),'expected_revision',3,
    'rewatch_id',replacement,'patch','{}'::jsonb,'records','[]'::jsonb,'retract_ids',jsonb_build_array(replacement),'reason','Remove mistaken rewatch');
  PERFORM public.test_reject(c || '{"retract_ids":[]}','projection-only removal blocked');
  PERFORM watching.personal_history_command(c);
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.rewatches WHERE media_item_id=mid),'rewatch removal atomic/retry-safe');
  PERFORM public.test_assert((SELECT retracted_at IS NOT NULL AND retracted_by=auth.uid() FROM watching.viewing_records WHERE id=replacement),'retraction actor retained');
  c := jsonb_build_object('mode','update','media_id',mid,'operation_key',gen_random_uuid(),'expected_revision',4,'patch','{}'::jsonb,
    'records',jsonb_build_array(fact || '{"year":null,"month":null,"day":null,"date_precision":"UNKNOWN","date_confidence":"UNKNOWN","ranges":[]}'));
  PERFORM watching.personal_history_command(c);
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.viewing_records WHERE media_item_id=mid AND date_precision='UNKNOWN' AND year IS NULL AND month IS NULL AND day IS NULL),'UNKNOWN date');
  PERFORM set_config('request.demo','true',true);
  PERFORM public.test_reject(c || jsonb_build_object('operation_key',gen_random_uuid(),'expected_revision',5),'demo RPC guard');
  PERFORM set_config('request.demo','false',true);
  BEGIN DELETE FROM watching.rewatches WHERE id=rid; RAISE EXCEPTION 'FAILED direct rewatch delete'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO watching.media_items(user_id,org_id,type,title) VALUES(auth.uid(),'10000000-0000-0000-0000-000000000001','film','Bypass'); RAISE EXCEPTION 'FAILED direct insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$
DECLARE before_revision bigint; mid uuid;
BEGIN
  SELECT id, personal_revision INTO mid,before_revision FROM watching.media_items WHERE title='New precise film';
  UPDATE watching.media_items SET runtime=120, rating=8.75, personal_revision=900, history_version=0 WHERE id=mid;
  PERFORM public.test_assert((SELECT personal_revision=before_revision AND history_version=1 FROM watching.media_items WHERE id=mid),'provider refresh cannot control revision/version');
  UPDATE watching.media_items SET watched=false,in_progress=true WHERE id=mid;
  PERFORM public.test_assert((SELECT personal_revision=before_revision+1 FROM watching.media_items WHERE id=mid),'trusted posture change advances server revision');
  BEGIN UPDATE watching.viewing_records SET retracted_at=now() WHERE media_item_id=mid; RAISE EXCEPTION 'FAILED robot history retraction'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: precision, retry, atomicity, revisions, tenant/user RLS, ranges, correction, completion, removal, legacy' AS contracts;
SET ROLE authenticated;
DO $$
DECLARE mid uuid; rev bigint; retained integer;
BEGIN
  SELECT id,personal_revision INTO mid,rev FROM watching.media_items WHERE title='New precise film';
  PERFORM watching.personal_history_command(jsonb_build_object('mode','rewatch','media_id',mid,'operation_key',gen_random_uuid(),
    'expected_revision',rev,'patch','{}'::jsonb,'records','[{"kind":"REWATCH","scope_kind":"UNKNOWN","year":2022,"month":null,"day":null,"date_precision":"YEAR","date_confidence":"CONFIRMED","scope_confidence":"UNKNOWN","origin":"USER_ACTION","ranges":[]}]'::jsonb));
  SELECT count(*) INTO retained FROM watching.viewing_records WHERE media_item_id=mid;
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.rewatches WHERE media_item_id=mid),'rewatch before library deletion');
  DELETE FROM watching.media_items WHERE id=mid;
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.rewatches WHERE media_item_id=mid),'legacy rewatch cascade still works after grant restriction');
  PERFORM public.test_assert((SELECT count(*)=retained FROM watching.viewing_records WHERE work_key='movie:400' AND media_item_id IS NULL),'historical rewatch survives same deletion');
END $$;
RESET ROLE;
-- Existing explicit org/account cleanup remains distinct from ordinary library removal.
DELETE FROM public.organizations WHERE id='10000000-0000-0000-0000-000000000001';
SELECT public.test_assert((SELECT count(*)=0 FROM watching.viewing_records),'explicit org deletion can clean up retained history');
SELECT public.test_assert((SELECT count(*)=0 FROM watching.viewing_ranges),'explicit org cleanup removes its child ranges');
-- Restore only the fixture membership's organization for the separate concurrent-connection test.
INSERT INTO public.organizations VALUES('10000000-0000-0000-0000-000000000001');
