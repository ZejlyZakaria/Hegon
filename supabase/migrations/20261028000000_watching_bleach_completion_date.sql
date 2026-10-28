-- Owner-authorized, single-title repair. No automatic historical backfill.
-- Evidence: CONFIRMED first viewing of S2E50 on 2026-10-28 and explicit Finish that day.
-- Preserve S1=2020, old S2=2023 and all existing consumption/rating/rewatch membership.
-- The UNKNOWN completion remains retained as a retracted predecessor of one dated correction.
BEGIN;
-- Preserve legacy calendar facts for every future guarded date-projection update.
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
  -- A compatibility finish projection must not redate unrelated legacy consumption.
  -- Reserved-field validation ran above; only this trusted command can add this snapshot fact.
  IF patch ? 'watched_at' AND (patch->>'watched_at')::timestamp IS DISTINCT FROM item.watched_at
     AND item.legacy_consumption IS NOT NULL AND NOT (item.legacy_consumption ? 'calendar_date') THEN
    patch := patch || jsonb_build_object('legacy_consumption',item.legacy_consumption || jsonb_build_object('calendar_date',item.watched_at));
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


DO $repair$
DECLARE
  owner_id constant uuid := 'de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64';
  organization constant uuid := '26f017a1-c27f-4690-9032-317e3193373d';
  media_id constant uuid := 'f113dc29-35b8-45d0-b501-f007f486a958';
  old_id constant uuid := 'ebdd745a-5278-4552-877f-03e0c0861f80';
  operation constant uuid := 'a4e5b083-35db-4e1e-8ce0-a5a2fc1d2161';
  replacement constant jsonb := $completion${"kind":"COMPLETION","scope_kind":"EPISODES","scope_key":null,"completion_basis":"FINISHED_TITLE","scope_confidence":"INFERRED","year":2026,"month":10,"day":28,"date_precision":"DAY","date_confidence":"CONFIRMED","origin":"USER_CORRECTION","supersedes_id":"ebdd745a-5278-4552-877f-03e0c0861f80","ranges":[{"minutes":0,"episode_to":366,"season_key":"tmdb-season:1","episode_ids":null,"episode_from":1,"duration_basis":"MILESTONE","season_number_at_recording":1},{"minutes":0,"episode_to":50,"season_key":"tmdb-season:2","episode_ids":null,"episode_from":1,"duration_basis":"MILESTONE","season_number_at_recording":2}]}$completion$;
  item watching.media_items;
  prior watching.viewing_records;
  saved jsonb;
  original jsonb;
  original_ranges jsonb;
  old_sub text := current_setting('request.jwt.claim.sub',true);
  old_claims text := current_setting('request.jwt.claims',true);
BEGIN
  -- Idempotent in local rehearsal; Supabase normally applies each version once.
  IF EXISTS(SELECT 1 FROM watching.viewing_records WHERE user_id=owner_id AND operation_key=operation) THEN
    IF NOT EXISTS(SELECT 1 FROM watching.viewing_records WHERE user_id=owner_id AND operation_key=operation
      AND supersedes_id=old_id AND kind='COMPLETION' AND year=2026 AND month=10 AND day=28 AND date_precision='DAY') THEN
      RAISE EXCEPTION 'Bleach repair operation identity mismatch';
    END IF;
    RETURN;
  END IF;
  SELECT * INTO item FROM watching.media_items WHERE id=media_id FOR UPDATE;
  IF NOT FOUND OR item.user_id<>owner_id OR item.org_id<>organization OR item.tmdb_id<>30984 OR item.type<>'anime'
     OR item.personal_revision<>7 OR NOT item.watched OR item.in_progress
     OR item.current_season<>2 OR item.current_episode<>50 OR item.season_aired IS DISTINCT FROM ARRAY[366,50]
     OR item.watched_at IS DISTINCT FROM timestamp '2023-12-31 12:00:00'
     OR item.season_years IS DISTINCT FROM '{"1":2020,"2":2023}'::jsonb
     OR item.viewing_date IS DISTINCT FROM '{"year":2026,"month":10,"day":28}'::jsonb THEN
    RAISE EXCEPTION 'Bleach changed since the approved repair; recheck before applying';
  END IF;
  SELECT * INTO prior FROM watching.viewing_records WHERE id=old_id FOR UPDATE;
  IF NOT FOUND OR prior.media_item_id<>media_id OR prior.user_id<>owner_id OR prior.org_id<>organization
     OR prior.retracted_at IS NOT NULL OR prior.kind<>'COMPLETION' OR prior.completion_basis<>'FINISHED_TITLE'
     OR prior.date_precision<>'UNKNOWN' OR prior.year IS NOT NULL THEN
    RAISE EXCEPTION 'Bleach original completion changed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM watching.viewing_records r JOIN watching.viewing_ranges v ON v.viewing_record_id=r.id
    WHERE r.id='d0081203-bef6-46cb-8aed-2d38faf5b1e0' AND r.media_item_id=media_id AND r.user_id=owner_id AND r.org_id=organization
      AND r.kind='FIRST_WATCH' AND r.retracted_at IS NULL AND r.date_confidence='CONFIRMED' AND r.date_precision='DAY'
      AND r.year=2026 AND r.month=10 AND r.day=28 AND v.season_number_at_recording=2 AND v.episode_from=50 AND v.episode_to=50) THEN
    RAISE EXCEPTION 'Bleach final-episode date evidence changed';
  END IF;
  SELECT jsonb_agg(to_jsonb(v)-ARRAY['id','viewing_record_id'] ORDER BY season_number_at_recording,episode_from)
    INTO original_ranges FROM watching.viewing_ranges v WHERE viewing_record_id=old_id;
  IF original_ranges IS DISTINCT FROM replacement->'ranges' THEN RAISE EXCEPTION 'Bleach frozen completion membership changed'; END IF;
  original:=to_jsonb(item);
  -- Use the existing guarded command, not manual edits of immutable historical rows.
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  saved:=watching.personal_history_command(jsonb_build_object('mode','update','media_id',media_id,'operation_key',operation,
    'expected_revision',item.personal_revision,'patch',jsonb_build_object('watched_at','2026-10-28T12:00:00Z'),
    'retract_ids',jsonb_build_array(old_id),'records',jsonb_build_array(replacement),
    'reason','Owner-confirmed completion on the recorded final-episode day; preserve all earlier viewing'));
  PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
  SELECT to_jsonb(m) INTO saved FROM watching.media_items m WHERE id=media_id;
  IF (saved-ARRAY['watched_at','updated_at','personal_revision','personal_operation_key','personal_operation_hash','legacy_consumption']) IS DISTINCT FROM
     (original-ARRAY['watched_at','updated_at','personal_revision','personal_operation_key','personal_operation_hash','legacy_consumption'])
     OR ((saved->'legacy_consumption')-'calendar_date') IS DISTINCT FROM (original->'legacy_consumption')
     OR saved->'legacy_consumption'->'calendar_date' IS DISTINCT FROM original->'watched_at'
     OR (saved->>'watched_at')::timestamp<>timestamp '2026-10-28 12:00:00'
     OR (saved->>'personal_revision')::bigint<>(original->>'personal_revision')::bigint+1 THEN
    RAISE EXCEPTION 'Bleach repair changed an unrelated personal field';
  END IF;
END $repair$;
NOTIFY pgrst, 'reload schema';
COMMIT;
