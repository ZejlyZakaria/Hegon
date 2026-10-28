// Owner-specific correction tested only in the disposable local Watching database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export function runCompletionDateChecks({sql,db,counts}) {
  const migration=readFileSync('supabase/migrations/20261028000000_watching_bleach_completion_date.sql','utf8');
  const replacement=JSON.parse(migration.match(/\$completion\$([\s\S]+?)\$completion\$/)[1]);
  const owner='de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64',org='26f017a1-c27f-4690-9032-317e3193373d';
  const mid='f113dc29-35b8-45d0-b501-f007f486a958',old='ebdd745a-5278-4552-877f-03e0c0861f80';
  const literal=v=>v==null?'NULL':`'${String(v).replaceAll("'","''")}'`;
  sql(db,`INSERT INTO auth.users VALUES('${owner}'); INSERT INTO public.organizations VALUES('${org}'); INSERT INTO public.memberships VALUES('${owner}','${org}');
    INSERT INTO watching.media_items(id,user_id,org_id,type,title,watched,in_progress,current_season,current_episode,season_aired,season_episodes,season_years,watched_at,viewing_date,runtime,history_version,legacy_consumption)
    VALUES('${mid}','${owner}','${org}','anime','Bleach',true,false,2,50,ARRAY[366,50],'[366,50]','{"1":2020,"2":2023}','2023-12-31 12:00:00','{"year":2026,"month":10,"day":28}',24,1,
      '{"version":1,"counts":[366,49],"runtime":24,"fallback_year":2026,"completed":false,"captured_at":"2026-10-22","storage_sizes":[366,50]}');
    DO $$ BEGIN FOR n IN 1..7 LOOP UPDATE watching.media_items SET notes=CASE WHEN n=7 THEN NULL ELSE 'fixture'||n END WHERE id='${mid}'; END LOOP; END $$;`);
  function insertRecord(r) {
    sql(db,`INSERT INTO watching.viewing_records(id,user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,year,month,day,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
      VALUES(${literal(r.id)},'${owner}','${org}','${mid}','tv:30984','Bleach','anime',${literal(r.kind)},${literal(r.scope_kind)},${literal(r.scope_key)},${literal(r.completion_basis)},${literal(r.year)},${literal(r.month)},${literal(r.day)},${literal(r.date_precision)},${literal(r.date_confidence)},${literal(r.scope_confidence)},gen_random_uuid(),0,'fixture','USER_ACTION');`);
    for(const range of r.ranges) sql(db,`INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,episode_ids,minutes,duration_basis)
      VALUES('${r.id}',${literal(range.season_key)},${range.season_number_at_recording},${range.episode_from},${range.episode_to},NULL,${range.minutes},${literal(range.duration_basis)});`);
  }
  insertRecord({...replacement,id:old,year:null,month:null,day:null,date_precision:'UNKNOWN',date_confidence:'UNKNOWN'});
  insertRecord({id:'d0081203-bef6-46cb-8aed-2d38faf5b1e0',kind:'FIRST_WATCH',scope_kind:'SEASON',scope_key:'tmdb-season:2',completion_basis:null,
    year:2026,month:10,day:28,date_precision:'DAY',date_confidence:'CONFIRMED',scope_confidence:'INFERRED',ranges:[{season_key:'tmdb-season:2',season_number_at_recording:2,episode_from:50,episode_to:50,minutes:24,duration_basis:'RUNTIME_SNAPSHOT'}]});
  const all=`SELECT md5(jsonb_build_array((SELECT jsonb_agg(m ORDER BY id) FROM watching.media_items m),(SELECT jsonb_agg(r ORDER BY id) FROM watching.viewing_records r),(SELECT jsonb_agg(v ORDER BY id) FROM watching.viewing_ranges v))::text);`;
  const other=`SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m WHERE id<>'${mid}';`;
  const untouched=`SELECT md5(jsonb_build_array((SELECT jsonb_agg(s ORDER BY id) FROM watching.scope_ratings s),(SELECT jsonb_agg(rw ORDER BY id) FROM watching.rewatches rw),(SELECT jsonb_agg(a ORDER BY org_id,user_id,achievement_key) FROM watching.achievement_unlocks a))::text);`;
  const before=sql(db,all),otherBefore=sql(db,other),untouchedBefore=sql(db,untouched),objects=sql(db,counts);
  const body=migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
  assert.throws(()=>sql(db,`BEGIN;UPDATE watching.media_items SET current_episode=49 WHERE id='${mid}';${body}`),/Bleach changed/);
  assert.equal(sql(db,all),before,'Stale repair must roll back');
  assert.throws(()=>sql(db,migration.replace('"month":10','"month":13')),/viewing_date_valid/);
  assert.equal(sql(db,all),before,'Invalid replacement must roll back its predecessor retraction');
  sql(db,migration);
  assert.equal(sql(db,other),otherBefore);assert.equal(sql(db,untouched),untouchedBefore);assert.equal(sql(db,counts),objects);
  assert.equal(sql(db,`SELECT watched_at::date FROM watching.media_items WHERE id='${mid}';`).trim(),'2026-10-28');
  assert.equal(sql(db,`SELECT season_years FROM watching.media_items WHERE id='${mid}';`).trim(),'{"1": 2020, "2": 2023}');
  assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE supersedes_id='${old}' AND year=2026 AND month=10 AND day=28 AND date_precision='DAY' AND date_confidence='CONFIRMED';`).trim(),'1');
  assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE id='${old}' AND year IS NULL AND retracted_at IS NOT NULL;`).trim(),'1');
  const fixed=sql(db,all);sql(db,migration);assert.equal(sql(db,all),fixed,'Repeated migration cannot duplicate the repair');
  sql(db,`BEGIN;
    SELECT set_config('request.jwt.claim.sub','${owner}',true);
    SELECT watching.personal_history_command(jsonb_build_object('mode','update','media_id','${mid}','operation_key',gen_random_uuid(),
      'expected_revision',(SELECT personal_revision FROM watching.media_items WHERE id='${mid}'),'patch','{"watched_at":"2027-01-01"}'::jsonb));
    DO $$ BEGIN
      IF (SELECT legacy_consumption->>'calendar_date' FROM watching.media_items WHERE id='${mid}') IS DISTINCT FROM '2023-12-31T12:00:00' THEN
        RAISE EXCEPTION 'Later projection replaced legacy calendar'; END IF;
      BEGIN
        PERFORM watching.personal_history_command(jsonb_build_object('mode','update','media_id','${mid}','operation_key',gen_random_uuid(),
          'expected_revision',(SELECT personal_revision FROM watching.media_items WHERE id='${mid}'),'patch','{"legacy_consumption":{}}'::jsonb));
        RAISE EXCEPTION 'FAIL: baseline patch accepted';
      EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Unsupported projection field: legacy_consumption%' THEN RAISE; END IF; END;
    END $$;
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    SELECT watching.personal_history_command(jsonb_build_object('mode','update','media_id','82000000-0000-0000-0000-000000000002','operation_key',gen_random_uuid(),
      'expected_revision',(SELECT personal_revision FROM watching.media_items WHERE title='Partial legacy'),'patch','{"watched_at":"2026-10-28"}'::jsonb));
    DO $$ BEGIN IF NOT (SELECT legacy_consumption ? 'calendar_date' AND legacy_consumption->'calendar_date'='null'::jsonb FROM watching.media_items WHERE title='Partial legacy') THEN
      RAISE EXCEPTION 'Missing legacy date inherited a new finish date'; END IF; END $$;
    ROLLBACK;`);
  assert.equal(sql(db,all),fixed);
  console.log('PASS: Bleach date repair, frozen predecessor retained, unchanged seasons/other media/ratings/rewatches/receipts/schema, stale and invalid-replacement rollback, repeat idempotency.');
}
