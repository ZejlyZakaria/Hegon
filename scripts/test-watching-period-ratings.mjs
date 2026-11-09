// Disposable loopback database only; no production calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function runPeriodRatingChecks({sql,db,counts}) {
 const owner='00000000-0000-0000-0000-000000000001',org='10000000-0000-0000-0000-000000000001';
 const hash=()=>sql(db,"SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM watching.media_items m),(SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM watching.viewing_records v),(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM watching.scope_ratings r))::text)");
 const before=hash(),objects=JSON.parse(sql(db,counts));
 sql(db,readFileSync('supabase/migrations/20261108000000_watching_period_rating_basis.sql','utf8'));
 assert.equal(hash(),before,'No deployment backfill or user-data changes');
 assert.deepEqual(JSON.parse(sql(db,counts)),objects.map((n,i)=>n+(i===3?5:0)));
 const lit=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
 const json=q=>JSON.parse(sql(db,q));
 const actor=q=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;${q};COMMIT;`);
 const basis=()=>JSON.parse(actor(`SELECT watching.global_rating_bases('${org}')`).trim().split(/\r?\n/).filter(s=>s.startsWith('{')).at(-1));
 const season=(number,n)=>({id:77000+number,number,announced:n,aired:n,end_date:'2020-01-01',episodes:Array.from({length:n},(_,i)=>({id:770000+number*100+i,number:i+1,air_date:'2020-01-01',aired:true}))});
 const observe=(work,seasons)=>json(`SELECT watching.observe_provider(${lit({work_key:`tv:${work}`,provider:'tmdb',facts:{status:'ended',seasons}})})`);
 const insert=(id,work,sizes,type='serie')=>sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,user_rating,watched,current_season,current_episode,season_episodes,season_aired,season_years)
 VALUES('${id}','${owner}','${org}','${type}','Legacy opinion',${work},8.5,true,${sizes.length},${sizes.at(-1)},'${JSON.stringify(sizes)}',ARRAY[${sizes.join(',')}],'${JSON.stringify(Object.fromEntries(sizes.map((_,i)=>[i+1,2026])))}');`);
 const single='98000000-0000-0000-0000-000000000001',whole='98000000-0000-0000-0000-000000000002',anime='98000000-0000-0000-0000-000000000003';
 insert(single,999801,[6]);observe(999801,[season(1,6)]);
 insert(whole,999802,[4,3]);observe(999802,[season(1,4),season(2,3)]);
 insert(anime,999803,[6],'anime');observe(999803,[season(1,6)]);
 assert.equal(basis()[single].kind,'SEASON');assert.equal(basis()[whole].kind,'WHOLE_TITLE');
 assert.equal(basis()[anime],undefined,'Unknown mapping cannot prove an anime opinion');
 json(`SELECT watching.observe_provider(${lit({work_key:'tv:999803',provider:'anilist',facts:{cours:[{id:77888,number:1,start:1,end:6,announced:6}]},projection:{cours:[{anilist_id:77888,season:1,start_episode:1,end_episode:6,episodes:6,title:'Part',poster_url:null,year:2020,end_year:2020}]}})})`);
 assert.equal(basis()[anime].kind,'COUR');assert.equal(basis()[anime].key,'anilist-cour:77888');
 const readBefore=hash();basis();assert.equal(hash(),readBefore,'Batch read is genuinely read-only');
 assert.equal(sql(db,"SELECT has_function_privilege('authenticated','watching.capture_global_opinion(jsonb,boolean)','EXECUTE')").trim(),'f');
 assert.deepEqual(JSON.parse(actor("SELECT watching.global_rating_bases('10000000-0000-0000-0000-000000000099')").trim().split(/\r?\n/).find(s=>s==='{}')),{});
 // Freeze the old accepted membership before S2/S3 is accepted.
 for(const [id,work,old,newer] of [[single,999801,[season(1,6)],season(2,2)],[whole,999802,[season(1,4),season(2,3)],season(3,2)]]) {
  sql(db,`UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '2 days' WHERE id=(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE work_key='tv:${work}' AND provider='tmdb');UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '2 days' WHERE work_key='tv:${work}' AND provider='tmdb';`);
  const day=sql(db,"SELECT (current_date-1)::text").trim();newer.end_date=day;newer.episodes.forEach(e=>e.air_date=day);
  observe(work,[...old,newer]);
  const ratings=json(`SELECT jsonb_agg(to_jsonb(r)) FROM watching.scope_ratings r WHERE media_item_id='${id}'`);
  assert.equal(ratings.length,1);assert.equal(ratings[0].score,8.5);assert.equal(ratings[0].episode_ids.length,old.reduce((n,s)=>n+s.aired,0));
  const records=json(`SELECT jsonb_agg(to_jsonb(v)) FROM watching.viewing_records v WHERE media_item_id='${id}'`);
  assert.equal(records.length,1);assert.equal(records[0].kind,'COMPLETION');assert.equal(records[0].year,null);assert.equal(records[0].date_precision,'UNKNOWN');
  assert.equal(sql(db,`SELECT sum(minutes) FROM watching.viewing_ranges WHERE viewing_record_id='${records[0].id}'`).trim(),'0');
  observe(work,[...old,newer]);assert.equal(sql(db,`SELECT count(*) FROM watching.scope_ratings WHERE media_item_id='${id}'`).trim(),'1','Identical refresh cannot duplicate a binding');
 }
 const contexts=JSON.parse(actor(`SELECT watching.scope_rating_context('${single}')`).trim().split(/\r?\n/).find(s=>s.startsWith('[')));
 assert.equal(contexts.find(c=>c.kind==='SEASON'&&c.number===1).score,8.5);assert.equal(contexts.find(c=>c.kind==='SEASON'&&c.number===2).score,null);
 // A correction invalidates the old opinion; moving forward does not resurrect it.
 const update=(id,patch)=>{const revision=sql(db,`SELECT personal_revision FROM watching.media_items WHERE id='${id}'`).trim();actor(`SELECT watching.personal_history_command(${lit({mode:'update',history_intent:'correction',media_id:id,operation_key:crypto.randomUUID(),expected_revision:Number(revision),patch,records:[],retract_ids:[]})})`);};
 update(single,{current_season:1,current_episode:3,watched:false,in_progress:true});
 assert.equal(sql(db,`SELECT score IS NULL FROM watching.scope_ratings WHERE media_item_id='${single}' ORDER BY recorded_at DESC,id DESC LIMIT 1`).trim(),'t');
 update(single,{current_season:1,current_episode:6});
 const latest=sql(db,`SELECT score IS NULL FROM watching.scope_ratings WHERE media_item_id='${single}' ORDER BY recorded_at DESC,id DESC LIMIT 1`).trim();assert.equal(latest,'t');
 update(whole,{user_rating:null});
 assert.equal(sql(db,`SELECT score IS NULL FROM watching.scope_ratings WHERE media_item_id='${whole}' ORDER BY recorded_at DESC,id DESC LIMIT 1`).trim(),'t');
 console.log('PASS: period rating basis: no backfill; isolated read; season/cour/whole identities; catalogue growth, no invented dates/hours, duplicate refresh, rollback tombstones and clear.');
}
