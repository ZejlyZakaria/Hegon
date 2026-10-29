// Isolated PostgreSQL contract rehearsal. No production credentials or network hosts accepted.
// Requires a local PostgreSQL server; defaults to 127.0.0.1:55432, role postgres.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const port = process.env.WATCHING_TEST_PG_PORT ?? '55432';
if (!/^\d+$/.test(port)) throw new Error('Invalid local test port');
const db = `watching_receipts_test_${Date.now()}`;
const args = ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t'];
const sql = (database, input) => execFileSync('psql', [...args, '-d', database], { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const baseline = readFileSync('supabase/migrations/20260906000000_baseline.sql','utf8');
const table = name => {
  const start = baseline.indexOf(`CREATE TABLE IF NOT EXISTS "watching"."${name}"`);
  return baseline.slice(start, baseline.indexOf('\n);',start) + 3).replaceAll('"extensions"."uuid_generate_v4"()', 'gen_random_uuid()');
};
const noteTriggerStart = baseline.indexOf('CREATE OR REPLACE FUNCTION "watching"."touch_note_updated_at"');
const noteTrigger = baseline.slice(noteTriggerStart,baseline.indexOf('$$;',noteTriggerStart) + 3);
const fixture = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth; CREATE SCHEMA watching;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.organizations(id uuid PRIMARY KEY);
CREATE TABLE public.memberships(user_id uuid,org_id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.my_orgs() RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT org_id FROM public.memberships WHERE user_id=auth.uid() $$;
CREATE FUNCTION public.is_demo_user() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.demo',true),''),'false')::boolean $$;
GRANT USAGE ON SCHEMA auth,watching TO authenticated,anon,service_role;
${table('media_items')}
${table('rewatches')}
${table('anime_cours')}
ALTER TABLE watching.anime_cours ADD PRIMARY KEY(tmdb_id);
${noteTrigger}
CREATE TRIGGER trg_touch_note_updated_at BEFORE UPDATE ON watching.media_items FOR EACH ROW EXECUTE FUNCTION watching.touch_note_updated_at();
ALTER TABLE watching.media_items ADD PRIMARY KEY(id);
ALTER TABLE watching.rewatches ADD PRIMARY KEY(id);
ALTER TABLE watching.rewatches ADD FOREIGN KEY(media_item_id) REFERENCES watching.media_items(id) ON DELETE CASCADE;
ALTER TABLE watching.media_items ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE watching.media_items ADD FOREIGN KEY(org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE watching.rewatches ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE watching.rewatches ADD FOREIGN KEY(org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE watching.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON watching.media_items USING(org_id IN (SELECT public.my_orgs())) WITH CHECK(org_id IN (SELECT public.my_orgs()));
GRANT SELECT,INSERT,UPDATE,DELETE ON watching.media_items,watching.rewatches TO authenticated,service_role;
-- Reproduce Supabase's default privileges so the test catches forgotten REVOKEs.
ALTER DEFAULT PRIVILEGES IN SCHEMA watching GRANT ALL ON TABLES TO authenticated,anon,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA watching GRANT ALL ON FUNCTIONS TO authenticated,anon,service_role;
`;
try {
 sql('postgres',`CREATE DATABASE ${db};`);
 sql(db,fixture);
 sql(db,readFileSync('supabase/migrations/20260917000200_media_items_cour_guard.sql','utf8'));
 sql(db,readFileSync('supabase/migrations/20261012000000_watching_history.sql','utf8'));
 console.log(sql(db,readFileSync('supabase/tests/watching-history.sql','utf8')).trim());
 sql(db,readFileSync('supabase/migrations/20261013000000_watching_provider_ratings.sql','utf8'));
 const hash=`SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m;`;
 const objects=`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='watching';`;
 const before=sql(db,hash), count=sql(db,objects);
 sql(db,readFileSync('supabase/migrations/20261018000000_watching_history_consumption.sql','utf8'));
 if(before!==sql(db,hash) || count!==sql(db,objects)) throw new Error('Migration changed media rows or object counts');
 console.log('PASS: Wave2C migration changes no existing media data or object counts.');
 console.log(sql(db,readFileSync('supabase/tests/watching-history-consumption.sql','utf8')).trim());
 const goalsStart=baseline.indexOf('CREATE TABLE IF NOT EXISTS "public"."goals"');
 sql(db,baseline.slice(goalsStart,baseline.indexOf('\n);',goalsStart)+3).replaceAll('"extensions"."uuid_generate_v4"()', 'gen_random_uuid()'));
 sql(db,'ALTER TABLE public.goals ADD PRIMARY KEY(id); GRANT SELECT,INSERT,UPDATE,DELETE ON public.goals TO authenticated;');
 sql(db,`INSERT INTO public.goals(id,org_id,user_id,title,status,completed_at) VALUES('70000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Legacy explicit completion','completed','2024-05-02');`);
 const oldGoalHash=sql(db,"SELECT md5(string_agg(to_jsonb(g)::text,',' ORDER BY id)) FROM public.goals g;");
 const allHash=`SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m;`;
 const before2d=sql(db,allHash);
 const counts=`SELECT json_build_array((SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('public','watching') AND table_type='BASE TABLE'),(SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','watching')),(SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','watching')),(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','watching')),(SELECT count(*) FROM pg_indexes WHERE schemaname IN ('public','watching')));`;
 console.log('Before2D objects:',sql(db,counts).trim());
 sql(db,readFileSync('supabase/migrations/20261021000000_watching_milestone_receipts.sql','utf8'));
 console.log('After2D objects:',sql(db,counts).trim());
 if(before2d!==sql(db,allHash) || oldGoalHash!==sql(db,"SELECT md5(string_agg(to_jsonb(g)::text,',' ORDER BY id)) FROM public.goals g;"))throw new Error('2D migration changed existing media/Goals');
 if(sql(db,'SELECT count(*) FROM watching.achievement_unlocks;').trim()!=='0'||sql(db,'SELECT count(*) FROM public.goal_completion_receipts;').trim()!=='0')throw new Error('Migration backfilled receipts');
 console.log(sql(db,readFileSync('supabase/tests/watching-milestone-receipts.sql','utf8')).trim());
 // Two independent connections, one immutable receipt; the first transaction holds its locks.
 const race=`SELECT watching.record_achievement_unlocks('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',md5(watching.receipt_source('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')::text),'[{"achievement_key":"otaku","rule_version":1,"metric_key":"watching:otaku:v1","target":50,"actual_value":50}]');`;
 const {execFile}=await import('node:child_process');
 const concurrent=input=>new Promise((resolve,reject)=>{const child=execFile('psql',[...args,'-d',db],{encoding:'utf8'},(err,out,stderr)=>err?reject(new Error(stderr)):resolve(out));child.stdin.end(input);});
 await Promise.all([concurrent('BEGIN;'+race+'SELECT pg_sleep(0.2);COMMIT;'),concurrent(race)]);
 if(sql(db,"SELECT count(*) FROM watching.achievement_unlocks WHERE achievement_key='otaku';").trim()!=='1')throw new Error('Concurrent receipt duplicate');
 console.log('PASS: independent-connection achievement concurrency.');
 sql(db,`INSERT INTO public.goals(id,org_id,user_id,title,status,progress_mode,metric_module,metric_key,metric_period,metric_target) VALUES('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Concurrent50','active','auto','watching','films','all_time',50);`);
 const goalRace=`SELECT public.record_goal_completion_receipts('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('goalId','70000000-0000-0000-0000-000000000002','metricKey','films','target',50,'period','all_time','year',NULL,'currentValue',50,'liveValue',50,'shouldComplete',true,'measuredAt',clock_timestamp(),'source','WATCHING_HISTORY_V1','evidenceVersion',1)));`;
 await Promise.all([concurrent('BEGIN;'+goalRace+'SELECT pg_sleep(0.2);COMMIT;'),concurrent(goalRace)]);
 if(sql(db,"SELECT count(*) FROM public.goal_completion_receipts WHERE goal_id='70000000-0000-0000-0000-000000000002';").trim()!=='1')throw new Error('Concurrent Goal receipt duplicate');
 console.log('PASS: independent-connection Goal concurrency.');
 if(process.argv.includes('--rewatch')) {
  const snapshot=sql(db,allHash), objectCount=sql(db,counts);
  sql(db,readFileSync('supabase/migrations/20261021020000_watching_rewatch_episode_runtime.sql','utf8'));
  if(snapshot!==sql(db,allHash) || objectCount!==sql(db,counts)) throw new Error('Rewatch migration changed media data or object counts');
  console.log(sql(db,readFileSync('supabase/tests/watching-rewatch.sql','utf8')).trim());
 }
 if(process.argv.includes('--accepted-consumption') || process.argv.includes('--bleach-completion') || process.argv.includes('--backward-correction')) {
  const {runAcceptedConsumptionChecks}=await import('./test-watching-accepted-consumption.mjs');
  runAcceptedConsumptionChecks({sql,db,counts});
 }
 if(process.argv.includes('--bleach-completion')) {
  const {runCompletionDateChecks}=await import('./test-watching-completion-date.mjs');
  runCompletionDateChecks({sql,db,counts});
 }
 if(process.argv.includes('--backward-correction')) {
  const {runBackwardCorrectionChecks}=await import('./test-watching-backward-correction.mjs');
  runBackwardCorrectionChecks({sql,db,counts});
 }
 if(process.argv.includes('--estimated-dates')) {
  const {runEstimatedDateChecks}=await import('./test-watching-estimated-dates.mjs');
  runEstimatedDateChecks({sql,db});
 }
} catch(error) {
 console.error(error.stderr?.toString() ?? error.message);process.exitCode=1;
} finally {sql('postgres',`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);}
