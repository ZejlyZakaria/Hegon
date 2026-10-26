-- Disposable local fixtures only. No production execution.
DO $$
DECLARE facts jsonb; old_count integer; new_count integer;
BEGIN
 facts := '{"status":"ongoing","seasons":[{"id":201,"number":1,"announced":1,"aired":1,"end_date":"2022-01-01","episodes":[{"id":101,"number":1,"air_date":"2022-01-01","aired":true}]}]}'::jsonb;
 IF NOT watching.valid_provider_facts('tmdb',facts) THEN RAISE EXCEPTION 'Legacy snapshot rejected'; END IF;
 facts:=jsonb_set(facts,'{seasons,0,episodes,0,runtime}','24');
 IF NOT watching.valid_provider_facts('tmdb',facts) THEN RAISE EXCEPTION 'Positive runtime rejected'; END IF;
 IF watching.valid_provider_facts('tmdb',jsonb_set(facts,'{seasons,0,episodes,0,runtime}','-1')) OR
    watching.valid_provider_facts('tmdb',jsonb_set(facts,'{seasons,0,episodes,0,runtime}','"24"')) OR
    watching.valid_provider_facts('tmdb',jsonb_set(facts,'{seasons,0,episodes,0,runtime}','1441')) THEN RAISE EXCEPTION 'Invalid runtime accepted'; END IF;
 IF NOT watching.valid_provider_facts('tmdb',jsonb_set(facts,'{seasons,0,episodes,0,runtime}','null')) THEN RAISE EXCEPTION 'Unknown runtime rejected'; END IF;
 SELECT count(*) INTO old_count FROM watching.viewing_records;
 SELECT count(*) INTO new_count FROM watching.rewatches;
 RAISE NOTICE 'Runtime validator backwards compatible; existing records % / rewatches % untouched',old_count,new_count;
END $$;

INSERT INTO watching.media_items(id,user_id,org_id,type,title,watched,runtime,watched_at)
VALUES('91000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','film','Legacy rewatch fixture',true,120,'2020-03-01');
INSERT INTO watching.rewatches(id,user_id,org_id,media_item_id,watched_on)
VALUES('92000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','2022-03-01');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$
DECLARE cmd jsonb; result jsonb; original jsonb; failed boolean:=false;
BEGIN
 SELECT to_jsonb(m) INTO original FROM watching.media_items m WHERE id='91000000-0000-0000-0000-000000000001';
 cmd:=jsonb_build_object('mode','remove_rewatch','media_id','91000000-0000-0000-0000-000000000001','operation_key','93000000-0000-0000-0000-000000000001','expected_revision',0,'patch','{}'::jsonb,
 'rewatch_id','92000000-0000-0000-0000-000000000001','records','[{"kind":"REWATCH","scope_kind":"WHOLE_TITLE","scope_key":null,"year":2022,"month":3,"day":1,"date_precision":"DAY","date_confidence":"CONFIRMED","scope_confidence":"CONFIRMED","origin":"USER_CORRECTION","ranges":[{"season_key":"movie","season_number_at_recording":0,"episode_from":1,"episode_to":1,"episode_ids":null,"minutes":120,"duration_basis":"RUNTIME_SNAPSHOT"}]}]'::jsonb);
 BEGIN
   PERFORM watching.personal_history_command(jsonb_set(cmd,'{rewatch_id}','"92000000-0000-0000-0000-000000000099"'));
 EXCEPTION WHEN OTHERS THEN failed:=true;
 END;
 IF NOT failed OR NOT EXISTS(SELECT FROM watching.rewatches WHERE id='92000000-0000-0000-0000-000000000001') OR EXISTS(SELECT FROM watching.viewing_records WHERE media_item_id='91000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Failed replacement was not atomic'; END IF;
 result:=watching.personal_history_command(cmd);
 IF EXISTS(SELECT FROM watching.rewatches WHERE id='92000000-0000-0000-0000-000000000001') OR (SELECT count(*) FROM watching.viewing_records WHERE media_item_id='91000000-0000-0000-0000-000000000001')<>1 OR (SELECT count(*) FROM watching.rewatches WHERE media_item_id='91000000-0000-0000-0000-000000000001')<>1 THEN RAISE EXCEPTION 'Legacy replacement duplicated or lost rewatch'; END IF;
 IF (result-ARRAY['personal_revision','history_version','personal_operation_key','personal_operation_hash','updated_at']) IS DISTINCT FROM (original-ARRAY['personal_revision','history_version','personal_operation_key','personal_operation_hash','updated_at']) THEN RAISE EXCEPTION 'Replacement changed original personal state'; END IF;
 PERFORM watching.personal_history_command(cmd);
 IF (SELECT count(*) FROM watching.viewing_records WHERE media_item_id='91000000-0000-0000-0000-000000000001')<>1 THEN RAISE EXCEPTION 'Retry duplicated rewatch'; END IF;
END $$;
RESET ROLE;
UPDATE watching.media_items SET runtime=999 WHERE id='91000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT sum(r.minutes) FROM watching.viewing_ranges r JOIN watching.viewing_records v ON v.id=r.viewing_record_id WHERE v.media_item_id='91000000-0000-0000-0000-000000000001')<>120 THEN RAISE EXCEPTION 'Frozen runtime changed with metadata'; END IF;
END $$;
SELECT 'PASS: optional runtimes; legacy rewatch replacement, failure rollback, retry, unchanged posture and frozen duration.';
