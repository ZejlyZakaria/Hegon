// Runs only inside the disposable local database supplied by the receipt rehearsal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export function runEstimatedDateChecks({ sql, db }) {
  const migration = readFileSync('supabase/migrations/20261021010000_watching_estimated_legacy_dates.sql', 'utf8');
  const approved = JSON.parse(migration.match(/\$approved_dates\$([\s\S]+?)\$approved_dates\$/)[1]);
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  const owner = 'de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64';
  const org = '26f017a1-c27f-4690-9032-317e3193373d';
  sql(db, `INSERT INTO auth.users VALUES('${owner}'); INSERT INTO public.organizations VALUES('${org}'); INSERT INTO public.memberships VALUES('${owner}','${org}');`);
  // Trigger bypass is confined to fixture setup in this disposable local database.
  sql(db, `ALTER TABLE watching.media_items DISABLE TRIGGER personal_revision_guard;
    INSERT INTO watching.media_items(id,user_id,org_id,type,title,watched_at,personal_revision,history_version,viewing_date)
    VALUES ${approved.map(r => `(${literal(r.id)},'${owner}','${org}',${literal(r.type)},'Estimated date fixture',${literal(r.old_date)},${r.revision},${r.history_version},${r.viewing_date === null ? 'NULL' : literal(JSON.stringify(r.viewing_date))+'::jsonb'})`).join(',')};
    ALTER TABLE watching.media_items ENABLE TRIGGER personal_revision_guard;`);
  const hash = () => sql(db, "SELECT md5(string_agg(to_jsonb(m)::text,',' ORDER BY id)) FROM watching.media_items m;");
  const objects = () => sql(db, "SELECT json_build_array((SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','watching')),(SELECT count(*) FROM pg_proc WHERE pronamespace='watching'::regnamespace),(SELECT count(*) FROM pg_indexes WHERE schemaname IN ('public','watching')));");
  const rowCount = sql(db, 'SELECT count(*) FROM watching.media_items;');
  // A real revision change must reject the whole batch without partial updates.
  sql(db, `UPDATE watching.media_items SET notes='Changed after approval' WHERE id='${approved[0].id}';`);
  const staleHash = hash();
  assert.throws(() => sql(db, migration), /Stale approved mapping/);
  assert.equal(hash(), staleHash);
  sql(db, `ALTER TABLE watching.media_items DISABLE TRIGGER personal_revision_guard;
    UPDATE watching.media_items SET notes=NULL,personal_revision=${approved[0].revision} WHERE id='${approved[0].id}';
    ALTER TABLE watching.media_items ENABLE TRIGGER personal_revision_guard;`);
  const beforeObjects = objects();
  sql(db, migration);
  const actual = JSON.parse(sql(db, `SELECT json_agg(m ORDER BY id) FROM watching.media_items m WHERE user_id='${owner}';`));
  assert.equal(actual.length, 85);
  for (const row of actual) {
    const expected = approved.find(r => r.id === row.id);
    assert.equal(row.watched_at.slice(0, 10), expected.new_date);
    assert.equal(row.watched_at.slice(0, 4), expected.old_date.slice(0, 4));
    assert.equal(row.personal_revision, expected.revision + 1);
    assert.equal(row.history_version, expected.history_version);
    assert.equal(row.viewing_date.legacy_date_estimate.date_confidence, 'INFERRED');
    assert.equal(row.viewing_date.legacy_date_estimate.personal_evidence, 'NONE');
    if (expected.viewing_date) {
      const { legacy_date_estimate: provenance, ...original } = row.viewing_date;
      assert.ok(provenance);
      assert.deepEqual(original, expected.viewing_date);
    }
  }
  assert.equal(sql(db, 'SELECT count(*) FROM watching.media_items;'), rowCount);
  assert.equal(objects(), beforeObjects);
  const appliedHash = hash();
  assert.throws(() => sql(db, migration), /Stale approved mapping/);
  assert.equal(hash(), appliedHash);
  console.log('PASS: 85 estimates, same years/counts/schema, inferred provenance, canonical dates preserved; stale batch and repeat rejected atomically.');
}
