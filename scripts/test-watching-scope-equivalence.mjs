// Real loopback PostgreSQL fixtures; never connects to HEGON remote.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

export function runScopeEquivalenceChecks({sql,db,counts}) {
  const hash=()=>sql(db,"SELECT md5(string_agg(to_jsonb(m)::text,',' ORDER BY id)) FROM watching.media_items m;");
  const before=hash(),objects=JSON.parse(sql(db,counts));
  sql(db,readFileSync('supabase/migrations/20261029040000_watching_single_scope_rating.sql','utf8'));
  assert.equal(hash(),before,'No personal-data backfill');
  const after=JSON.parse(sql(db,counts));
  assert.deepEqual(after,objects.map((n,i)=>n+(i===3?1:0)),'One private function only');
  // The older provider suite assumes an empty opinions table. Isolate its synthetic rows
  // from the rollback fixtures already exercised in this disposable database.
  sql(db,'BEGIN;DELETE FROM watching.scope_ratings;'+readFileSync('supabase/tests/watching-provider-ratings.sql','utf8')+'ROLLBACK;');
  const owner='00000000-0000-0000-0000-000000000001',org='10000000-0000-0000-0000-000000000001';
  const lit=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
  const json=q=>JSON.parse(sql(db,q));
  const actor=c=>sql(db,`BEGIN;SELECT set_config('request.jwt.claim.sub','${owner}',true);SET LOCAL ROLE authenticated;${c};COMMIT;`);
  const row=id=>json(`SELECT to_jsonb(m) FROM watching.media_items m WHERE id='${id}'`);
  const contexts=id=>JSON.parse(sql(db,`SELECT set_config('request.jwt.claim.sub','${owner}',false);SELECT watching.scope_rating_context('${id}')`).trim().split(/\r?\n/).at(-1));
  const season=(number,n,offset=0)=>({id:88000+number,number,announced:n,aired:n,end_date:'2020-01-01',episodes:Array.from({length:n},(_,i)=>({id:880000+offset+i+1,number:i+1,air_date:'2020-01-01',aired:true}))});
  const observe=(work,provider,facts,projection)=>json(`SELECT watching.observe_provider(${lit({work_key:`tv:${work}`,provider,facts,...(projection?{projection}:{})})})`);
  const insert=(id,work,type,sizes)=>sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,title,tmdb_id,user_rating,watched,current_season,current_episode,season_episodes,season_aired)
    VALUES('${id}','${owner}','${org}','${type}','Scope fixture',${work},8.5,true,${sizes.length},${sizes.at(-1)},'${JSON.stringify(sizes)}',ARRAY[${sizes.join(',')}]);`);
  const rate=(id,kind,number,score)=>{
    const context=contexts(id).find(c=>c.kind===kind && c.number===number);
    const command={media_id:id,operation_key:crypto.randomUUID(),expected_revision:row(id).personal_revision,scope_kind:kind,scope_number:number,score,
      action:score==null?'CORRECTION':context.rating_id?'REVISE':'INITIAL',previous_rating_id:context.rating_id,expected_scope_key:context.scope_key,
      expected_snapshot_id:context.provider_snapshot_id,expected_mapping_snapshot_id:context.mapping_snapshot_id};
    actor(`SELECT watching.scope_rating_command(${lit(command)})`);
    return command;
  };
  const global=(id,score)=>{
    const command={mode:'update',media_id:id,operation_key:crypto.randomUUID(),expected_revision:row(id).personal_revision,
      patch:{user_rating:score},records:[],retract_ids:[]};
    actor(`SELECT watching.personal_history_command(${lit(command)})`);return command;
  };
  const mid='94000000-0000-0000-0000-000000000001';
  insert(mid,994001,'serie',[12]);observe(994001,'tmdb',{status:'ended',seasons:[season(1,12)]});
  assert.equal(contexts(mid).find(c=>c.kind==='SEASON').score,8.5,'Global legacy opinion displayed without inventing coverage');
  assert.equal(contexts(mid).find(c=>c.kind==='SEASON').validity,'SCOPE_UNVERIFIED');
  rate(mid,'SEASON',1,9);assert.equal(row(mid).user_rating,9);assert.deepEqual(row(mid).season_ratings,{'1':9});
  rate(mid,'SEASON',1,null);assert.equal(row(mid).user_rating,null);assert.deepEqual(row(mid).season_ratings,{});
  rate(mid,'SEASON',1,9);
  const command=global(mid,8);assert.equal(row(mid).season_ratings['1'],8);assert.equal(contexts(mid)[0].score,8);
  rate(mid,'SEASON',1,7.5);actor(`SELECT watching.personal_history_command(${lit(command)})`);
  assert.equal(row(mid).user_rating,7.5,'Delayed retry cannot overwrite a later opinion');
  assert.throws(()=>actor(`SELECT watching.personal_history_command(${lit({...command,patch:{user_rating:6}})})`),/different input/);
  global(mid,null);assert.deepEqual(row(mid).season_ratings,{});assert.equal(contexts(mid)[0].score,null);
  global(mid,9);assert.equal(row(mid).season_ratings['1'],9);
  // New season: the former S1 opinion remains scoped to S1, never copied into S2.
  sql(db,`UPDATE watching.provider_snapshots SET observed_at=clock_timestamp()-interval '2 days' WHERE id=(SELECT accepted_snapshot_id FROM watching.provider_heads WHERE work_key='tv:994001' AND provider='tmdb');`);
  sql(db,`UPDATE watching.provider_heads SET accepted_checked_at=clock_timestamp()-interval '2 days' WHERE work_key='tv:994001' AND provider='tmdb';`);
  const newer=season(2,2,12);newer.end_date=new Date(Date.now()-86400000).toISOString().slice(0,10);newer.episodes.forEach(e=>e.air_date=newer.end_date);
  assert.equal(observe(994001,'tmdb',{status:'ended',seasons:[season(1,12),newer]}).classification,'GROWTH');
  rate(mid,'SEASON',1,8);assert.equal(row(mid).user_rating,9,'Once scopes diverge, global opinion is independent');
  assert.equal(contexts(mid).find(c=>c.kind==='SEASON' && c.number===2).score,null);
  // One anime cour aliases the global score; multiple cours must not.
  const anime='94000000-0000-0000-0000-000000000002';insert(anime,994002,'anime',[12]);
  observe(994002,'tmdb',{status:'ended',seasons:[season(1,12)]});
  assert.equal(contexts(anime).find(c=>c.kind==='SEASON').score,null,'Unknown mapping cannot prove equivalence');
  const cours=[{id:91001,number:1,start:1,end:12,announced:12}];
  const projection={cours:[{anilist_id:91001,season:1,start_episode:1,end_episode:12,episodes:12,title:'Single cour',poster_url:null,year:2020,end_year:2020}]};
  assert.equal(observe(994002,'anilist',{cours},projection).accepted,true);
  rate(anime,'COUR',1,9.5);assert.equal(row(anime).user_rating,9.5);global(anime,8);assert.equal(row(anime).cour_ratings['1'],8);
  // Bleach-shaped catalogue: two TMDB seasons and four independent nested parts in S2.
  const bleach='94000000-0000-0000-0000-000000000003';insert(bleach,994003,'anime',[366,50]);
  observe(994003,'tmdb',{status:'ended',seasons:[season(1,366),season(2,50,366)]});
  assert.equal(contexts(bleach).some(c=>c.scope_key==='anilist-cour:185874'),false,'Reproduces missing accepted mapping');
  const ids=[269,116674,159322,169755,185874],sizes=[366,13,13,14,10];let start=1;
  const parts=sizes.map((n,i)=>{const part={id:ids[i],number:i+1,start,end:start+n-1,announced:n};start+=n;return part;});
  assert.equal(observe(994003,'anilist',{cours:parts},{cours:parts.map(c=>({anilist_id:c.id,season:c.number,start_episode:c.start,end_episode:c.end,episodes:c.announced,title:'Part',poster_url:null,year:2020,end_year:2020}))}).accepted,true);
  for(let number=2;number<=5;number++) {
    const c=contexts(bleach).find(c=>c.kind==='COUR' && c.number===number);
    assert.equal(c.scope_key,`anilist-cour:${ids[number-1]}`);assert.equal(c.available_episodes,sizes[number-1]);
    rate(bleach,'COUR',number,number===5?9.5:8);
  }
  const part4=contexts(bleach).find(c=>c.scope_key==='anilist-cour:185874');
  assert.equal(part4.score,9.5);assert.equal(part4.range_start,407);assert.equal(part4.range_end,416);
  assert.equal(row(bleach).user_rating,8.5,'Part ratings cannot overwrite whole-work opinion');
  assert.equal(sql(db,`SELECT count(*) FROM watching.viewing_records WHERE media_item_id='${bleach}' AND (year IS NOT NULL OR kind<>'COMPLETION')`).trim(),'0','Rating cannot invent viewing years or hours');
  assert.equal(sql(db,"SELECT has_function_privilege('authenticated','watching.whole_rating_scope(jsonb)','EXECUTE')").trim(),'f');
  assert.throws(()=>actor(`SELECT watching.scope_rating_context('40000000-0000-0000-0000-000000000099')`),/Unauthorized/);
  console.log('PASS: no backfill; bidirectional single-season/cour opinion, clears, delayed retries, growth separation, four nested parts, unknown dates, private helper.');
}
