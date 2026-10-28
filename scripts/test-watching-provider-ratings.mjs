// Isolated PostgreSQL contract rehearsal. No production credentials or network hosts accepted.
// Requires a local PostgreSQL server; defaults to 127.0.0.1:55432, role postgres.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const port = process.env.WATCHING_TEST_PG_PORT ?? '55432';
if (!/^\d+$/.test(port)) throw new Error('Invalid local test port');
const db = `watching_provider_test_${Date.now()}`;
const args = ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t'];
const sql = (database, input) => execFileSync('psql', [...args, '-d', database], { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const concurrentSql = (database, input) => new Promise(resolve => {
  const child = spawn('psql', [...args, '-d',database]);
  let error = '';
  child.stderr.on('data', chunk => { error += chunk; });
  child.stdout.resume();
  child.on('close', code => resolve({ code, error }));
  child.stdin.end(input);
});
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
  const counts = `SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='watching') || ',' ||
    (SELECT count(*) FROM information_schema.columns WHERE table_schema='watching') || ',' ||
    (SELECT count(*) FROM pg_policies WHERE schemaname='watching') || ',' ||
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='watching') || ',' ||
    (SELECT count(*) FROM pg_indexes WHERE schemaname='watching');`;
  const legacy = `SELECT md5(coalesce(string_agg(to_jsonb(m)::text,',' ORDER BY id),'')) FROM watching.media_items m;`;
  const before = sql(db,legacy);
  console.log('Before Wave 2B:',sql(db,counts).trim());
  sql(db,readFileSync('supabase/migrations/20261013000000_watching_provider_ratings.sql','utf8'));
  console.log('After Wave 2B:',sql(db,counts).trim());
  if (before !== sql(db,legacy)) throw new Error('Migration changed existing data');
  console.log(sql(db,readFileSync('supabase/tests/watching-provider-ratings.sql','utf8')).trim());
  console.log(sql(db,readFileSync('supabase/tests/watching-nested-parts.sql','utf8')).trim().split('\n').at(-1));
  const frozenRating = JSON.parse(sql(db,`SELECT public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'CONFIRM')::text;`).trim());
  const rating = `BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    SELECT watching.scope_rating_command('${JSON.stringify(frozenRating).replaceAll("'","''")}'); SELECT pg_sleep(0.2); COMMIT;`;
  const growth = `BEGIN; SET ROLE service_role; SELECT watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',jsonb_set(jsonb_set(public.test_provider_facts(24,((clock_timestamp() AT TIME ZONE 'UTC')::date-1)::text),'{seasons,1,episodes,23,air_date}',to_jsonb((clock_timestamp() AT TIME ZONE 'UTC')::date::text)),'{seasons,1,end_date}',to_jsonb((clock_timestamp() AT TIME ZONE 'UTC')::date::text)))); SELECT pg_sleep(0.2); COMMIT;`;
  const concurrent = await Promise.all([concurrentSql(db,rating),concurrentSql(db,growth)]);
  if (concurrent[1].code!==0 || (concurrent[0].code!==0 && !concurrent[0].error.includes('Stale personal revision'))) throw new Error(JSON.stringify(concurrent));
  console.log(sql(db,`SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); SELECT public.test_assert((SELECT (value->>'validity')='NEEDS_RECONFIRMATION' FROM jsonb_array_elements(watching.scope_rating_context('40000000-0000-0000-0000-000000000001')) WHERE value->>'kind'='SEASON' AND value->>'number'='2'),'concurrent growth never auto-confirms');`).trim());
  sql(db,`SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    SELECT watching.personal_history_command(jsonb_build_object('mode','update','media_id',id,'operation_key',gen_random_uuid(),'expected_revision',personal_revision,'patch','{"current_episode":24,"watched":true,"in_progress":false,"caught_up_at":null}'::jsonb,'records','[]'::jsonb)) FROM watching.media_items WHERE tmdb_id=9001;`);
  const retryCommand = JSON.parse(sql(db,`SELECT public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'CONFIRM')::text;`).trim());
  const retry = `BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true); SELECT watching.scope_rating_command('${JSON.stringify(retryCommand).replaceAll("'","''")}'); COMMIT;`;
  const retries = await Promise.all([concurrentSql(db,retry),concurrentSql(db,retry)]);
  if (retries.some(r => r.code!==0)) throw new Error(JSON.stringify(retries));
  sql(db,`SELECT public.test_assert((SELECT count(*)=1 FROM watching.scope_ratings WHERE operation_key='${retryCommand.operation_key}'),'simultaneous identical commands create one assertion');`);
  const staleContext = JSON.parse(sql(db,`SELECT public.test_rating_command('40000000-0000-0000-0000-000000000001',9,'CONFIRM')::text;`).trim());
  sql(db,`SELECT watching.observe_provider(jsonb_build_object('provider','tmdb','work_key','tv:9001','facts',jsonb_set((SELECT p.facts FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.provider='tmdb' AND h.work_key='tv:9001'),'{status}','"ongoing"')));`);
  const staleResult = await concurrentSql(db,`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); SELECT watching.scope_rating_command('${JSON.stringify(staleContext).replaceAll("'","''")}');`);
  if (staleResult.code===0 || !staleResult.error.includes('Stale provider rating context')) throw new Error('Provider-only race bypassed catalogue token: '+staleResult.error);
  sql(db,`SELECT public.test_assert((SELECT personal_revision=${staleContext.expected_revision} FROM watching.media_items WHERE tmdb_id=9001),'provider-only correction leaves personal revision unchanged');
    DELETE FROM watching.media_items WHERE tmdb_id=9001;
    SELECT public.test_assert((SELECT count(*)>0 AND bool_and(media_item_id IS NULL) FROM watching.scope_ratings WHERE work_key='tv:9001'),'library removal retains scoped opinions');
    SELECT public.test_assert((SELECT count(*)>0 AND bool_and(media_item_id IS NULL) FROM watching.viewing_records WHERE work_key='tv:9001'),'library removal retains coverage');`);
  console.log('PASS: concurrent refresh/rating commands, catalogue tokens independent of personal revisions, simultaneous idempotent retries and removal retention.');
} catch (error) {
  console.error(error.stderr?.toString() ?? error.message); process.exitCode=1;
} finally {
  sql('postgres',`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);
}
