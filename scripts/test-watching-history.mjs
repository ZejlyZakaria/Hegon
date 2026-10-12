// Isolated PostgreSQL contract rehearsal. No production credentials or network hosts accepted.
// Requires a local PostgreSQL server; defaults to 127.0.0.1:55432, role postgres.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const port = process.env.WATCHING_TEST_PG_PORT ?? '55432';
if (!/^\d+$/.test(port)) throw new Error('Invalid local test port');
const db = `watching_history_test_${Date.now()}`;
const args = ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'];
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
  const count = `SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='watching') || ',' ||
    (SELECT count(*) FROM information_schema.columns WHERE table_schema='watching') || ',' ||
    (SELECT count(*) FROM pg_policies WHERE schemaname='watching') || ',' ||
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='watching') || ',' ||
    (SELECT count(*) FROM pg_indexes WHERE schemaname='watching');`;
  console.log('Before (tables, columns, policies, functions, indexes):',sql(db,count).trim());
  sql(db,readFileSync('supabase/migrations/20261012000000_watching_history.sql','utf8'));
  console.log('After:',sql(db,count).trim());
  console.log(sql(db,readFileSync('supabase/tests/watching-history.sql','utf8')).trim());
  sql(db,`INSERT INTO watching.media_items(id,user_id,org_id,type,title) VALUES
    ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','film','Concurrent fixture');`);
  const request = key => `BEGIN; SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    SELECT watching.personal_history_command('{"mode":"update","media_id":"20000000-0000-0000-0000-000000000004","operation_key":"${key}","expected_revision":0,"patch":{"favorite":true},"records":[]}');
    SELECT pg_sleep(0.2); COMMIT;`;
  const simultaneous = await Promise.all([
    concurrentSql(db,request('30000000-0000-0000-0000-000000000001')),
    concurrentSql(db,request('30000000-0000-0000-0000-000000000002')),
  ]);
  if (simultaneous.filter(r => r.code === 0).length !== 1 || !simultaneous.some(r => r.error.includes('Stale personal revision'))) {
    throw new Error(`Concurrent stale-write test failed: ${JSON.stringify(simultaneous)}`);
  }
  sql(db,`SELECT public.test_assert((SELECT personal_revision=1 FROM watching.media_items WHERE title='Concurrent fixture'),'concurrent writers increment once');`);
  console.log('PASS: two simultaneous connections; exactly one revision-0 writer succeeds.');
  console.log('PASS: fresh migration replay and real PostgreSQL history/RLS contracts.');
} catch (error) {
  console.error(error.stderr?.toString() ?? error.message);
  process.exitCode = 1;
} finally {
  // Only the database this process just named, on the hard-coded loopback host.
  sql('postgres',`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);
}
