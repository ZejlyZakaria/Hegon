// Disposable loopback PostgreSQL only; invoked by test-watching-milestone-receipts.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export function runAnimationStudioChecks({sql,db,counts}) {
 const hash=()=>sql(db,"SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m;");
 const before=hash(),objects=sql(db,counts),acl=sql(db,"SELECT proacl,prosecdef,proconfig FROM pg_proc WHERE oid='watching.observe_provider(jsonb)'::regprocedure;");
 sql(db,readFileSync('supabase/migrations/20261103000000_watching_animation_studios.sql','utf8'));
 assert.equal(hash(),before);assert.equal(sql(db,counts),objects);assert.equal(sql(db,"SELECT proacl,prosecdef,proconfig FROM pg_proc WHERE oid='watching.observe_provider(jsonb)'::regprocedure;"),acl);
 const lit=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`,work='tv:997901';
 const facts={cours:[{id:7901,number:1,announced:5,start:1,end:5},{id:7902,number:2,announced:5,start:6,end:10}]};
 const cours=facts.cours.map(c=>({anilist_id:c.id,season:c.number,episodes:c.announced,start_episode:c.start,end_episode:c.end,title:'Part'+c.number}));
 const observe=(projection,f=facts)=>JSON.parse(sql(db,`SELECT watching.observe_provider(${lit({provider:'anilist',work_key:work,facts:f,projection:{cours:projection}})});`));
 assert.equal(observe(cours).classification,'BASELINE');
 const head=()=>sql(db,`SELECT accepted_snapshot_id FROM watching.provider_heads WHERE work_key='${work}' AND provider='anilist';`);
 const accepted=head(),snapshots=sql(db,`SELECT count(*) FROM watching.provider_snapshots WHERE work_key='${work}';`);
 const cached=()=>JSON.parse(sql(db,"SELECT cours FROM watching.anime_cours WHERE tmdb_id=997901;"));
 const enriched=cours.map((c,i)=>({...c,studios:[{id:i+1,name:i?'MAPPA':'WIT STUDIO'}]}));
 assert.equal(observe(enriched).classification,'UNCHANGED');assert.deepEqual(cached(),enriched);
 assert.equal(head(),accepted);assert.equal(sql(db,`SELECT count(*) FROM watching.provider_snapshots WHERE work_key='${work}';`),snapshots);
 observe(cours);assert.deepEqual(cached(),enriched,'Old workers cannot erase credits');
 for(const bad of [enriched.map(c=>({...c,studios:null})),enriched.map(c=>({...c,studios:[{id:0,name:'Bad'}]})),[enriched[0],enriched[0]]]) {
   assert.throws(()=>observe(bad),/Invalid/);assert.deepEqual(cached(),enriched,'Malformed metadata rolls back');
 }
 const removed=[{...enriched[0],studios:[]}];const smaller={cours:[facts.cours[0]]};
 const rejected=observe(removed,smaller);assert.equal(rejected.classification,'REGRESSION');assert.deepEqual(cached(),enriched,'Rejected membership cannot rewrite accepted metadata');
 assert.equal(hash(),before,'Studio cache refresh cannot mutate personal media');
 console.log('PASS animation studios: unchanged accepted cache refresh, scope/snapshot/ACL/count stability, old-worker compatibility, malformed/duplicate/rejected protection, zero personal changes');
}
