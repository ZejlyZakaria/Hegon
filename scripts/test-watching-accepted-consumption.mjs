// Disposable local database only; invoked by the existing Watching rehearsal runner.
import { readFileSync } from 'node:fs';
export function runAcceptedConsumptionChecks({ sql, db, counts }) {
  sql(db, `INSERT INTO watching.media_items(id,org_id,user_id,type,title,watched,in_progress,current_season,current_episode,runtime,season_aired,season_episodes,season_years,watched_at)
    VALUES ('82000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','anime','Frozen legacy',true,false,1,170,24,ARRAY[170,0],'[170,12]','{"1":2022}','2022-02-01'),
    ('82000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','serie','Partial legacy',false,true,2,3,45,ARRAY[10,7],'[10,10]','{}',NULL),
    ('82000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','serie','No catalogue',false,true,1,3,24,NULL,NULL,'{}',NULL);`);
  const fingerprint = `SELECT md5(coalesce(string_agg((to_jsonb(m)-'legacy_consumption')::text,',' ORDER BY id),'')) FROM watching.media_items m;`;
  const historyHash = `SELECT md5(jsonb_build_array((SELECT jsonb_agg(r ORDER BY id) FROM watching.viewing_records r),(SELECT jsonb_agg(v ORDER BY id) FROM watching.viewing_ranges v),(SELECT jsonb_agg(rw ORDER BY id) FROM watching.rewatches rw),(SELECT jsonb_agg(a ORDER BY achievement_key,user_id,org_id) FROM watching.achievement_unlocks a))::text);`;
  const before = sql(db, fingerprint), assertions = sql(db, historyHash), objects = JSON.parse(sql(db, counts));
  sql(db, readFileSync('supabase/migrations/20261022000000_watching_accepted_consumption.sql', 'utf8'));
  if (before !== sql(db, fingerprint) || assertions !== sql(db, historyHash)) throw new Error('Existing personal fields, revisions, assertions or receipts changed');
  const afterObjects = JSON.parse(sql(db, counts));
  if (afterObjects.some((v, i) => v !== objects[i] + (i === 1 ? 1 : 0))) throw new Error('Expected exactly one new column');
  const baseline = JSON.parse(sql(db, `SELECT legacy_consumption FROM watching.media_items WHERE title='Frozen legacy';`));
  if (JSON.stringify(baseline.counts) !== '[170,0]' || baseline.runtime !== 24 || baseline.fallback_year !== 2022 || !baseline.completed) throw new Error('Wrong full legacy snapshot');
  const partial = JSON.parse(sql(db, `SELECT legacy_consumption FROM watching.media_items WHERE title='Partial legacy';`));
  if (JSON.stringify(partial.counts) !== '[10,3]' || partial.completed) throw new Error('Wrong partial legacy snapshot');
  if (sql(db, `SELECT legacy_consumption->>'counts' FROM watching.media_items WHERE title='No catalogue';`).trim() !== '[3]') throw new Error('Legacy progress without catalogue disappeared');
  sql(db, `UPDATE watching.media_items SET runtime=48,season_aired=ARRAY[170,12],watched=false,in_progress=true WHERE title='Frozen legacy';`);
  if (sql(db, `SELECT legacy_consumption->>'runtime' FROM watching.media_items WHERE title='Frozen legacy';`).trim() !== '24') throw new Error('Provider growth expanded legacy estimate');
  sql(db, `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    DO $$ BEGIN
      BEGIN
        UPDATE watching.media_items SET legacy_consumption='{}' WHERE title='Frozen legacy';
        RAISE EXCEPTION 'FAIL: direct baseline forgery accepted';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN
        PERFORM watching.personal_history_command(jsonb_build_object('mode','update','media_id','82000000-0000-0000-0000-000000000001',
          'operation_key',gen_random_uuid(),'expected_revision',(SELECT personal_revision FROM watching.media_items WHERE title='Frozen legacy'),'patch','{"legacy_consumption":{}}'::jsonb));
        RAISE EXCEPTION 'FAIL: RPC baseline forgery accepted';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Unsupported projection field: legacy_consumption%' THEN RAISE; END IF; END;
    END $$; RESET ROLE;
    SET ROLE service_role;
    DO $$ BEGIN
      BEGIN UPDATE watching.media_items SET legacy_consumption='{}' WHERE title='Frozen legacy';
        RAISE EXCEPTION 'FAIL: robot overwrote baseline';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END $$; RESET ROLE;`);
  const slim = JSON.parse(sql(db, `SELECT watching.receipt_source('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');`));
  if (slim.items.some(m => 'cast_members' in m || 'description' in m) || !slim.items.some(m => m.legacy_consumption)) throw new Error('Wrong receipt projection');
  // Existing writer security and freshness guards still apply after replacing the projection.
  sql(db, `SELECT watching.record_achievement_unlocks('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
    md5(watching.receipt_source('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')::text),
    '[{"achievement_key":"ever_present","metric_key":"watching:ever_present:v1","rule_version":1,"target":120,"actual_value":133}]');`);
  const evidence = JSON.parse(sql(db, `SELECT evidence FROM watching.achievement_unlocks WHERE achievement_key='ever_present';`));
  if (evidence.source !== 'WATCHING_ACCEPTED_STATS_V1' || evidence.evidence_version !== 2) throw new Error('Wrong accepted evidence provenance');
  sql(db, `DO $$ BEGIN
    IF has_function_privilege('authenticated','watching.receipt_source(uuid,uuid)','EXECUTE') OR
       has_function_privilege('authenticated','watching.record_achievement_unlocks(uuid,uuid,text,jsonb)','EXECUTE') THEN
      RAISE EXCEPTION 'Private receipt functions exposed'; END IF;
    BEGIN
      PERFORM watching.record_achievement_unlocks('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','stale','[]');
      RAISE EXCEPTION 'FAIL: stale observation accepted';
    EXCEPTION WHEN serialization_failure THEN NULL; END;
  END $$;`);
  console.log('PASS: accepted legacy coverage/runtime, unchanged personal fields/history/receipts, +1 column only, direct/RPC/robot forgery rejected, compact source and prospective accepted evidence.');
}
