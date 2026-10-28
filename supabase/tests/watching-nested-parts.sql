-- Disposable local provider-rating fixture only; the whole block rolls back.
BEGIN;
RESET ROLE;
CREATE FUNCTION public.test_nested_facts(grown boolean) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('status','ongoing','seasons',jsonb_build_array(
  jsonb_build_object('id',99011,'number',1,'announced',3,'aired',3,'end_date','2020-01-01','episodes',
   (SELECT jsonb_agg(jsonb_build_object('id',990100+i,'number',i,'air_date','2020-01-01','aired',true)) FROM generate_series(1,3) i)),
  jsonb_build_object('id',99012,'number',2,'announced',6,'aired',CASE WHEN grown THEN 6 ELSE 2 END,'end_date',NULL,'episodes',
   (SELECT jsonb_agg(jsonb_build_object('id',990200+i,'number',i,'air_date',CASE WHEN i<=2 THEN '2020-01-01' WHEN grown THEN ((clock_timestamp() AT TIME ZONE 'UTC')::date-1)::text ELSE '2099-01-01' END,'aired',i<=2 OR grown)) FROM generate_series(1,6) i))));
$$;
INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,watched,in_progress,current_season,current_episode,season_episodes,season_aired,user_rating)
 VALUES('49000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','anime','Nested parts fixture',9901,false,true,2,2,'[3,6]',ARRAY[3,2],8.5);
SELECT watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9901','facts',public.test_nested_facts(false)));
SELECT watching.observe_provider(jsonb_build_object('provider','anilist','work_key','tv:9901',
 'facts','{"cours":[{"id":990101,"number":1,"announced":3,"start":1,"end":3},{"id":990102,"number":2,"announced":2,"start":4,"end":5},{"id":990103,"number":3,"announced":4,"start":6,"end":9}]}'::jsonb,
 'projection','{"cours":[{"anilist_id":990101,"season":1,"episodes":3,"start_episode":1,"end_episode":3},{"anilist_id":990102,"season":2,"episodes":2,"start_episode":4,"end_episode":5},{"anilist_id":990103,"season":3,"episodes":4,"start_episode":6,"end_episode":9}]}'::jsonb));
CREATE FUNCTION public.test_nested_command(kind text,num integer,score numeric) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('media_id',m.id,'operation_key',gen_random_uuid(),'expected_revision',m.personal_revision,
  'scope_kind',kind,'scope_number',num,'score',score,'action',CASE WHEN c->>'rating_id' IS NULL THEN 'INITIAL' ELSE 'CONFIRM' END,
  'previous_rating_id',c->>'rating_id','expected_scope_key',c->>'scope_key','expected_snapshot_id',c->>'provider_snapshot_id','expected_mapping_snapshot_id',c->>'mapping_snapshot_id')
 FROM watching.media_items m CROSS JOIN LATERAL jsonb_array_elements(watching.scope_rating_context(m.id)) c
 WHERE m.tmdb_id=9901 AND c->>'kind'=kind AND (c->>'number')::integer=num;
$$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT watching.scope_rating_command(public.test_nested_command('COUR',2,9));
SELECT watching.scope_rating_command(public.test_nested_command('SEASON',2,8));
DO $$ BEGIN
 PERFORM public.test_assert((SELECT episode_ids=ARRAY[990201,990202]::bigint[] FROM watching.scope_ratings WHERE scope_key='anilist-cour:990102'),'part uses S2 local episodes, not global offsets');
 BEGIN
  PERFORM watching.scope_rating_command(public.test_nested_command('COUR',3,9));
  RAISE EXCEPTION 'FAILED: unaired part rated';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '3 days' WHERE work_key='tv:9901' AND provider='tmdb';
UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '3 days' WHERE work_key='tv:9901' AND provider='tmdb';
SELECT watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9901','facts',public.test_nested_facts(true)));
SET ROLE authenticated;
DO $$ BEGIN
 PERFORM public.test_assert((SELECT c->>'validity'='CURRENT' AND (c->>'covered_episodes')::integer=2 FROM jsonb_array_elements(watching.scope_rating_context('49000000-0000-0000-0000-000000000001')) c WHERE c->>'kind'='COUR' AND c->>'number'='2'),'old part retains current frozen opinion after next part airs');
 PERFORM public.test_assert((SELECT c->>'validity'='NEEDS_RECONFIRMATION' AND (c->>'covered_episodes')::integer=2 FROM jsonb_array_elements(watching.scope_rating_context('49000000-0000-0000-0000-000000000001')) c WHERE c->>'kind'='SEASON' AND c->>'number'='2'),'enclosing season rating remains historical after growth');
 BEGIN
  PERFORM watching.scope_rating_command(public.test_nested_command('COUR',3,9));
  RAISE EXCEPTION 'FAILED: unseen part rated';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF; END;
END $$;
SELECT watching.personal_history_command(jsonb_build_object('mode','update','media_id',id,'operation_key',gen_random_uuid(),'expected_revision',personal_revision,'patch','{"current_episode":6}'::jsonb,'records','[]'::jsonb)) FROM watching.media_items WHERE tmdb_id=9901;
SELECT watching.scope_rating_command(public.test_nested_command('COUR',3,9));
SELECT public.test_assert((SELECT episode_ids=ARRAY[990203,990204,990205,990206]::bigint[] FROM watching.scope_ratings WHERE scope_key='anilist-cour:990103'),'next part freezes only S2E3 through E6');
SELECT public.test_assert((SELECT user_rating=8.5 FROM watching.media_items WHERE tmdb_id=9901),'part rating does not overwrite independent global opinion');
ROLLBACK;
SELECT 'PASS: nested TMDB season parts, exact frozen membership, growth, unseen/unaired refusal, independent opinions and rollback.';
