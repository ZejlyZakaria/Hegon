-- Local-only synthetic work identities. No personal production data.
CREATE FUNCTION public.test_provider_facts(n integer,extra_date text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('status','ended','seasons',jsonb_build_array(
    jsonb_build_object('id',2001,'number',1,'announced',0,'aired',0,'end_date',NULL,'episodes','[]'::jsonb),
    jsonb_build_object('id',2002,'number',2,'announced',n,'aired',n,'end_date',CASE WHEN n>13 THEN extra_date ELSE '2020-01-01' END,
      'episodes',(SELECT jsonb_agg(jsonb_build_object('id',10000+i,'number',i,'air_date',CASE WHEN i>13 THEN extra_date ELSE '2020-01-01' END,'aired',true) ORDER BY i) FROM generate_series(1,n) i))));
$$;
INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,watched,current_season,current_episode,season_episodes,season_aired,season_ratings,user_rating)
VALUES
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','anime','Bleach fixture',9001,true,2,13,'[0,13]',ARRAY[0,13],'{"2":9}',8.5),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','anime','Kuroko fixture',9002,true,2,26,'[0,26]',ARRAY[0,26],'{"2":9}',8.5),
 ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','serie','Legacy fixture',9003,true,1,13,'[13]',NULL,'{"1":9}',8.5);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
CREATE FUNCTION public.test_rating_command(mid uuid,score numeric,action text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('media_id',m.id,'operation_key',gen_random_uuid(),'expected_revision',m.personal_revision,'scope_kind','SEASON','scope_number',2,'expected_scope_key','tmdb-season:2002','score',score,'action',action,
    'expected_snapshot_id',(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:'||m.tmdb_id),'expected_mapping_snapshot_id',NULL,
    'previous_rating_id',(SELECT r.id FROM watching.scope_ratings r WHERE r.media_item_id=m.id AND r.scope_kind='SEASON' AND r.scope_key='tmdb-season:2002' ORDER BY recorded_at DESC,id DESC LIMIT 1))
  FROM watching.media_items m WHERE m.id=mid;
$$;
GRANT EXECUTE ON FUNCTION public.test_rating_command(uuid,numeric,text),public.test_provider_facts(integer,text) TO authenticated,service_role;

DO $$
DECLARE f jsonb; result jsonb; baseline uuid; revision bigint; snapshot_count integer; before_rows text;
BEGIN
  -- Kuroko 26 -> 25 -> 26 retains the coherent head and every personal field.
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts',public.test_provider_facts(25,'2020-01-01')));
  PERFORM public.test_assert(result->>'classification'='REGRESSION' AND (SELECT accepted_snapshot_id IS NULL FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:9002'),'first refresh cannot downgrade a legacy catalogue baseline');
  f:=public.test_provider_facts(26,'2020-01-01');
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts',f));
  PERFORM public.test_assert(result->>'classification'='BASELINE','first coherent baseline');
  baseline:=(result->>'snapshot_id')::uuid;
  SELECT personal_revision INTO revision FROM watching.media_items WHERE tmdb_id=9002;
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts',public.test_provider_facts(25,'2020-01-01')));
  PERFORM public.test_assert(result->>'classification'='REGRESSION' AND NOT(result->>'growth')::boolean,'Kuroko regression rejected');
  PERFORM public.test_assert((SELECT accepted_snapshot_id=baseline FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:9002'),'accepted baseline retained');
  SELECT count(*) INTO snapshot_count FROM watching.provider_snapshots;
  PERFORM watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts',public.test_provider_facts(25,'2020-01-01')));
  PERFORM public.test_assert((SELECT count(*)=snapshot_count FROM watching.provider_snapshots),'repeated regression not archived again');
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts',f));
  PERFORM public.test_assert(result->>'classification'='RESTORATION' AND NOT(result->>'growth')::boolean,'restoration is not growth');
  PERFORM public.test_assert((SELECT watched AND NOT in_progress AND current_episode=26 AND personal_revision=revision FROM watching.media_items WHERE tmdb_id=9002),'no personal regression or false reopen');
  PERFORM public.test_assert((SELECT accepted_snapshot_id=baseline FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:9002'),'restoration keeps logical continuity');
  PERFORM watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts','{"status":"ended"}'::jsonb));
  PERFORM public.test_assert((SELECT accepted_snapshot_id=baseline AND refresh_outcome='FAILED' FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:9002'),'missing seasons is unknown failure, not a zero catalogue');
  PERFORM watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9002','facts','{"bad":"payload"}'::jsonb));
  PERFORM public.test_assert((SELECT accepted_snapshot_id=baseline AND refresh_outcome='FAILED' FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:9002'),'malformed response preserves head');

  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',public.test_provider_facts(13,'2020-01-01')));
  baseline:=(result->>'snapshot_id')::uuid;
  -- Local synthetic clock fixture: historical baseline predates newly published episodes.
  UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '2 days' WHERE id=baseline;
  UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '2 days' WHERE accepted_snapshot_id=baseline;
  f:=jsonb_set(public.test_provider_facts(14,((clock_timestamp() AT TIME ZONE 'UTC')::date-1)::text),'{seasons,1,episodes}','[]');
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',f));
  PERFORM public.test_assert(result->>'classification'='AMBIGUOUS','count-only growth is ambiguous');
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',public.test_provider_facts(14,'2020-01-01')));
  PERFORM public.test_assert(result->>'classification'='AMBIGUOUS','late discovery is not growth');
  PERFORM public.test_assert((SELECT watched AND NOT in_progress FROM watching.media_items WHERE tmdb_id=9001),'ambiguous change cannot reopen');
END $$;

SET ROLE authenticated;
DO $$
DECLARE c jsonb; result jsonb; before_n integer;
BEGIN
  PERFORM public.test_assert((SELECT value->>'validity'='SCOPE_UNVERIFIED' AND (value->>'score')::numeric=9 FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000003')) WHERE value->>'kind'='SEASON' AND value->>'number'='1'),'legacy score has no invented coverage');
  c:=public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'INITIAL');
  result:=watching.scope_rating_command(c);
  PERFORM public.test_assert((SELECT sum(cardinality(episode_ids))=13 FROM watching.viewing_ranges WHERE viewing_record_id=(SELECT viewing_record_id FROM watching.scope_ratings WHERE id=(result->>'rating_id')::uuid)),'frozen 13-episode coverage');
  SELECT count(*) INTO before_n FROM watching.scope_ratings;
  PERFORM watching.scope_rating_command(c);
  PERFORM public.test_assert((SELECT count(*)=before_n FROM watching.scope_ratings),'rating operation idempotent');
  BEGIN PERFORM watching.scope_rating_command(c||'{"score":8.5}'); RAISE EXCEPTION 'FAILED: payload mismatch accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF; END;
  PERFORM public.test_assert((SELECT user_rating=8.5 FROM watching.media_items WHERE tmdb_id=9001),'global rating separate');
  BEGIN UPDATE watching.scope_ratings SET score=1; RAISE EXCEPTION 'FAILED: direct rating overwrite accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM watching.observe_provider('{"provider":"tmdb","work_key":"tv:9001"}'); RAISE EXCEPTION 'FAILED: personal actor accepted as provider'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

DO $$
DECLARE result jsonb; f jsonb; original uuid; count_before integer;
BEGIN
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',public.test_provider_facts(23,((clock_timestamp() AT TIME ZONE 'UTC')::date-1)::text)));
  PERFORM public.test_assert(result->>'classification'='GROWTH' AND (result->>'growth')::boolean,'identified +10 confirmed');
  PERFORM public.test_assert((SELECT NOT watched AND in_progress AND current_episode=13 AND season_ratings->>'2'='9' FROM watching.media_items WHERE tmdb_id=9001),'growth reopens without deleting rating or progress');
  SELECT count(*) INTO count_before FROM watching.provider_snapshots;
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',public.test_provider_facts(23,((clock_timestamp() AT TIME ZONE 'UTC')::date-1)::text)));
  PERFORM public.test_assert(NOT(result->>'growth')::boolean AND (SELECT count(*)=count_before FROM watching.provider_snapshots),'same observation no snapshot/no repeated growth');
  -- Establish two stable cour identities; remapping is correction, never growth.
  f:='{"cours":[{"id":501,"number":1,"announced":13,"start":1,"end":13},{"id":502,"number":2,"announced":10,"start":14,"end":23}]}';
  result:=watching.observe_provider(jsonb_build_object('provider','anilist','work_key','tv:9001','facts',f,'projection','{"cours":[{"anilist_id":501,"season":1,"episodes":13,"start_episode":1,"end_episode":13},{"anilist_id":502,"season":2,"episodes":10,"start_episode":14,"end_episode":23}]}'::jsonb));
  PERFORM public.test_assert(result->>'classification'='BASELINE','cour baseline');
END $$;
SET ROLE authenticated;
DO $$
DECLARE c jsonb; result jsonb; first_id uuid; n integer;
BEGIN
  PERFORM public.test_assert((SELECT value->>'validity'='NEEDS_RECONFIRMATION' AND (value->>'covered_episodes')::integer=13 AND (value->>'score')::numeric=9 FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='SEASON' AND value->>'number'='2'),'Bleach old 9 pending with old coverage');
  c:=public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'CONFIRM');
  BEGIN PERFORM watching.scope_rating_command(c); RAISE EXCEPTION 'FAILED: premature confirmation'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF; END;
  SELECT watching.personal_history_command(jsonb_build_object('mode','update','media_id',id,'operation_key',gen_random_uuid(),'expected_revision',personal_revision,'patch','{"current_episode":23,"watched":true,"in_progress":false,"caught_up_at":null}'::jsonb,'records','[]'::jsonb)) INTO result FROM watching.media_items WHERE tmdb_id=9001;
  PERFORM public.test_assert((SELECT value->>'validity'='NEEDS_RECONFIRMATION' FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='SEASON' AND value->>'number'='2'),'catching up never auto-confirms');
  c:=public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'CONFIRM'); result:=watching.scope_rating_command(c); first_id:=(result->>'rating_id')::uuid;
  PERFORM public.test_assert((SELECT value->>'validity'='CURRENT' AND (value->>'covered_episodes')::integer=23 FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='SEASON' AND value->>'number'='2'),'explicit confirmation covers expanded scope');
  result:=watching.scope_rating_command(public.test_rating_command('40000000-0000-0000-0000-000000000001',8.5,'REVISE'));
  PERFORM public.test_assert((SELECT score=9 FROM watching.scope_ratings WHERE id=first_id),'previous 9 retained');
  PERFORM public.test_assert((SELECT score=8.5 AND previous_rating_id=first_id FROM watching.scope_ratings WHERE id=(result->>'rating_id')::uuid),'new explicit 8.5 assertion');
  PERFORM public.test_assert((SELECT user_rating=8.5 FROM watching.media_items WHERE tmdb_id=9001),'season revision leaves global unchanged');
  -- Restore current score 9 for the concurrency fixture, explicitly, not automatically.
  PERFORM watching.scope_rating_command(public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'REVISE'));
  c:=public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'INITIAL')||'{"scope_kind":"COUR","scope_number":1,"expected_scope_key":"anilist-cour:501","previous_rating_id":null}';
  c:=c||jsonb_build_object('expected_mapping_snapshot_id',(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='anilist' AND work_key='tv:9001'));
  PERFORM watching.scope_rating_command(c);
END $$;
RESET ROLE;
DO $$
DECLARE old_ids bigint[]; result jsonb; f jsonb; stale_command jsonb;
BEGIN
  SELECT episode_ids INTO old_ids FROM watching.scope_ratings WHERE scope_kind='COUR';
  stale_command:=public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'CONFIRM')||jsonb_build_object('scope_kind','COUR','scope_number',1,'expected_scope_key','anilist-cour:501','previous_rating_id',(SELECT id FROM watching.scope_ratings WHERE scope_key='anilist-cour:501'),'expected_mapping_snapshot_id',(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='anilist' AND work_key='tv:9001'));

  UPDATE watching.media_items SET cour_ratings=coalesce(cour_ratings,'{}')||'{"2":8.5}'::jsonb WHERE tmdb_id=9001;
  stale_command:=stale_command||jsonb_build_object('expected_revision',(SELECT personal_revision FROM watching.media_items WHERE tmdb_id=9001));
  f:='{"cours":[{"id":501,"number":2,"announced":13,"start":11,"end":23},{"id":502,"number":1,"announced":10,"start":1,"end":10}]}';
  result:=watching.observe_provider(jsonb_build_object('provider','anilist','work_key','tv:9001','facts',f,'projection','{"cours":[{"anilist_id":501,"season":2,"episodes":13,"start_episode":11,"end_episode":23},{"anilist_id":502,"season":1,"episodes":10,"start_episode":1,"end_episode":10}]}'::jsonb));
  PERFORM public.test_assert(result->>'classification'='CORRECTION' AND NOT(result->>'growth')::boolean,'cour remapping is not growth');
  BEGIN
    PERFORM watching.scope_rating_command(stale_command);
    RAISE EXCEPTION 'FAILED: stale cour click accepted';
  EXCEPTION WHEN serialization_failure THEN
    IF SQLERRM<>'Stale scope identity' THEN RAISE; END IF;
  END;
  PERFORM public.test_assert((SELECT count(*)=1 FROM watching.scope_ratings WHERE scope_kind='COUR'),'blocked stale cour click creates no assertion');

  PERFORM public.test_assert((SELECT value->>'score' IS NULL AND value->>'validity'='UNRATED' FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='COUR' AND value->>'number'='1'),'known old cour opinion cannot be rebound by legacy ordinal fallback');
  PERFORM public.test_assert((SELECT episode_ids=old_ids AND scope_key='anilist-cour:501' AND scope_number_at_recording=1 FROM watching.scope_ratings WHERE scope_kind='COUR'),'frozen cour rating membership not rebound');
  BEGIN
    PERFORM watching.observe_provider(jsonb_build_object('provider','anilist','work_key','tv:9001','facts','{"cours":[{"id":501,"number":1,"announced":13,"start":1,"end":13},{"id":502,"number":2,"announced":10,"start":14,"end":23}]}'::jsonb,'projection','{"cours":[]}'::jsonb));
    RAISE EXCEPTION 'FAILED: invalid cache projection accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF; END;
  PERFORM public.test_assert((SELECT (facts->'cours'->0->>'id')::integer=502 FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.provider='anilist' AND h.work_key='tv:9001'),'cache failure rolls back accepted pointer and snapshot');
  PERFORM public.test_assert((SELECT jsonb_array_length(cours)=2 FROM watching.anime_cours WHERE tmdb_id=9001),'invalid projection preserves accepted cache');

  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9005','facts',public.test_provider_facts(13,'2020-01-01')));
  UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '3 days' WHERE id=(result->>'snapshot_id')::uuid;
  UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '3 days' WHERE provider='tmdb' AND work_key='tv:9005';
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9005','facts',public.test_provider_facts(13,'2020-01-01')));
  result:=watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9005','facts',public.test_provider_facts(14,((clock_timestamp() AT TIME ZONE 'UTC')::date-1)::text)));
  PERFORM public.test_assert(result->>'classification'='AMBIGUOUS','no-op checks advance trusted time without snapshots; late discovery is not growth');
  -- Move accepted observation time back only in this local synthetic fixture, for a race.
  UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '1 day' WHERE provider='tmdb' AND work_key='tv:9001';
  UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '1 day' WHERE id=(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:9001');
END $$;
SET ROLE authenticated;
DO $$
DECLARE c jsonb; result jsonb; ctx jsonb;
BEGIN
  SELECT value INTO ctx FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='COUR' AND value->>'number'='1';
  c:=public.test_rating_command('40000000-0000-0000-0000-000000000001',8,'INITIAL')||jsonb_build_object('scope_kind','COUR','scope_number',1,'expected_scope_key',ctx->>'scope_key','expected_mapping_snapshot_id',ctx->>'mapping_snapshot_id','previous_rating_id',NULL);
  result:=watching.scope_rating_command(c);
  PERFORM public.test_assert((SELECT scope_key='anilist-cour:502' AND action='INITIAL' AND previous_rating_id IS NULL AND score=8 FROM watching.scope_ratings WHERE id=(result->>'rating_id')::uuid),'new cour opinion never inherits old ordinal score');
  PERFORM public.test_assert((SELECT score=9 AND cardinality(episode_ids)=13 FROM watching.scope_ratings WHERE scope_key='anilist-cour:501'),'original cour opinion and frozen coverage preserved after new scope edit');
  PERFORM public.test_assert(NOT EXISTS(SELECT 1 FROM watching.scope_ratings WHERE scope_key='legacy-cour:1'),'known old cour score is not copied as unrelated legacy opinion');
  SELECT value INTO ctx FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='COUR' AND value->>'number'='2';
  c:=public.test_rating_command('40000000-0000-0000-0000-000000000001',NULL,'CORRECTION')||jsonb_build_object('scope_kind','COUR','scope_number',2,'expected_scope_key',ctx->>'scope_key','expected_mapping_snapshot_id',ctx->>'mapping_snapshot_id','previous_rating_id',ctx->>'rating_id');
  PERFORM watching.scope_rating_command(c);
  PERFORM public.test_assert((SELECT score=8.5 AND episode_ids IS NULL AND viewing_record_id IS NULL FROM watching.scope_ratings WHERE scope_key='legacy-cour:2'),'overwriting a remapped slot retains its unbound legacy opinion without invented coverage');

END $$;
RESET ROLE;
SELECT 'PASS: Kuroko, identity/date growth, ambiguous/late discovery, Bleach, append-only ratings, legacy, permissions, failure and cour remapping.';

SET ROLE service_role;
DO $$ BEGIN
  BEGIN UPDATE watching.provider_snapshots SET reason_code='REWRITTEN'; RAISE EXCEPTION 'FAILED: direct provider history overwrite'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM watching.scope_rating_command('{}'); RAISE EXCEPTION 'FAILED: robot rating write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
  PERFORM public.test_assert((SELECT count(*)=0 FROM watching.scope_ratings WHERE user_id='00000000-0000-0000-0000-000000000001'),'foreign scoped opinions hidden by RLS');
  BEGIN PERFORM watching.scope_rating_context('40000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'FAILED: cross-user scope read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
