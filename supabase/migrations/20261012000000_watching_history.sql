-- Wave 2A: personal assertions, not provider events. No legacy reconstruction.
BEGIN;

ALTER TABLE watching.media_items
  ADD COLUMN personal_revision bigint NOT NULL DEFAULT 0 CHECK (personal_revision >= 0),
  ADD COLUMN history_version smallint NOT NULL DEFAULT 0 CHECK (history_version IN (0, 1)),
  ADD COLUMN personal_operation_key uuid,
  ADD COLUMN personal_operation_hash text,
  ADD COLUMN viewing_date jsonb;
COMMENT ON COLUMN watching.media_items.history_version IS
  '0 legacy; 1 partial prospective history. Neither means complete history. Stats stays legacy in 2A.';
COMMENT ON COLUMN watching.media_items.viewing_date IS
  'Explicit date-parts projection for the picker; NULL for legacy/unknown. Never derive from watched_at.';

CREATE FUNCTION watching.valid_viewing_date(y integer, m integer, d integer, date_granularity text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF date_granularity = 'UNKNOWN' THEN RETURN y IS NULL AND m IS NULL AND d IS NULL; END IF;
  IF y IS NULL OR y NOT BETWEEN 1 AND 9999 THEN RETURN false; END IF;
  IF date_granularity = 'YEAR' THEN RETURN m IS NULL AND d IS NULL; END IF;
  IF m IS NULL OR m NOT BETWEEN 1 AND 12 THEN RETURN false; END IF;
  IF date_granularity = 'MONTH' THEN RETURN d IS NULL; END IF;
  IF date_granularity <> 'DAY' OR d IS NULL THEN RETURN false; END IF;
  PERFORM pg_catalog.make_date(y, m, d);
  RETURN true;
EXCEPTION WHEN datetime_field_overflow THEN RETURN false;
END $$;

ALTER TABLE watching.media_items ADD CONSTRAINT media_viewing_date_valid CHECK (
  viewing_date IS NULL OR (
    jsonb_typeof(viewing_date) = 'object' AND viewing_date ?& ARRAY['year','month','day'] AND
    watching.valid_viewing_date((viewing_date->>'year')::integer,(viewing_date->>'month')::integer,
      (viewing_date->>'day')::integer,CASE WHEN viewing_date->>'month' IS NULL THEN 'YEAR'
        WHEN viewing_date->>'day' IS NULL THEN 'MONTH' ELSE 'DAY' END)));

CREATE TABLE watching.viewing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_item_id uuid REFERENCES watching.media_items(id) ON DELETE SET NULL,
  work_key text NOT NULL CHECK (length(work_key) > 0),
  title_snapshot text NOT NULL,
  media_type_snapshot text NOT NULL CHECK (media_type_snapshot IN ('film','serie','anime')),
  kind text NOT NULL CHECK (kind IN ('FIRST_WATCH','REWATCH','COMPLETION')),
  scope_kind text NOT NULL CHECK (scope_kind IN ('WHOLE_TITLE','SEASON','COUR','EPISODES','UNKNOWN')),
  scope_key text,
  completion_basis text CHECK (completion_basis IN ('AVAILABLE_SCOPE','FINISHED_TITLE')),
  year integer, month integer, day integer,
  date_precision text NOT NULL CHECK (date_precision IN ('YEAR','MONTH','DAY','UNKNOWN')),
  date_confidence text NOT NULL CHECK (date_confidence IN ('CONFIRMED','INFERRED','UNKNOWN')),
  scope_confidence text NOT NULL CHECK (scope_confidence IN ('CONFIRMED','INFERRED','UNKNOWN')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  operation_key uuid NOT NULL,
  operation_index integer NOT NULL CHECK (operation_index >= 0),
  operation_hash text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('USER_ACTION','USER_CORRECTION','LEGACY_IMPORT','EXPLICIT_REPAIR')),
  supersedes_id uuid REFERENCES watching.viewing_records(id),
  retracted_at timestamptz,
  retracted_by uuid REFERENCES auth.users(id),
  retraction_reason text,
  retraction_operation_key uuid,
  retraction_operation_hash text,
  CHECK ((kind = 'COMPLETION') = (completion_basis IS NOT NULL)),
  CHECK (scope_kind NOT IN ('SEASON','COUR') OR scope_key IS NOT NULL),
  CONSTRAINT viewing_date_valid CHECK (watching.valid_viewing_date(year,month,day,date_precision)),
  CONSTRAINT viewing_retraction_valid CHECK (
    (retracted_at IS NULL AND retracted_by IS NULL AND retraction_reason IS NULL) OR
    (retracted_at IS NOT NULL AND retracted_by IS NOT NULL AND retraction_reason IS NOT NULL AND length(btrim(retraction_reason)) > 0)),
  UNIQUE (user_id, operation_key, operation_index)
);
CREATE INDEX viewing_records_media ON watching.viewing_records(media_item_id);
CREATE INDEX viewing_records_owner ON watching.viewing_records(user_id, org_id, work_key);
CREATE UNIQUE INDEX viewing_records_successor ON watching.viewing_records(supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE watching.viewing_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_record_id uuid NOT NULL REFERENCES watching.viewing_records(id) ON DELETE CASCADE,
  season_key text NOT NULL CHECK (length(season_key) > 0),
  season_number_at_recording integer NOT NULL CHECK (season_number_at_recording >= 0),
  episode_from integer NOT NULL CHECK (episode_from >= 1),
  episode_to integer NOT NULL CHECK (episode_to >= episode_from AND episode_to <= 1000000),
  episode_ids bigint[],
  minutes numeric CHECK (minutes >= 0 AND minutes < 'Infinity'::numeric),
  duration_basis text NOT NULL CHECK (duration_basis IN ('RUNTIME_SNAPSHOT','UNKNOWN','MILESTONE')),
  CHECK ((duration_basis = 'UNKNOWN' AND minutes IS NULL) OR
         (duration_basis = 'RUNTIME_SNAPSHOT' AND minutes IS NOT NULL) OR
         (duration_basis = 'MILESTONE' AND minutes = 0)),
  CHECK (episode_ids IS NULL OR (cardinality(episode_ids) = episode_to - episode_from + 1
    AND array_position(episode_ids,NULL) IS NULL AND 0 < ALL(episode_ids)))
);
CREATE INDEX viewing_ranges_parent ON watching.viewing_ranges(viewing_record_id);
COMMENT ON TABLE watching.viewing_ranges IS
  'Inclusive frozen storage coordinates. NULL IDs = unknown; empty array cannot represent nonempty coverage. COMPLETION ranges have zero minutes.';

ALTER TABLE watching.viewing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE watching.viewing_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_read ON watching.viewing_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND org_id IN (SELECT public.my_orgs()));
CREATE POLICY history_ranges_read ON watching.viewing_ranges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM watching.viewing_records r WHERE r.id = viewing_record_id));
-- No direct INSERT/UPDATE/DELETE policies: all mutations use the checked command below.
REVOKE ALL ON watching.viewing_records, watching.viewing_ranges FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON watching.viewing_records, watching.viewing_ranges TO authenticated, service_role;
-- Existing rewatch rows remain readable, but new writes/removal must share the history transaction.
-- FK cascades from a library deletion run as the table owner and retain their existing behavior.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON watching.rewatches FROM anon, authenticated, service_role;

-- A trigger owns revision even for trusted robot posture changes. Provider-only writes do not
-- increment it. Robots cannot assign a revision/version or touch personal historical assertions.
CREATE FUNCTION watching.personal_revision_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Use personal_history_command for inserts' USING ERRCODE = '42501'; END IF;
    NEW.personal_revision := 0;
    IF current_user <> 'postgres' THEN NEW.history_version := 0; NEW.viewing_date := NULL; END IF;
    RETURN NEW;
  END IF;
  changed := (to_jsonb(NEW) - ARRAY['updated_at','personal_revision','history_version','personal_operation_key','personal_operation_hash','title','original_title','description','poster_url','backdrop_url','year','runtime','seasons','episodes','rating','tmdb_id','directors','studio','status','season_episodes','season_posters','season_air_dates','cast_members','season_aired','last_synced_at','season_end_dates','release_date'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at','personal_revision','history_version','personal_operation_key','personal_operation_hash','title','original_title','description','poster_url','backdrop_url','year','runtime','seasons','episodes','rating','tmdb_id','directors','studio','status','season_episodes','season_posters','season_air_dates','cast_members','season_aired','last_synced_at','season_end_dates','release_date']);
  IF current_user IN ('authenticated','anon') AND
    (changed OR NEW.history_version IS DISTINCT FROM OLD.history_version OR NEW.personal_revision IS DISTINCT FROM OLD.personal_revision
     OR NEW.personal_operation_key IS DISTINCT FROM OLD.personal_operation_key OR NEW.personal_operation_hash IS DISTINCT FROM OLD.personal_operation_hash) THEN
    RAISE EXCEPTION 'Use personal_history_command for personal mutations' USING ERRCODE = '42501';
  END IF;
  IF current_user <> 'postgres' THEN
    NEW.history_version := OLD.history_version;
    NEW.personal_operation_key := OLD.personal_operation_key;
    NEW.personal_operation_hash := OLD.personal_operation_hash;
  END IF;
  NEW.personal_revision := OLD.personal_revision + CASE WHEN changed OR
    NEW.personal_operation_key IS DISTINCT FROM OLD.personal_operation_key THEN 1 ELSE 0 END;
  RETURN NEW;
END $$;
CREATE TRIGGER personal_revision_guard BEFORE INSERT OR UPDATE ON watching.media_items
  FOR EACH ROW EXECUTE FUNCTION watching.personal_revision_guard();

CREATE FUNCTION watching.personal_history_command(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  mid uuid := (command->>'media_id')::uuid;
  op uuid := (command->>'operation_key')::uuid;
  fingerprint text := md5(command::text);
  patch jsonb := coalesce(command->'patch','{}');
  item watching.media_items;
  previous watching.viewing_records;
  record jsonb; coverage jsonb; rid uuid; ordinal integer := 0;
  assignments text; columns_sql text; values_sql text;
  field text; target uuid; rewatch_id uuid;
BEGIN
  IF actor IS NULL OR public.is_demo_user() OR op IS NULL OR mid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized personal command' USING ERRCODE = '42501';
  END IF;
  IF command->>'mode' IS NULL OR command->>'mode' NOT IN ('insert','update','rewatch','remove_rewatch') THEN
    RAISE EXCEPTION 'Unknown personal command';
  END IF;
  -- Serializes retries, including inserts, without a speculative event/command table.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || op::text, 0));
  SELECT * INTO previous FROM watching.viewing_records
    WHERE user_id = actor AND operation_key = op ORDER BY operation_index LIMIT 1;
  IF FOUND THEN
    IF previous.operation_hash <> fingerprint THEN RAISE EXCEPTION 'Operation key reused with different input'; END IF;
    IF previous.org_id NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE = '42501'; END IF;
    RETURN (SELECT to_jsonb(m) FROM watching.media_items m WHERE m.id = previous.media_item_id AND m.user_id = actor);
  END IF;
  SELECT * INTO previous FROM watching.viewing_records WHERE user_id = actor AND retraction_operation_key = op LIMIT 1;
  IF FOUND THEN
    IF previous.retraction_operation_hash <> fingerprint THEN RAISE EXCEPTION 'Operation key reused with different input'; END IF;
    IF previous.org_id NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE = '42501'; END IF;
    RETURN (SELECT to_jsonb(m) FROM watching.media_items m WHERE m.id = previous.media_item_id AND m.user_id = actor);
  END IF;
  SELECT * INTO item FROM watching.media_items WHERE id = mid FOR UPDATE;
  IF FOUND THEN
    IF item.user_id <> actor OR item.org_id NOT IN (SELECT public.my_orgs()) THEN
      RAISE EXCEPTION 'Media ownership mismatch' USING ERRCODE = '42501';
    END IF;
    IF item.personal_operation_key = op THEN
      IF item.personal_operation_hash <> fingerprint THEN RAISE EXCEPTION 'Operation key reused with different input'; END IF;
      RETURN to_jsonb(item);
    END IF;
    IF command->>'mode' = 'insert' THEN RAISE EXCEPTION 'Media already exists'; END IF;
    IF (command->>'expected_revision')::bigint IS DISTINCT FROM item.personal_revision THEN
      RAISE EXCEPTION 'Stale personal revision; reload before retrying a new action' USING ERRCODE = '40001';
    END IF;
  ELSE
    IF command->>'mode' IS DISTINCT FROM 'insert' THEN RAISE EXCEPTION 'Media unavailable'; END IF;
    IF (patch->>'user_id')::uuid IS DISTINCT FROM actor OR
      (patch->>'org_id')::uuid IS NULL OR (patch->>'org_id')::uuid NOT IN (SELECT public.my_orgs()) THEN
      RAISE EXCEPTION 'Insert ownership mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;
  FOR field IN SELECT jsonb_object_keys(patch) LOOP
    IF field IN ('id','personal_revision','history_version','personal_operation_key','personal_operation_hash','created_at','updated_at') OR
      NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'watching.media_items'::regclass AND attname = field AND attnum > 0 AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Unsupported projection field: %', field;
    END IF;
    IF item.id IS NOT NULL AND field IN ('user_id','org_id','type','tmdb_id') AND patch->field IS DISTINCT FROM to_jsonb(item)->field THEN
      RAISE EXCEPTION 'Immutable media identity' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF patch ? 'viewing_date' AND patch->'viewing_date' IS DISTINCT FROM to_jsonb(item)->'viewing_date' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(command->'records','[]')) r
    WHERE r->>'year' IS NOT DISTINCT FROM patch->'viewing_date'->>'year'
      AND r->>'month' IS NOT DISTINCT FROM patch->'viewing_date'->>'month'
      AND r->>'day' IS NOT DISTINCT FROM patch->'viewing_date'->>'day'
  ) THEN
    RAISE EXCEPTION 'Date projection requires matching historical assertion';
  END IF;
  IF item.id IS NULL THEN
    SELECT string_agg(format('%I', key), ', '), string_agg(format('p.%I', key), ', ')
      INTO columns_sql, values_sql FROM jsonb_object_keys(patch) key;
    EXECUTE format('INSERT INTO watching.media_items (id,%s) SELECT $2,%s FROM jsonb_populate_record(NULL::watching.media_items,$1) p RETURNING *', columns_sql, values_sql)
      INTO item USING patch, mid;
  END IF;
  -- Retractions are explicit and atomic with the replacement/projection; originals remain.
  FOR target IN SELECT value::text::uuid FROM jsonb_array_elements_text(coalesce(command->'retract_ids','[]')) LOOP
    SELECT * INTO previous FROM watching.viewing_records WHERE id = target FOR UPDATE;
    IF NOT FOUND OR previous.user_id <> actor OR previous.org_id <> item.org_id OR previous.media_item_id IS DISTINCT FROM mid OR previous.retracted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Retraction ownership/state mismatch' USING ERRCODE = '42501';
    END IF;
    IF nullif(command->>'reason','') IS NULL THEN RAISE EXCEPTION 'Retraction requires a reason'; END IF;
    UPDATE watching.viewing_records SET retracted_at = now(), retracted_by = actor, retraction_reason = command->>'reason', retraction_operation_key = op, retraction_operation_hash = fingerprint WHERE id = target;
    IF previous.kind = 'REWATCH' AND command->>'mode' <> 'remove_rewatch' THEN
      DELETE FROM watching.rewatches WHERE id = target AND user_id = actor AND media_item_id = mid;
    END IF;
  END LOOP;
  FOR record IN SELECT value FROM jsonb_array_elements(coalesce(command->'records','[]')) LOOP
    IF record->>'origin' NOT IN ('USER_ACTION','USER_CORRECTION') THEN RAISE EXCEPTION 'Origin not available to user commands'; END IF;
    IF record->>'supersedes_id' IS NOT NULL THEN
      SELECT * INTO previous FROM watching.viewing_records WHERE id = (record->>'supersedes_id')::uuid;
      IF NOT FOUND OR previous.user_id <> actor OR previous.org_id <> item.org_id OR previous.media_item_id IS DISTINCT FROM mid
        OR NOT (coalesce(command->'retract_ids','[]') ? previous.id::text) THEN
        RAISE EXCEPTION 'Correction must retract its own original' USING ERRCODE = '42501';
      END IF;
    END IF;
    INSERT INTO watching.viewing_records(org_id,user_id,media_item_id,work_key,title_snapshot,media_type_snapshot,
      kind,scope_kind,scope_key,completion_basis,year,month,day,date_precision,date_confidence,scope_confidence,
      operation_key,operation_index,operation_hash,origin,supersedes_id)
    VALUES (item.org_id,actor,mid,CASE WHEN item.tmdb_id IS NULL THEN 'local:' || mid ELSE
      CASE WHEN item.type = 'film' THEN 'movie:' ELSE 'tv:' END || item.tmdb_id END,item.title,item.type,
      record->>'kind',record->>'scope_kind',record->>'scope_key',record->>'completion_basis',
      (record->>'year')::integer,(record->>'month')::integer,(record->>'day')::integer,
      record->>'date_precision',record->>'date_confidence',record->>'scope_confidence',op,ordinal,fingerprint,
      record->>'origin',(record->>'supersedes_id')::uuid) RETURNING id INTO rid;
    ordinal := ordinal + 1;
    FOR coverage IN SELECT value FROM jsonb_array_elements(coalesce(record->'ranges','[]')) LOOP
      IF coverage ? 'viewing_record_id' THEN RAISE EXCEPTION 'Foreign range parent forbidden' USING ERRCODE = '42501'; END IF;
      IF coverage->>'season_key' IS DISTINCT FROM (CASE WHEN (coverage->>'season_number_at_recording')::integer = 0
          THEN 'movie' ELSE 'tmdb-season:' || (coverage->>'season_number_at_recording')::integer END) OR
        (item.type = 'film') IS DISTINCT FROM ((coverage->>'season_number_at_recording')::integer = 0) THEN
        RAISE EXCEPTION 'Inconsistent storage range coordinates';
      END IF;
      IF EXISTS (SELECT 1 FROM watching.viewing_ranges r WHERE r.viewing_record_id = rid AND r.season_key = coverage->>'season_key'
        AND r.episode_from <= (coverage->>'episode_to')::integer AND r.episode_to >= (coverage->>'episode_from')::integer) THEN
        RAISE EXCEPTION 'Overlapping viewing ranges';
      END IF;
      IF record->>'kind' = 'COMPLETION' AND ((coverage->>'minutes')::numeric IS DISTINCT FROM 0 OR coverage->>'duration_basis' IS DISTINCT FROM 'MILESTONE') THEN
        RAISE EXCEPTION 'Completion contributes zero additional duration';
      END IF;
      INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,episode_ids,minutes,duration_basis)
      VALUES (rid,coverage->>'season_key',(coverage->>'season_number_at_recording')::integer,
        (coverage->>'episode_from')::integer,(coverage->>'episode_to')::integer,
        CASE WHEN coverage->'episode_ids' IS NULL OR coverage->'episode_ids' = 'null' THEN NULL ELSE
          ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(coverage->'episode_ids')) END,
        (coverage->>'minutes')::numeric,coverage->>'duration_basis');
    END LOOP;
    IF record->>'kind' = 'REWATCH' THEN
      -- Legacy Stats projection only. Exact precision lives exclusively in viewing_records.
      IF record->>'date_precision' = 'UNKNOWN' THEN RAISE EXCEPTION 'Rewatch projection needs a year'; END IF;
      INSERT INTO watching.rewatches(id,org_id,user_id,media_item_id,watched_on)
      VALUES (rid,item.org_id,actor,mid,make_date((record->>'year')::integer,coalesce((record->>'month')::integer,1),coalesce((record->>'day')::integer,1)));
    END IF;
  END LOOP;
  IF command->>'mode' = 'remove_rewatch' THEN
    rewatch_id := (command->>'rewatch_id')::uuid;
    IF EXISTS (SELECT 1 FROM watching.viewing_records WHERE id = rewatch_id AND retracted_at IS NULL) THEN
      RAISE EXCEPTION 'A historical rewatch must be explicitly retracted';
    END IF;
    DELETE FROM watching.rewatches WHERE id = rewatch_id AND media_item_id = mid AND user_id = actor AND org_id = item.org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rewatch unavailable'; END IF;
  END IF;
  patch := patch || jsonb_build_object('history_version',CASE WHEN ordinal > 0 THEN 1 ELSE item.history_version END,
    'personal_operation_key',op,'personal_operation_hash',fingerprint,'updated_at',now());
  IF patch <> '{}' THEN
    SELECT string_agg(format('%I = p.%I', key,key), ', ') INTO assignments FROM jsonb_object_keys(patch) key;
    EXECUTE format('UPDATE watching.media_items m SET %s FROM jsonb_populate_record(NULL::watching.media_items,$1) p WHERE m.id=$2 RETURNING m.*',assignments) INTO item USING patch,mid;
  END IF;
  -- The trigger increments the revision for this command, in the same transaction.
  RETURN to_jsonb(item);
END $$;
REVOKE ALL ON FUNCTION watching.personal_history_command(jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION watching.personal_history_command(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION watching.personal_revision_guard() FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
