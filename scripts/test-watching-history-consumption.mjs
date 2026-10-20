// Isolated PostgreSQL contract rehearsal. No production credentials or network hosts accepted.
// Requires a local PostgreSQL server; defaults to 127.0.0.1:55432, role postgres.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const port = process.env.WATCHING_TEST_PG_PORT ?? '55432';
if (!/^\d+$/.test(port)) throw new Error('Invalid local test port');
const db = `watching_consumption_test_${Date.now()}`;
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
} catch(error) {
 console.error(error.stderr?.toString() ?? error.message);process.exitCode=1;
} finally {sql('postgres',`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);}
