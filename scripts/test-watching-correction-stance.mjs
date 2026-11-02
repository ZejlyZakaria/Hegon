// Real loopback PostgreSQL only, invoked by the disposable history rehearsal.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function runCorrectionStanceChecks({sql,db,counts}) {
 const hash=()=>sql(db,"SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m;");
 const before=hash(),objects=sql(db,counts),acl=sql(db,"SELECT proacl,prosecdef,proconfig FROM pg_proc WHERE oid='watching.personal_history_command(jsonb)'::regprocedure;");
 sql(db,readFileSync('supabase/migrations/20261102000000_watching_correction_stance.sql','utf8'));
 assert.equal(hash(),before,'No backfill');assert.equal(sql(db,counts),objects,'No schema object-count delta');
 assert.equal(sql(db,"SELECT proacl,prosecdef,proconfig FROM pg_proc WHERE oid='watching.personal_history_command(jsonb)'::regprocedure;"),acl,'Grants/security context unchanged');
 const owner='00000000-0000-0000-0000-000000000001',org='10000000-0000-0000-0000-000000000001';
 const lit=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
 const row=id=>JSON.parse(sql(db,`SELECT to_jsonb(m) FROM watching.media_items m WHERE id='${id}';`));
 const run=c=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;SELECT watching.personal_history_command(${lit(c)});COMMIT;`);
 let n=0;
 for(const type of ['serie','anime']) for(const stance of ['paused','dropped']) {
  n++;const id=`a6110200-0000-0000-0000-${String(n).padStart(12,'0')}`;
  sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,tmdb_id,title,status,current_season,current_episode,season_episodes,season_aired,season_years,season_ratings,paused,dropped,drop_reason,in_progress,watched,user_rating,notes,watched_at,last_watched_at)
   VALUES('${id}','${owner}','${org}','${type}',994000+${n},'Suspended fixture','ended',2,4,'[5,5]',ARRAY[5,5],'{"1":2020,"2":2021}','{"1":8,"2":9}',${stance==='paused'},${stance==='dropped'},${stance==='dropped'?"'lost_interest'":"NULL"},false,false,8.5,'Kept note','2021-12-31','2021-12-31');`);
  const original=row(id),cmd=patch=>({mode:'update',media_id:id,operation_key:crypto.randomUUID(),expected_revision:row(id).personal_revision,history_intent:'correction',patch,records:[],retract_ids:[],reason:'Local suspended-position regression'});
  for(const bad of [{watched:true},{in_progress:true},{[stance]:false},{[stance]:null},{last_watched_at:'2026-11-02'},{watched_at:'2026-11-02'},...(stance==='dropped'?[{drop_reason:null}]:[])]) {
    assert.throws(()=>run(cmd({current_episode:5,...bad})),/Correcting position preserves/);
    assert.deepEqual(row(id),original,'Rejected command is atomic');
  }
  const forward=cmd({current_episode:5});run(forward);const after=row(id);run(forward);assert.deepEqual(row(id),after,'Retry idempotence');
  assert.equal(after[stance],true);assert.equal(after.in_progress,false);assert.equal(after.watched,false);assert.equal(after.drop_reason,original.drop_reason);
  for(const key of ['watched_at','last_watched_at','season_years','season_ratings','user_rating','notes']) assert.deepEqual(after[key],original[key]);
  run(cmd({current_season:1,current_episode:5}));const back=row(id);assert.equal(back[stance],true);assert.equal(back.watched,false);assert.equal(back.user_rating,8.5);assert.equal(back.notes,'Kept note');
  assert.deepEqual(back.season_ratings,{'1':8});assert.deepEqual(back.season_years,{'1':2020});
  assert.equal(Number(sql(db,`SELECT count(*) FROM watching.progress_corrections WHERE media_item_id='${id}';`).trim()),1,'Backward audit retained');
  const resume={...cmd({paused:false,dropped:false,drop_reason:null,in_progress:true}),history_intent:'claim'};run(resume);assert.equal(row(id).in_progress,true);assert.equal(row(id).paused,false);assert.equal(row(id).dropped,false);
 }
 console.log('PASS correction stance:4type/stance combinations; terminal/backward/resume; rejected writes, audit, dates, ratings, idempotence, grants and zero backfill');
}
