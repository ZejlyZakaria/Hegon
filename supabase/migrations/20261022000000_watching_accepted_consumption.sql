-- Accepted legacy estimates are frozen once, without claiming confirmed viewing history.
-- Existing dates, opinions, posture, canonical records and receipts are not rewritten.
BEGIN;
ALTER TABLE watching.media_items ADD COLUMN legacy_consumption jsonb;
COMMENT ON COLUMN watching.media_items.legacy_consumption IS
  'Immutable migration-time legacy estimate: storage season coverage and runtime, not confirmed history. Canonical first-watch assertions replace only overlapping coverage.';
CREATE OR REPLACE FUNCTION watching.personal_revision_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Use personal_history_command for inserts' USING ERRCODE = '42501'; END IF;
    NEW.personal_revision := 0;
    IF current_user <> 'postgres' THEN NEW.history_version := 0; NEW.viewing_date := NULL; NEW.legacy_consumption := NULL; END IF;
    RETURN NEW;
  END IF;
  IF current_user <> 'postgres' AND NEW.legacy_consumption IS DISTINCT FROM OLD.legacy_consumption THEN
    RAISE EXCEPTION 'Legacy consumption is immutable' USING ERRCODE='42501';
  END IF;
  changed := (to_jsonb(NEW) - ARRAY['legacy_consumption','updated_at','personal_revision','history_version','personal_operation_key','personal_operation_hash','title','original_title','description','poster_url','backdrop_url','year','runtime','seasons','episodes','rating','tmdb_id','directors','studio','status','season_episodes','season_posters','season_air_dates','cast_members','season_aired','last_synced_at','season_end_dates','release_date'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['legacy_consumption','updated_at','personal_revision','history_version','personal_operation_key','personal_operation_hash','title','original_title','description','poster_url','backdrop_url','year','runtime','seasons','episodes','rating','tmdb_id','directors','studio','status','season_episodes','season_posters','season_air_dates','cast_members','season_aired','last_synced_at','season_end_dates','release_date']);
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

WITH consumed AS (
 SELECT m.*, CASE WHEN season_aired IS NULL AND season_episodes IS NULL THEN jsonb_build_array(coalesce(episodes,CASE WHEN watched THEN 0 ELSE current_episode END,0))
   ELSE coalesce((SELECT jsonb_agg(coalesce(season_aired[n],(season_episodes->>(n-1))::integer,0) ORDER BY n)
     FROM generate_series(1,greatest(coalesce(cardinality(season_aired),0),coalesce(jsonb_array_length(season_episodes),0))) n),'[]') END AS counts
 FROM watching.media_items m
 WHERE NOT coalesce(is_reference,false) AND (watched OR in_progress OR paused OR dropped)
), snapshots AS (
 SELECT id,jsonb_build_object('version',1,'captured_at',transaction_timestamp(),
   'runtime',CASE WHEN runtime>0 THEN runtime ELSE NULL END,'completed',coalesce(watched,false),
   'storage_sizes',coalesce(season_episodes,to_jsonb(season_aired),jsonb_build_array(coalesce(episodes,0))),
   'fallback_year',extract(year FROM CASE WHEN watched THEN watched_at ELSE updated_at END)::integer,
   'counts',CASE WHEN type='film' THEN jsonb_build_array(CASE WHEN watched THEN 1 ELSE 0 END) ELSE
     coalesce((SELECT jsonb_agg(greatest(0,CASE WHEN watched OR ordinal<coalesce(current_season,1) THEN value::integer
       WHEN ordinal=coalesce(current_season,1) THEN least(coalesce(current_episode,0),value::integer) ELSE 0 END) ORDER BY ordinal)
       FROM jsonb_array_elements_text(counts) WITH ORDINALITY AS c(value,ordinal)),'[]') END) AS snapshot
 FROM consumed
)
UPDATE watching.media_items m SET legacy_consumption=s.snapshot FROM snapshots s WHERE m.id=s.id;

CREATE OR REPLACE FUNCTION watching.personal_history_command(command jsonb) RETURNS jsonb
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
  -- Freeze the accepted catalogue context before the media lock, in the same order as providers.
  IF command ? 'viewing_context' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('watching-provider:' || (SELECT 'tv:'||tmdb_id FROM watching.media_items WHERE id=mid AND user_id=actor),0));
    IF (command->'viewing_context'->>'snapshot_id')::uuid IS DISTINCT FROM
      (SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='tmdb' AND work_key=(SELECT 'tv:'||tmdb_id FROM watching.media_items WHERE id=mid AND user_id=actor)) OR
      (command->'viewing_context'->>'mapping_snapshot_id')::uuid IS DISTINCT FROM
      (SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='anilist' AND work_key=(SELECT 'tv:'||tmdb_id FROM watching.media_items WHERE id=mid AND user_id=actor)) THEN
      RAISE EXCEPTION 'Stale viewing catalogue; reload before recording' USING ERRCODE='40001';
    END IF;
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
    IF field IN ('legacy_consumption','id','personal_revision','history_version','personal_operation_key','personal_operation_hash','created_at','updated_at') OR
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
    IF record->>'kind' = 'REWATCH' AND record->>'date_precision' <> 'UNKNOWN' THEN
      -- Optional compatibility date only. UNKNOWN stays solely in canonical history.
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

CREATE OR REPLACE FUNCTION watching.receipt_source(p_org uuid,p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'items',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM (SELECT id,personal_revision,history_version,viewing_date,legacy_consumption,tmdb_id,type,title,original_title,poster_url,backdrop_url,year,runtime,status,caught_up_at,season_episodes,season_aired,episodes,user_rating,favorite,watched_at,tags,directors,watched,in_progress,paused,dropped,current_season,current_episode,updated_at,season_years,season_ratings,season_posters,season_end_dates,cour_years,cour_ratings FROM watching.media_items WHERE org_id=p_org AND user_id=p_user AND NOT coalesce(is_reference,false)) m),'[]'),
  'rewatches',coalesce((SELECT jsonb_agg(to_jsonb(rw) ORDER BY rw.id) FROM watching.rewatches rw WHERE rw.org_id=p_org AND rw.user_id=p_user),'[]'),
  'history',jsonb_build_object('records',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('ranges',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM watching.viewing_ranges v WHERE v.viewing_record_id=r.id),'[]')) ORDER BY r.id) FROM watching.viewing_records r WHERE r.org_id=p_org AND r.user_id=p_user),'[]'),
    'ratings',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM watching.scope_ratings s WHERE s.org_id=p_org AND s.user_id=p_user),'[]')),
  'cours',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.tmdb_id) FROM watching.anime_cours c WHERE c.tmdb_id IN (SELECT m.tmdb_id FROM watching.media_items m WHERE m.org_id=p_org AND m.user_id=p_user AND m.type='anime')),'[]'))
$$;

CREATE OR REPLACE FUNCTION watching.record_achievement_unlocks(p_org uuid,p_user uuid,p_hash text,p_metrics jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb; expected numeric;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE org_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Unauthorized owner' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('milestone:'||p_org||':'||p_user,0));
 IF md5(watching.receipt_source(p_org,p_user)::text) IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'Stale receipt observation' USING ERRCODE='40001'; END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(p_metrics) LOOP
  expected:=CASE m->>'achievement_key' WHEN 'cinephile' THEN 350 WHEN 'series_devotee' THEN 30 WHEN 'otaku' THEN 50 WHEN 'marathoner' THEN 3000 WHEN 'time_traveler' THEN 8 WHEN 'genre_nomad' THEN 25 WHEN 'auteur' THEN 12 WHEN 'big_year' THEN 50 WHEN 'long_hauler' THEN 100 WHEN 'ever_present' THEN 120 END;
  IF expected IS NULL OR (m->>'rule_version')::integer IS DISTINCT FROM 1 OR (m->>'target')::numeric IS DISTINCT FROM expected OR m->>'metric_key' IS DISTINCT FROM 'watching:'||(m->>'achievement_key')||':v1' THEN RAISE EXCEPTION 'Unknown achievement rule'; END IF;
  IF (m->>'actual_value')::numeric>=expected THEN
   INSERT INTO watching.achievement_unlocks(org_id,user_id,achievement_key,rule_version,metric_key,target,actual_value,evidence)
    VALUES(p_org,p_user,m->>'achievement_key',1,m->>'metric_key',expected,(m->>'actual_value')::numeric,jsonb_build_object('source','WATCHING_ACCEPTED_STATS_V1','source_hash',p_hash,'evidence_version',2)) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
