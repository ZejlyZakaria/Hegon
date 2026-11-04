// Disposable loopback PostgreSQL only. Never connects to production.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function runTrackingIntentChecks({sql,db,counts}) {
 const owner='00000000-0000-0000-0000-000000000001',org='10000000-0000-0000-0000-000000000001';
 const lit=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
 const hash=()=>sql(db,"SELECT md5(coalesce(string_agg((to_jsonb(m)-'resume_required')::text,',' ORDER BY id),'')) FROM watching.media_items m;");
 if(sql(db,"SELECT to_regprocedure('watching.people_ranking(text,integer,integer,uuid)') IS NULL;").trim()==='t') sql(db,readFileSync('supabase/migrations/20260917000000_people_ranking.sql','utf8'));
 const before=hash(),objects=JSON.parse(sql(db,counts));
 const acl=()=>sql(db,"SELECT json_agg(json_build_array(proname,proacl,prosecdef,proconfig) ORDER BY proname) FROM pg_proc WHERE oid IN ('watching.observe_provider(jsonb)'::regprocedure,'watching.personal_history_command(jsonb)'::regprocedure,'watching.receipt_source(uuid,uuid)'::regprocedure,'watching.personal_revision_guard()'::regprocedure,'watching.people_ranking(text,integer,integer,uuid)'::regprocedure);");
 const permissions=acl();
 sql(db,readFileSync('supabase/migrations/20261104000000_watching_tracking_intent.sql','utf8'));
 assert.equal(hash(),before,'Migration cannot change existing user data/revisions');
 const after=JSON.parse(sql(db,counts));assert.deepEqual(after,objects.map((n,i)=>n+(i===1?1:0)),'Only one column added');assert.equal(acl(),permissions,'ACL/security unchanged');
 const evidenceHash=()=>sql(db,"SELECT md5(jsonb_build_array((SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM watching.viewing_records v),(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM watching.rewatches r),(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM watching.scope_ratings r))::text);");
 const historicalEvidence=evidenceHash();
 const day=sql(db,"SELECT (current_date-1)::text;").trim();
 const season=(number,n,announced=n)=>({id:990000+number,number,announced,aired:n,end_date:n===announced?'2019-01-01':null,episodes:Array.from({length:n},(_,i)=>({id:990000+number*100+i,number:i+1,air_date:'2019-01-01',aired:true}))});
 const facts=(seasons,status='ongoing')=>({status,seasons});
 const row=id=>JSON.parse(sql(db,`SELECT to_jsonb(m) FROM watching.media_items m WHERE id='${id}';`));
 const personal=r=>Object.fromEntries(['watched','in_progress','paused','dropped','current_season','current_episode','watched_at','last_watched_at','caught_up_at','season_years','season_ratings','user_rating','legacy_consumption'].map(k=>[k,r[k]]));
 let seq=0;
 const seed=(n,announced,extra={})=>{
  const id=`a6110400-0000-0000-0000-${String(++seq).padStart(12,'0')}`,tmdb=998000+seq;
  const fields={id,user_id:owner,org_id:org,type:'serie',tmdb_id:tmdb,title:'Tracking fixture',status:'ongoing',current_season:1,current_episode:n,season_episodes:[announced],season_aired:[n],in_progress:true,watched:false,watched_at:'2024-12-31',last_watched_at:'2024-12-31',season_years:{'1':2024},season_ratings:{'1':8},...extra};
  const columns=Object.keys(fields);
  sql(db,`INSERT INTO watching.media_items(${columns.map(k=>'"'+k+'"').join(',')}) SELECT ${columns.map(k=>'p."'+k+'"').join(',')} FROM jsonb_populate_record(NULL::watching.media_items,${lit(fields)}) p;`);
  return {id,tmdb};
 };
 const observe=(m,f)=>JSON.parse(sql(db,`SELECT watching.observe_provider(${lit({provider:'tmdb',work_key:'tv:'+m.tmdb,facts:f,projection:{season_posters:f.seasons.map(()=>null),season_air_dates:f.seasons.map(()=>null)}})});`));
 const age=m=>sql(db,`UPDATE watching.provider_heads SET accepted_checked_at=current_date-2 WHERE provider='tmdb' AND work_key='tv:${m.tmdb}';`);
 const run=c=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;SELECT watching.personal_history_command(${lit(c)});COMMIT;`);
 const cmd=(m,patch,intent='claim')=>({mode:'update',media_id:m.id,operation_key:crypto.randomUUID(),expected_revision:row(m.id).personal_revision,history_intent:intent,patch,records:[],retract_ids:[]});
 for(const type of ['serie','anime']) for(const completed of [false,true]) {
  const m=seed(3,3,{type,watched:completed,in_progress:!completed,status:completed?'ended':'ongoing'});
  observe(m,facts([season(1,3)],completed?'ended':'ongoing'));age(m);
  const prior=personal(row(m.id));
  // An announced empty season is descriptive only.
  observe(m,facts([season(1,3),season(2,0,8)]));assert.equal(row(m.id).resume_required,false);age(m);
  const next=season(2,1,8);next.episodes[0].air_date=day;
  const grown=facts([season(1,3),next]);assert.equal(observe(m,grown).classification,'GROWTH');
  assert.equal(row(m.id).resume_required,true);assert.deepEqual(personal(row(m.id)),{...prior,watched:false},'Growth revokes whole-title completion without consuming/resuming');
  const revision=row(m.id).personal_revision;observe(m,grown);assert.equal(row(m.id).personal_revision,revision,'Repeated sync is stable');
  assert.throws(()=>run(cmd(m,{current_episode:2,caught_up_at:null,resume_required:false},'correction')),/cannot create viewing dates or resume/);
  assert.throws(()=>run({...cmd(m,{resume_required:false}),history_intent:undefined}),/Resume requires/);
  const resume=cmd(m,{resume_required:false,watched:false,in_progress:true,paused:false,dropped:false});run(resume);const resumed=row(m.id);run(resume);assert.deepEqual(row(m.id),resumed,'Resume retry is idempotent');
  observe(m,grown);assert.equal(row(m.id).resume_required,false,'Unchanged sync does not undo explicit resume');
 }
 // Recording actual forward consumption is itself an explicit resumption, even for an old client.
 const directView=seed(4,8,{in_progress:false,resume_required:true,current_episode:3});
 run(cmd(directView,{current_episode:4},'viewing'));
 assert.equal(row(directView.id).resume_required,false);assert.equal(row(directView.id).in_progress,true);
 // Weekly episodes do not interrupt an already active session.
 const weekly=seed(3,8);observe(weekly,facts([season(1,3,8)]));age(weekly);const fourth=season(1,4,8);fourth.episodes[3].air_date=day;
 assert.equal(observe(weekly,facts([fourth])).classification,'GROWTH');assert.equal(row(weekly.id).resume_required,false);assert.equal(row(weekly.id).in_progress,true);
 // A known anime cour boundary is not guessed from broadcast gaps.
 const part=seed(3,8,{type:'anime'});sql(db,`INSERT INTO watching.anime_cours(tmdb_id,source,cours,resolved_at) VALUES(${part.tmdb},'anilist','[{"anilist_id":1,"season":1,"start_episode":1,"end_episode":3,"episodes":3}]',now());`);
 observe(part,facts([season(1,3,8)]));age(part);assert.equal(observe(part,facts([fourth])).classification,'GROWTH');assert.equal(row(part.id).resume_required,true);
 for(const stance of ['paused','dropped']) {
  const m=seed(3,3,{[stance]:true,in_progress:false});observe(m,facts([season(1,3)]));age(m);const next=season(2,1,8);next.episodes[0].air_date=day;
  const prior=personal(row(m.id));observe(m,facts([season(1,3),next]));assert.equal(row(m.id).resume_required,false);assert.deepEqual(personal(row(m.id)),prior);
 }
 // Waiting after a return must not erase consumed titles from the People ranking.
 for(let i=0;i<2;i++) seed(3,8,{in_progress:false,resume_required:true,cast_members:[{id:998099,name:'Preserved actor',profile_url:null,character:'Lead'}]});
 assert.equal(Number(sql(db,`SELECT n FROM watching.people_ranking('actors',50,0,'${owner}') WHERE id=998099;`).trim()),2,'People ranking retains consumed waiting titles');
 // The database itself refuses invented dates even if an old client sends them.
 const corrected=seed(10,24,{type:'anime'}),original=personal(row(corrected.id));
 for(const patch of [{caught_up_at:day},{last_watched_at:day},{watched_at:day},{season_years:{'1':2026}}]) {
  assert.throws(()=>run(cmd(corrected,{current_episode:12,...patch},'correction')),/Position correction cannot create/);
  assert.deepEqual(personal(row(corrected.id)),original);
 }
 assert.throws(()=>run(cmd(corrected,{season_aired:[24,1]})),/owned by observe_provider/);
 assert.throws(()=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;UPDATE watching.media_items SET season_aired=ARRAY[24,1] WHERE id='${corrected.id}';COMMIT;`),/owned by observe_provider/);
 const correction=cmd(corrected,{current_episode:12,caught_up_at:null},'correction');run(correction);const fixed=row(corrected.id);run(correction);assert.deepEqual(row(corrected.id),fixed);
 assert.equal(fixed.current_episode,12);for(const key of ['watched_at','last_watched_at','caught_up_at','season_years','season_ratings']) assert.deepEqual(fixed[key],original[key]);
 assert.equal(evidenceHash(),historicalEvidence,'Catalogue refresh and resume cannot manufacture/rewrite viewings, rewatches or ratings');
 console.log('PASS tracking intent: no backfill; ACL/counts; series/anime revival and announcements; cour/weekly/suspended scopes; correction dates; repeated-sync and explicit-resume idempotence');
}
