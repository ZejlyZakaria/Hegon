// Disposable loopback PostgreSQL only. Never reads production credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function runCompleteRatingChecks({sql,db,counts}) {
 const owner='00000000-0000-0000-0000-000000000001',org='10000000-0000-0000-0000-000000000001';
 const hash=()=>sql(db,"SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM watching.media_items m),(SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM watching.viewing_records v),(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM watching.scope_ratings r))::text)");
 const before=hash(),objects=JSON.parse(sql(db,counts));
 sql(db,readFileSync('supabase/migrations/20261117000000_watching_complete_scope_rating.sql','utf8'));
 assert.equal(hash(),before,'No migration backfill or personal data modification');
 assert.deepEqual(JSON.parse(sql(db,counts)),objects.map((n,i)=>n+(i===3?1:0)));
 const lit=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
 const json=q=>JSON.parse(sql(db,q));
 const actor=q=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;${q};COMMIT;`);
 const row=id=>json(`SELECT to_jsonb(m) FROM watching.media_items m WHERE id='${id}'`);
 const context=(id,kind,number)=>JSON.parse(actor(`SELECT watching.scope_rating_context('${id}')`).trim().split(/\r?\n/).find(s=>s.startsWith('['))).find(c=>c.kind===kind&&c.number===number);
 const command=(id,kind,number,score)=>{const c=context(id,kind,number);return {media_id:id,operation_key:crypto.randomUUID(),expected_revision:row(id).personal_revision,scope_kind:kind,scope_number:number,score,action:score==null?'CORRECTION':c.rating_id?'REVISE':'INITIAL',previous_rating_id:c.rating_id,expected_scope_key:c.scope_key,expected_snapshot_id:c.provider_snapshot_id,expected_mapping_snapshot_id:c.mapping_snapshot_id};};
 const rate=c=>actor(`SELECT watching.scope_rating_command(${lit(c)})`);
 const season=(number,n,aired)=>({id:99000+number,number,announced:n,aired,end_date:aired===n?'2020-01-01':null,episodes:Array.from({length:n},(_,i)=>({id:990000+number*100+i,number:i+1,air_date:i<aired?'2020-01-01':'2099-01-01',aired:i<aired}))});
 const observe=(work,provider,facts,projection)=>json(`SELECT watching.observe_provider(${lit({work_key:`tv:${work}`,provider,facts,...(projection?{projection}:{})})})`);
 const id='99000000-0000-0000-0000-000000000001';
 sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,current_season,current_episode,season_episodes,season_aired,in_progress)
 VALUES('${id}','${owner}','${org}','anime','Weekly fixture',999901,2,8,'[4,12]',ARRAY[4,8],true);`);
 assert.equal(observe(999901,'tmdb',{status:'ongoing',seasons:[season(1,4,4),season(2,12,8)]}).accepted,true,'Fixture has an accepted weekly catalogue');
 const beforeReject=hash();assert.throws(()=>rate(command(id,'SEASON',2,8)),/entire season or part must be released/);
 assert.equal(hash(),beforeReject,'Rejected rating leaves no assertion, milestone or partial projection');
 // A complete independent part inside the unfinished season remains eligible.
 const cours=[{id:991,number:1,start:1,end:4,announced:4},{id:992,number:2,start:5,end:8,announced:4},{id:993,number:3,start:9,end:16,announced:8}];
 observe(999901,'anilist',{cours},{cours:cours.map(c=>({anilist_id:c.id,season:c.number,start_episode:c.start,end_episode:c.end,episodes:c.announced,title:'Part',poster_url:null,year:2020,end_year:2020}))});
 rate(command(id,'COUR',2,9));
 assert.equal(row(id).cour_ratings['2'],9);
 assert.throws(()=>rate(command(id,'COUR',3,8)),/entire season or part must be released/);
 assert.equal(row(id).cour_ratings['2'],9,'Rejected incomplete part cannot touch the legitimate completed part');
 // Clearing an old false opinion is still permitted while a season is incomplete.
 sql(db,`UPDATE watching.media_items SET season_ratings='{"2":7}' WHERE id='${id}'`);
 rate(command(id,'SEASON',2,null));assert.deepEqual(row(id).season_ratings,{});
 // A fully aired season still requires real progress, enforced by the original transaction.
 sql(db,`UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '2 days' WHERE id=(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE work_key='tv:999901' AND provider='tmdb');UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '2 days' WHERE work_key='tv:999901' AND provider='tmdb';`);
 const full=season(2,12,12),day=sql(db,"SELECT (current_date-1)::text").trim();full.end_date=day;full.episodes.slice(8).forEach(e=>e.air_date=day);
 observe(999901,'tmdb',{status:'ongoing',seasons:[season(1,4,4),full]});
 assert.throws(()=>rate(command(id,'SEASON',2,8)),/Watch the available scope before rating/);
 sql(db,`UPDATE watching.media_items SET current_episode=12,season_aired=ARRAY[4,12] WHERE id='${id}'`);
 const complete=command(id,'SEASON',2,8.5);rate(complete);const saved=hash();rate(complete);assert.equal(hash(),saved,'Idempotent retry remains a no-op');
 assert.equal(row(id).season_ratings['2'],8.5);
 assert.equal(row(id).cour_ratings['2'],9);
 assert.equal(sql(db,"SELECT has_function_privilege('authenticated','watching.rating_scope_complete(text,text,integer)','EXECUTE')").trim(),'f');
 console.log('PASS: complete rating eligibility; no backfill; caught-up rejected; complete part preserved; clear allowed; unseen rejected; complete season accepted; idempotent retry; private helper.');
}
