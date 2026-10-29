// Real disposable PostgreSQL only; invoked by the loopback-only receipt rehearsal.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

export function runBackwardCorrectionChecks({sql,db,counts}) {
  const before=sql(db,counts);
  const mediaHash=()=>sql(db,"SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m;");
  const untouched=mediaHash();
  sql(db,readFileSync('supabase/migrations/20261029000000_watching_backward_correction.sql','utf8'));
  assert.equal(mediaHash(),untouched,'Migration must not backfill personal data');
  console.log('Backward correction object counts:',before.trim(),'->',sql(db,counts).trim());
  const owner='00000000-0000-0000-0000-000000000001',org='10000000-0000-0000-0000-000000000001';
  const mid='93000000-0000-0000-0000-000000000001',first='93000000-0000-0000-0000-000000000011',completion='93000000-0000-0000-0000-000000000012';
  const op='93000000-0000-0000-0000-000000000021';
  const lit=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
  const command=(id,patch,operation=crypto.randomUUID())=>({mode:'update',media_id:id,operation_key:operation,
    expected_revision:Number(sql(db,`SELECT personal_revision FROM watching.media_items WHERE id='${id}';`).trim()),
    history_intent:'correction',patch,records:[],retract_ids:[],reason:'Regression fixture correction'});
  const run=c=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;SELECT watching.personal_history_command(${lit(c)});COMMIT;`);
  const row=id=>JSON.parse(sql(db,`SELECT to_jsonb(m) FROM watching.media_items m WHERE id='${id}';`));
  sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,tmdb_id,title,current_season,current_episode,season_aired,season_episodes,season_years,season_ratings,watched_at,viewing_date,legacy_consumption,in_progress)
    VALUES('${mid}','${owner}','${org}','anime',993001,'Backward fixture',3,12,ARRAY[12,12,12,12],'[12,12,12,12]',
      '{"1":2017,"2":2018,"3":2019}','{"1":8.5,"2":9,"3":7.5}','2019-12-31 12:00:00','{"year":2019,"month":12,"day":31}',
      '{"version":1,"counts":[12,12,12,0],"storage_sizes":[12,12,12,12],"runtime":24,"fallback_year":2019,"completed":false,"captured_at":"2026-01-01"}',true);
    INSERT INTO watching.viewing_records(id,user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,year,month,day,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
    VALUES('${first}','${owner}','${org}','${mid}','tv:993001','Fixture','anime','FIRST_WATCH','SEASON','tmdb-season:3',NULL,2019,12,31,'DAY','CONFIRMED','CONFIRMED',gen_random_uuid(),0,'fixture','USER_ACTION'),
      ('${completion}','${owner}','${org}','${mid}','tv:993001','Fixture','anime','COMPLETION','SEASON','tmdb-season:3','AVAILABLE_SCOPE',NULL,NULL,NULL,'UNKNOWN','UNKNOWN','CONFIRMED',gen_random_uuid(),0,'fixture','USER_ACTION');
    INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,minutes,duration_basis)
      VALUES('${first}','tmdb-season:3',3,1,12,288,'RUNTIME_SNAPSHOT');
    INSERT INTO watching.scope_ratings(user_id,org_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,score,viewing_record_id,action,operation_key,operation_hash)
      VALUES('${owner}','${org}','${mid}','tv:993001','SEASON','tmdb-season:3',3,7.5,'${completion}','INITIAL',gen_random_uuid(),'fixture');`);
  sql(db,`INSERT INTO watching.viewing_records(user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,year,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
    VALUES('${owner}','${org}','${mid}','tv:993001','Fixture','anime','COMPLETION','SEASON','tmdb-season:1','AVAILABLE_SCOPE',2017,'YEAR','CONFIRMED','CONFIRMED',gen_random_uuid(),0,'keep-s1','USER_ACTION'),
      ('${owner}','${org}','${mid}','tv:993001','Fixture','anime','REWATCH','UNKNOWN',NULL,NULL,NULL,'UNKNOWN','UNKNOWN','UNKNOWN',gen_random_uuid(),0,'keep-rewatch','USER_ACTION');`);
  const original=row(mid),c=command(mid,{current_season:2,current_episode:12},op);
  assert.throws(()=>run({...c,operation_key:crypto.randomUUID(),expected_revision:c.expected_revision+1}),/Stale personal revision/);
  assert.deepEqual(row(mid),original,'Stale correction cannot partially clean anything');
  run(c);
  const after=row(mid);
  assert.deepEqual(after.season_years,{'1':2017,'2':2018});assert.deepEqual(after.season_ratings,{'1':8.5,'2':9});
  assert.equal(after.watched_at,null);assert.equal(after.viewing_date,null);
  assert.deepEqual(after.legacy_consumption.counts,[12,12,0,0]);assert.equal(after.legacy_consumption.calendar_date,null);
  assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE id IN ('${first}','${completion}') AND retracted_at IS NOT NULL;`).trim(),'2','Includes completion without ranges');
  assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE media_item_id='${mid}' AND operation_hash IN ('keep-s1','keep-rewatch') AND retracted_at IS NULL;`).trim(),'2','Earlier completion and independent rewatch survive');
  assert.equal(sql(db,`SELECT count(*) FROM watching.scope_ratings WHERE media_item_id='${mid}' AND score IS NULL AND previous_rating_id IS NOT NULL;`).trim(),'1');
  const audit=JSON.parse(sql(db,`SELECT before_state FROM watching.progress_corrections WHERE operation_key='${op}';`));
  assert.deepEqual(audit,original,'Exact original is retained');
  run(c);assert.deepEqual(row(mid),after,'Retry must be idempotent');
  assert.throws(()=>run({...c,patch:{current_season:1,current_episode:1}}),/different input/);
  run(command(mid,{current_season:3,current_episode:1}));
  assert.equal(row(mid).season_ratings['3'],undefined,'Advancing cannot revive false score');
  assert.equal(row(mid).legacy_consumption.counts[2],0,'False legacy consumption cannot revive');
  run(c);assert.equal(row(mid).current_episode,1,'Retry after a later action cannot rewind it');
  for(const stance of ['paused','dropped']) {
    sql(db,`UPDATE watching.media_items SET current_season=3,current_episode=12,paused=${stance==='paused'},dropped=${stance==='dropped'},season_years='{"1":2017,"2":2018,"3":2019}',season_ratings='{"1":8.5,"2":9,"3":7.5}' WHERE id='${mid}';`);
    run(command(mid,{current_season:2,current_episode:12}));
    assert.equal(row(mid)[stance],true);assert.equal(row(mid).season_ratings['3'],undefined);
  }

  const finishedMid='93000000-0000-0000-0000-000000000004';
  sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,tmdb_id,title,watched,in_progress,current_season,current_episode,season_aired,season_episodes,season_years,watched_at)
    VALUES('${finishedMid}','${owner}','${org}','serie',993004,'Full correction',true,false,3,12,ARRAY[12,12,12],'[12,12,12]','{"1":2017,"2":2018,"3":2019}','2019-12-31');
    INSERT INTO watching.viewing_records(user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,completion_basis,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
      VALUES('${owner}','${org}','${finishedMid}','tv:993004','Full','serie','COMPLETION','WHOLE_TITLE','FINISHED_TITLE','UNKNOWN','UNKNOWN','UNKNOWN',gen_random_uuid(),0,'coarse-full','USER_ACTION');`);
  run(command(finishedMid,{current_season:2,current_episode:12,watched:false,in_progress:true}));
  assert.equal(row(finishedMid).watched,false);assert.equal(row(finishedMid).watched_at,null);
  assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE media_item_id='${finishedMid}' AND retracted_at IS NULL;`).trim(),'0');

  // Flat storage/cour display: remove only cour3 and retain actual cour1/cour2.
  const courMid='93000000-0000-0000-0000-000000000002';
  const cours=[1,2,3].map(n=>({season:n,anilist_id:993100+n,start_episode:(n-1)*12+1,end_episode:n*12,episodes:12,year:2020+n}));
  sql(db,`INSERT INTO watching.anime_cours(tmdb_id,source,cours) VALUES(993002,'anilist',${lit(cours)});
    INSERT INTO watching.media_items(id,user_id,org_id,type,tmdb_id,title,current_season,current_episode,season_aired,season_episodes,cour_years,cour_ratings,in_progress)
    VALUES('${courMid}','${owner}','${org}','anime',993002,'Cour correction',1,36,ARRAY[36],'[36]','{"1":2020,"2":2021,"3":2022}','{"1":8,"2":9,"3":7}',true);`);
  run(command(courMid,{current_season:1,current_episode:24}));
  assert.deepEqual(row(courMid).cour_years,{'1':2020,'2':2021});assert.deepEqual(row(courMid).cour_ratings,{'1':8,'2':9});
  // The exact same legacy ordinal without a reliable mapping must remain unknown, not deleted.
  sql(db,`UPDATE watching.media_items SET current_episode=36,cour_years='{"3":2022}',cour_ratings='{"3":7}' WHERE id='${courMid}';DELETE FROM watching.anime_cours WHERE tmdb_id=993002;`);
  run(command(courMid,{current_episode:24}));assert.deepEqual(row(courMid).cour_ratings,{'3':7});
  // A frozen old identity can now sit at a later ordinal: membership, not ordinal, wins.
  sql(db,`UPDATE watching.media_items SET current_episode=36 WHERE id='${courMid}';
    INSERT INTO watching.viewing_records(id,user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
      VALUES('93000000-0000-0000-0000-000000000032','${owner}','${org}','${courMid}','tv:993002','Kept old cour','anime','COMPLETION','COUR','anilist-cour:993900','AVAILABLE_SCOPE','UNKNOWN','UNKNOWN','CONFIRMED',gen_random_uuid(),0,'old-cour','USER_ACTION');
    INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,minutes,duration_basis)
      VALUES('93000000-0000-0000-0000-000000000032','tmdb-season:1',1,1,12,0,'MILESTONE');
    INSERT INTO watching.scope_ratings(user_id,org_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,score,viewing_record_id,action,operation_key,operation_hash)
      VALUES('${owner}','${org}','${courMid}','tv:993002','COUR','anilist-cour:993900',3,7,'93000000-0000-0000-0000-000000000032','INITIAL',gen_random_uuid(),'old-cour');`);
  run(command(courMid,{current_episode:24}));
  assert.deepEqual(row(courMid).cour_ratings,{'3':7});assert.deepEqual(row(courMid).cour_years,{'3':2022});

  // R1: two stable identities can share BOTH ordinal3 and score7. The valid identity
  // retains its projection regardless of which identity was recorded most recently.
  const retainedHash=()=>sql(db,`SELECT md5(jsonb_build_array(
    (SELECT to_jsonb(r) FROM watching.scope_ratings r WHERE media_item_id='${courMid}' AND scope_key='anilist-cour:993900'),
    (SELECT to_jsonb(v) FROM watching.viewing_records v WHERE id='93000000-0000-0000-0000-000000000032'))::text);`);
  for(const [score,newest] of [[7,false],[7,true],[6,false],[6,true]]) {
    const badRecord=crypto.randomUUID(),badKey=`anilist-cour:${994900+Number(newest)+score*10}`;
    const originalKept=retainedHash();
    sql(db,`UPDATE watching.media_items SET current_episode=36 WHERE id='${courMid}';
      INSERT INTO watching.viewing_records(id,user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,date_precision,date_confidence,scope_confidence,recorded_at,operation_key,operation_index,operation_hash,origin)
        VALUES('${badRecord}','${owner}','${org}','${courMid}','tv:993002','Invalid other identity','anime','COMPLETION','COUR','${badKey}','AVAILABLE_SCOPE','UNKNOWN','UNKNOWN','CONFIRMED',${newest?'clock_timestamp()':"'2020-01-01'::timestamptz"},gen_random_uuid(),0,'invalid-other','USER_ACTION');
      INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,minutes,duration_basis)
        VALUES('${badRecord}','tmdb-season:1',1,25,36,0,'MILESTONE');
      INSERT INTO watching.scope_ratings(user_id,org_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,score,viewing_record_id,action,operation_key,operation_hash,recorded_at)
        VALUES('${owner}','${org}','${courMid}','tv:993002','COUR','${badKey}',3,${score},'${badRecord}','INITIAL',gen_random_uuid(),'invalid-other',${newest?'clock_timestamp()':"'2020-01-01'::timestamptz"});`);
    const correction=command(courMid,{current_episode:24});run(correction);
    assert.deepEqual(row(courMid).cour_ratings,{'3':7},`R1: score=${score}, invalid newer=${newest}`);
    assert.deepEqual(row(courMid).cour_years,{'3':2022});
    assert.equal(retainedHash(),originalKept,'The valid stable opinion and its completion must be byte-identical');
    assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE id='${badRecord}' AND retracted_at IS NOT NULL;`).trim(),'1');
    assert.equal(sql(db,`SELECT count(*) FROM watching.scope_ratings clear JOIN watching.scope_ratings old ON clear.previous_rating_id=old.id
      WHERE old.media_item_id='${courMid}' AND old.scope_key='${badKey}' AND old.score=${score} AND clear.score IS NULL AND clear.scope_key=old.scope_key AND clear.action='CORRECTION';`).trim(),'1');
    const journal=JSON.parse(sql(db,`SELECT jsonb_build_array(before_state->'cour_ratings',after_state->'cour_ratings') FROM watching.progress_corrections WHERE operation_key='${correction.operation_key}';`));
    assert.deepEqual(journal,[{'3':7},{'3':7}]);
    const fixed=row(courMid);run(correction);assert.deepEqual(row(courMid),fixed);
  }
  console.log('PASS: R1 exact {"3":7} retained across same-score/different-identity collision, both timestamp orders and different-score controls; invalid lineage cleared with audit.');
  // Preserving a valid/unknown subject must not become unconditional preservation:
  // when the last live subject is invalid, old NULL clears are not legitimate support.
  sql(db,`UPDATE watching.media_items SET current_episode=36 WHERE id='${courMid}';
    UPDATE watching.viewing_ranges SET episode_from=25,episode_to=36 WHERE viewing_record_id='93000000-0000-0000-0000-000000000032';`);
  run(command(courMid,{current_episode:24}));
  assert.deepEqual(row(courMid).cour_ratings,{});assert.deepEqual(row(courMid).cour_years,{});

  // A bounded partial correction retains only genuinely watched episodes and original precision.
  const partialMid='93000000-0000-0000-0000-000000000003',partialFirst='93000000-0000-0000-0000-000000000031';
  sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,tmdb_id,title,current_season,current_episode,season_aired,season_episodes,season_years,season_ratings,in_progress)
    VALUES('${partialMid}','${owner}','${org}','serie',993003,'Partial correction',1,12,ARRAY[12],'[12]','{"1":2020}','{"1":9}',true);
    INSERT INTO watching.viewing_records(id,user_id,org_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,year,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
    VALUES('${partialFirst}','${owner}','${org}','${partialMid}','tv:993003','Partial','serie','FIRST_WATCH','SEASON','tmdb-season:1',2020,'YEAR','CONFIRMED','CONFIRMED',gen_random_uuid(),0,'fixture','USER_ACTION');
    INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,minutes,duration_basis)
      VALUES('${partialFirst}','tmdb-season:1',1,1,12,288,'RUNTIME_SNAPSHOT');
    INSERT INTO watching.scope_ratings(user_id,org_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,score,viewing_record_id,action,operation_key,operation_hash)
      VALUES('${owner}','${org}','${partialMid}','tv:993003','SEASON','tmdb-season:1',1,9,'${partialFirst}','INITIAL',gen_random_uuid(),'fixture');`);
  run(command(partialMid,{current_episode:5}));
  assert.deepEqual(row(partialMid).season_years,{'1':2020});assert.deepEqual(row(partialMid).season_ratings,{});
  assert.equal(sql(db,`SELECT v.episode_to||':'||v.minutes||':'||r.date_precision FROM watching.viewing_records r JOIN watching.viewing_ranges v ON v.viewing_record_id=r.id WHERE r.media_item_id='${partialMid}' AND r.retracted_at IS NULL;`).trim(),'5:120.0000000000000000:YEAR');
  // No status predicate: the same behavior applies independently of dropped/paused.
  assert.equal(after.dropped,original.dropped);assert.equal(after.paused,original.paused);
  assert.throws(()=>sql(db,`SET ROLE authenticated;INSERT INTO watching.progress_corrections SELECT * FROM watching.progress_corrections LIMIT 1;`),/permission denied/);
  assert.equal(sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);SET LOCAL ROLE authenticated;SELECT count(*) FROM watching.progress_corrections;COMMIT;`).trim().split('\n').at(-2).trim(),'0');
  console.log('PASS: backwards seasons/cours, coarse completion, immutable audit/retry, frozen partial preservation, exclusive calendar invalidation, no score/legacy resurrection, unknown mapping preservation and RLS.');
}
