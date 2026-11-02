-- Prospective single-scope rating equivalence. No backfill or personal-data changes.
BEGIN;
-- A global opinion can alias a scoped opinion only while their proven membership is identical.
CREATE FUNCTION watching.whole_rating_scope(m jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE t jsonb; a jsonb; s jsonb; ctx jsonb; kind text:='SEASON';
BEGIN
  IF m->>'type' NOT IN ('serie','anime') OR coalesce((m->>'is_reference')::boolean,false) THEN RETURN NULL; END IF;
  SELECT p.facts INTO t FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id
    WHERE h.work_key='tv:'||(m->>'tmdb_id') AND h.provider='tmdb';
  IF jsonb_array_length(t->'seasons') IS DISTINCT FROM 1 OR jsonb_array_length(m->'season_episodes') IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
  s:=t->'seasons'->0;
  IF (s->>'number')::integer<>1 OR coalesce((s->>'aired')::integer,0)<=0 OR s->>'aired' IS DISTINCT FROM s->>'announced'
    OR (m->>'current_season')::integer<>1 OR coalesce((m->>'current_episode')::integer,0)<(s->>'aired')::integer THEN RETURN NULL; END IF;
  IF m->>'type'='anime' THEN
    SELECT p.facts INTO a FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id
      WHERE h.work_key='tv:'||(m->>'tmdb_id') AND h.provider='anilist';
    -- Missing evidence cannot prove that a flat TMDB season has no independent parts.
    IF a IS NULL OR jsonb_array_length(a->'cours')>1 THEN RETURN NULL; END IF;
    IF jsonb_array_length(a->'cours')=1 THEN kind:='COUR'; END IF;
  END IF;
  ctx:=watching.provider_scope('tv:'||(m->>'tmdb_id'),kind,1);
  IF jsonb_array_length(NULLIF(ctx->'ids','null')) IS DISTINCT FROM (s->>'aired')::integer THEN RETURN NULL; END IF;
  RETURN ctx||jsonb_build_object('kind',kind,'number',1);
END $$;
REVOKE ALL ON FUNCTION watching.whole_rating_scope(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION watching.scope_rating_context(mid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
#variable_conflict use_column
DECLARE m watching.media_items; s jsonb; ctx jsonb; r watching.scope_ratings; ids bigint[]; output jsonb:='[]'; kind text; num integer; legacy numeric; validity text; whole jsonb;
BEGIN
  SELECT * INTO m FROM watching.media_items WHERE id=mid AND user_id=auth.uid() AND org_id IN(SELECT public.my_orgs());
  IF m.id IS NULL THEN RAISE EXCEPTION 'Unauthorized media' USING ERRCODE='42501'; END IF;
  whole:=watching.whole_rating_scope(to_jsonb(m));
  FOR kind IN SELECT unnest(ARRAY['SEASON','COUR']) LOOP
    IF kind='COUR' AND m.type<>'anime' THEN CONTINUE; END IF;
    FOR num IN SELECT generate_series(1,greatest(coalesce(jsonb_array_length(m.season_episodes),0),coalesce((SELECT max((key)::integer) FROM jsonb_object_keys(CASE WHEN kind='COUR' THEN coalesce(m.cour_ratings,'{}') ELSE coalesce(m.season_ratings,'{}') END) key),0),
      CASE WHEN kind='COUR' THEN coalesce((SELECT (SELECT max((c->>'number')::integer) FROM jsonb_array_elements(p.facts->'cours') c) FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.work_key='tv:'||m.tmdb_id AND h.provider='anilist'),0) ELSE 0 END)) LOOP
      ctx:=watching.provider_scope('tv:'||m.tmdb_id,kind,num);
      SELECT * INTO r FROM watching.scope_ratings WHERE user_id=m.user_id AND org_id=m.org_id AND work_key='tv:'||m.tmdb_id AND scope_kind=kind AND scope_key=ctx->>'key' ORDER BY recorded_at DESC,id DESC LIMIT 1;
      legacy:=(CASE WHEN kind='COUR' THEN m.cour_ratings ELSE m.season_ratings END->>num::text)::numeric;
      IF r.id IS NULL AND EXISTS(SELECT 1 FROM watching.scope_ratings previous_slot WHERE previous_slot.user_id=m.user_id AND previous_slot.org_id=m.org_id
        AND previous_slot.work_key='tv:'||m.tmdb_id AND previous_slot.scope_kind=kind AND previous_slot.scope_number_at_recording=num
        AND previous_slot.scope_key<>ctx->>'key' AND previous_slot.scope_key ~ '^(anilist-cour|tmdb-season):') THEN legacy:=NULL; END IF;
      IF r.id IS NULL AND legacy IS NULL AND whole->>'kind'=kind AND whole->>'key'=ctx->>'key' THEN legacy:=m.user_rating; END IF;
      SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(NULLIF(ctx->'ids','null'));
      validity:=CASE WHEN r.id IS NULL THEN CASE WHEN legacy IS NULL THEN 'UNRATED' ELSE 'SCOPE_UNVERIFIED' END
        WHEN r.score IS NULL THEN 'UNRATED' WHEN EXISTS(SELECT 1 FROM watching.viewing_records v WHERE v.id=r.viewing_record_id AND v.retracted_at IS NOT NULL) THEN 'SCOPE_UNVERIFIED' WHEN r.episode_ids IS NULL OR ids IS NULL OR NOT r.episode_ids <@ ids THEN 'SCOPE_UNVERIFIED'
        WHEN ids <@ r.episode_ids THEN 'CURRENT' ELSE 'NEEDS_RECONFIRMATION' END;
      output:=output||jsonb_build_array(jsonb_build_object('kind',kind,'number',num,'scope_key',ctx->>'key','rating_id',r.id,'score',CASE WHEN r.id IS NULL THEN legacy ELSE r.score END,'validity',validity,'covered_episodes',cardinality(r.episode_ids),'provider_snapshot_id',ctx->>'snapshot_id','mapping_snapshot_id',ctx->>'mapping_snapshot_id','available_episodes',(ctx->>'available')::integer,'range_start',ctx->'start','range_end',ctx->'end'));
    END LOOP;
  END LOOP;
  RETURN output;
END $$;

CREATE OR REPLACE FUNCTION watching.scope_rating_command(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE actor uuid:=auth.uid(); mid uuid:=(command->>'media_id')::uuid; op uuid:=(command->>'operation_key')::uuid;
  fingerprint text:=encode(sha256(convert_to(command::text,'UTF8')),'hex'); m watching.media_items; previous watching.scope_ratings; receipt watching.scope_ratings; legacy_receipt watching.scope_ratings;
  w text; kind text:=command->>'scope_kind'; num integer:=(command->>'scope_number')::integer; ctx jsonb;
  ids bigint[]; score numeric:=(command->>'score')::numeric; act text:=command->>'action'; rid uuid; rating_id uuid; key text; whole jsonb; legacy_score numeric;
BEGIN
  IF actor IS NULL OR public.is_demo_user() THEN RAISE EXCEPTION 'Read only or unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO receipt FROM watching.scope_ratings WHERE user_id=actor AND operation_key=op;
  IF receipt.id IS NOT NULL THEN
    IF receipt.org_id NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Unauthorized receipt' USING ERRCODE='42501'; END IF;
    IF receipt.operation_hash<>fingerprint THEN RAISE EXCEPTION 'Operation key payload mismatch'; END IF;
    RETURN jsonb_build_object('rating_id',receipt.id,'media',(SELECT to_jsonb(i) FROM watching.media_items i WHERE id=receipt.media_item_id));
  END IF;
  SELECT 'tv:'||tmdb_id INTO w FROM watching.media_items WHERE id=mid AND user_id=actor;
  IF w IS NULL THEN RAISE EXCEPTION 'Unidentified or unavailable media'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('watching-provider:'||w,0));
  SELECT * INTO m FROM watching.media_items WHERE id=mid FOR UPDATE;
  IF m.id IS NULL OR m.user_id<>actor OR m.org_id NOT IN (SELECT public.my_orgs()) OR m.type='film' OR m.is_reference THEN RAISE EXCEPTION 'Unauthorized scope' USING ERRCODE='42501'; END IF;
  -- Recheck after lock for simultaneous retries.
  SELECT * INTO receipt FROM watching.scope_ratings WHERE user_id=actor AND operation_key=op;
  IF receipt.id IS NOT NULL THEN
    IF receipt.org_id NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Unauthorized receipt' USING ERRCODE='42501'; END IF;
    IF receipt.operation_hash<>fingerprint THEN RAISE EXCEPTION 'Operation key payload mismatch'; END IF;
    RETURN jsonb_build_object('rating_id',receipt.id,'media',to_jsonb(m));
  END IF;
  IF (command->>'expected_revision') IS NULL OR m.personal_revision<>(command->>'expected_revision')::bigint THEN RAISE EXCEPTION 'Stale personal revision' USING ERRCODE='40001'; END IF;
  IF kind IS NULL OR act IS NULL OR num IS NULL OR kind NOT IN ('SEASON','COUR') OR num<1 OR num>10000 OR (kind='COUR' AND m.type<>'anime') OR act NOT IN ('INITIAL','CONFIRM','REVISE','CORRECTION') OR op IS NULL THEN RAISE EXCEPTION 'Invalid rating command'; END IF;
  IF score IS NULL AND act<>'CORRECTION' THEN RAISE EXCEPTION 'Only correction can clear a rating'; END IF;
  IF score IS NOT NULL AND (score<=0 OR score>10) THEN RAISE EXCEPTION 'Invalid score'; END IF;
  IF kind='SEASON' AND num>greatest(coalesce(jsonb_array_length(m.season_episodes),0),1) THEN RAISE EXCEPTION 'Unknown season'; END IF;
  ctx:=watching.provider_scope(w,kind,num); key:=ctx->>'key';
  IF command->>'expected_scope_key' IS DISTINCT FROM key THEN RAISE EXCEPTION 'Stale scope identity' USING ERRCODE='40001'; END IF;
  IF (command->>'expected_snapshot_id')::uuid IS DISTINCT FROM (ctx->>'snapshot_id')::uuid OR
    (command->>'expected_mapping_snapshot_id')::uuid IS DISTINCT FROM (ctx->>'mapping_snapshot_id')::uuid THEN RAISE EXCEPTION 'Stale provider rating context' USING ERRCODE='40001'; END IF;
  IF kind='COUR' AND key LIKE 'unverified-%' AND m.cour_ratings->>num::text IS NULL THEN RAISE EXCEPTION 'Unknown cour mapping'; END IF;
  SELECT * INTO previous FROM watching.scope_ratings r WHERE r.user_id=actor AND r.org_id=m.org_id AND r.work_key=w AND r.scope_kind=kind AND r.scope_key=key ORDER BY recorded_at DESC,id DESC LIMIT 1;
  IF (command->>'previous_rating_id')::uuid IS DISTINCT FROM previous.id THEN RAISE EXCEPTION 'Stale rating assertion' USING ERRCODE='40001'; END IF;
  IF act='INITIAL' AND previous.id IS NOT NULL OR act IN ('CONFIRM','REVISE') AND previous.id IS NULL THEN RAISE EXCEPTION 'Invalid rating action'; END IF;
  IF act='CONFIRM' AND score IS DISTINCT FROM previous.score THEN RAISE EXCEPTION 'Confirmation must retain score'; END IF;
  whole:=watching.whole_rating_scope(to_jsonb(m));
  legacy_score:=coalesce((CASE WHEN kind='COUR' THEN m.cour_ratings ELSE m.season_ratings END->>num::text)::numeric,
    CASE WHEN whole->>'kind'=kind AND whole->>'key'=key THEN m.user_rating END);
  -- On an explicit legacy edit only, retain the old opinion with NULL coverage. Never backfill.
  IF legacy_score IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM watching.scope_ratings previous_slot WHERE previous_slot.user_id=actor AND previous_slot.org_id=m.org_id
      AND previous_slot.work_key=w AND previous_slot.scope_kind=kind AND previous_slot.scope_number_at_recording=num
      AND previous_slot.score=legacy_score) THEN
    INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,score,action,operation_key,operation_hash)
      VALUES(m.org_id,actor,mid,w,kind,'legacy-'||lower(kind)||':'||num,num,
        legacy_score,'INITIAL',gen_random_uuid(),'legacy-opinion:'||fingerprint) RETURNING * INTO legacy_receipt;
    -- Preserve an overwritten unbound slot, without attaching it to a remapped known subject.
    IF previous.id IS NULL AND NOT EXISTS(SELECT 1 FROM watching.scope_ratings previous_slot WHERE previous_slot.user_id=actor AND previous_slot.org_id=m.org_id
      AND previous_slot.work_key=w AND previous_slot.scope_kind=kind AND previous_slot.scope_number_at_recording=num
      AND previous_slot.scope_key<>key AND previous_slot.scope_key ~ '^(anilist-cour|tmdb-season):') THEN
      previous:=legacy_receipt;
      act:=CASE WHEN score IS NULL THEN 'CORRECTION' WHEN score=previous.score THEN 'CONFIRM' ELSE 'REVISE' END;
    END IF;
  END IF;
  SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(NULLIF(ctx->'ids','null'));
  IF score IS NOT NULL AND (ctx->>'available')::integer=0 THEN RAISE EXCEPTION 'No available content in this scope'; END IF;
  -- Rating an available scope explicitly claims its completion; dates remain UNKNOWN.
  IF ids IS NOT NULL AND score IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(ctx->'episodes') entry WHERE
      ((entry->>'season_number')::integer>coalesce(m.current_season,1) OR ((entry->>'season_number')::integer=coalesce(m.current_season,1) AND (entry->'episode'->>'number')::integer>coalesce(m.current_episode,0)))) THEN RAISE EXCEPTION 'Watch the available scope before rating or confirming it'; END IF;
    INSERT INTO watching.viewing_records(org_id,user_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
      VALUES(m.org_id,actor,mid,w,m.title,m.type,'COMPLETION',kind,key,'AVAILABLE_SCOPE','UNKNOWN','UNKNOWN','CONFIRMED',op,0,fingerprint,CASE WHEN act='CORRECTION' THEN 'USER_CORRECTION' ELSE 'USER_ACTION' END) RETURNING id INTO rid;
    INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,episode_ids,minutes,duration_basis)
      SELECT rid,'tmdb-season:'||(entry->>'season_number'),(entry->>'season_number')::integer,
        min((entry->'episode'->>'number')::integer),max((entry->'episode'->>'number')::integer),
        array_agg((entry->'episode'->>'id')::bigint ORDER BY (entry->'episode'->>'number')::integer),0,'MILESTONE'
      FROM jsonb_array_elements(ctx->'episodes') entry GROUP BY entry->>'season_number';
  END IF;
  INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,viewing_record_id,provider_snapshot_id,mapping_snapshot_id,episode_ids,score,previous_rating_id,action,operation_key,operation_hash)
    VALUES(m.org_id,actor,mid,w,kind,key,num,rid,(ctx->>'snapshot_id')::uuid,(ctx->>'mapping_snapshot_id')::uuid,ids,score,previous.id,act,op,fingerprint) RETURNING id INTO rating_id;
  -- One opinion, two compatibility projections only for an identical, fully seen scope.
  IF kind='COUR' THEN
    UPDATE watching.media_items SET user_rating=CASE WHEN whole->>'kind'=kind AND whole->>'key'=key THEN score ELSE user_rating END, cour_ratings=CASE WHEN score IS NULL THEN coalesce(cour_ratings,'{}')-num::text ELSE coalesce(cour_ratings,'{}')||jsonb_build_object(num::text,score) END,
      personal_operation_key=op,personal_operation_hash=fingerprint,history_version=CASE WHEN rid IS NULL THEN history_version ELSE 1 END WHERE id=mid RETURNING * INTO m;
  ELSE
    UPDATE watching.media_items SET user_rating=CASE WHEN whole->>'kind'=kind AND whole->>'key'=key THEN score ELSE user_rating END, season_ratings=CASE WHEN score IS NULL THEN coalesce(season_ratings,'{}')-num::text ELSE coalesce(season_ratings,'{}')||jsonb_build_object(num::text,score) END,
      personal_operation_key=op,personal_operation_hash=fingerprint,history_version=CASE WHEN rid IS NULL THEN history_version ELSE 1 END WHERE id=mid RETURNING * INTO m;
  END IF;
  RETURN jsonb_build_object('rating_id',rating_id,'media',to_jsonb(m));
END $$;

CREATE OR REPLACE FUNCTION watching.personal_history_command(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_variable
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
  backwards_correction boolean:=false; target_sn integer; target_ep integer;
  correction_before jsonb; audit_row watching.progress_corrections;
  frozen_ranges jsonb; clipped_ranges jsonb; clipped_counts jsonb;
  relation text; scope_num integer; scope_kind text; scope_slot text;
  opinion watching.scope_ratings; map_field text; map_value jsonb;
  identified boolean; all_invalid boolean;
  whole jsonb; rating_previous watching.scope_ratings; rating_receipt watching.scope_ratings; whole_ids bigint[];
  removed_years integer[]:='{}'; kept_years integer[]:='{}';
  date_field text; date_value jsonb; date_year integer; date_month integer; date_day integer; solely_removed boolean;
BEGIN
  IF actor IS NULL OR public.is_demo_user() OR op IS NULL OR mid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized personal command' USING ERRCODE = '42501';
  END IF;
  IF command->>'mode' IS NULL OR command->>'mode' NOT IN ('insert','update','rewatch','remove_rewatch') THEN
    RAISE EXCEPTION 'Unknown personal command';
  END IF;
  -- Scoped opinion receipts also preserve retries of global edits after later commands.
  SELECT * INTO rating_receipt FROM watching.scope_ratings WHERE user_id=actor AND operation_key=op;
  IF FOUND THEN
    IF rating_receipt.operation_hash<>fingerprint THEN RAISE EXCEPTION 'Operation key reused with different input'; END IF;
    IF rating_receipt.org_id NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
    RETURN (SELECT to_jsonb(m) FROM watching.media_items m WHERE id=rating_receipt.media_item_id AND user_id=actor);
  END IF;
  -- Serializes retries, including inserts, without a speculative event/command table.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || op::text, 0));
  SELECT * INTO audit_row FROM watching.progress_corrections WHERE user_id=actor AND operation_key=op;
  IF FOUND THEN
    IF audit_row.operation_hash<>fingerprint THEN RAISE EXCEPTION 'Operation key reused with different input'; END IF;
    IF audit_row.org_id NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
    RETURN (SELECT to_jsonb(m) FROM watching.media_items m WHERE m.id=audit_row.media_item_id AND m.user_id=actor);
  END IF;
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
  IF command ? 'viewing_context' OR command->>'history_intent'='correction' OR patch ? 'user_rating' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('watching-provider:' || (SELECT 'tv:'||tmdb_id FROM watching.media_items WHERE id=mid AND user_id=actor),0));
    IF command ? 'viewing_context' AND ((command->'viewing_context'->>'snapshot_id')::uuid IS DISTINCT FROM
      (SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='tmdb' AND work_key=(SELECT 'tv:'||tmdb_id FROM watching.media_items WHERE id=mid AND user_id=actor)) OR
      (command->'viewing_context'->>'mapping_snapshot_id')::uuid IS DISTINCT FROM
      (SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='anilist' AND work_key=(SELECT 'tv:'||tmdb_id FROM watching.media_items WHERE id=mid AND user_id=actor))) THEN
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
  target_sn:=coalesce((patch->>'current_season')::integer,item.current_season,1);
  target_ep:=coalesce((patch->>'current_episode')::integer,item.current_episode,0);
  IF target_sn<1 OR target_ep<0 THEN RAISE EXCEPTION 'Invalid correction position'; END IF;
  backwards_correction:=coalesce(command->>'history_intent'='correction' AND item.type<>'film' AND
    (target_sn<coalesce(item.current_season,1) OR target_sn=coalesce(item.current_season,1) AND target_ep<coalesce(item.current_episode,0)),false);
  IF backwards_correction THEN correction_before:=to_jsonb(item); END IF;
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
  IF backwards_correction THEN
    -- Correct the first-view assertion, never a separate rewatch. Frozen ranges win over labels.
    FOR previous IN SELECT * FROM watching.viewing_records
      WHERE media_item_id=mid AND user_id=actor AND org_id=item.org_id AND retracted_at IS NULL AND kind<>'REWATCH'
      ORDER BY recorded_at,id FOR UPDATE LOOP
      SELECT coalesce(jsonb_agg(to_jsonb(r)-ARRAY['id','viewing_record_id'] ORDER BY season_number_at_recording,episode_from),'[]')
        INTO frozen_ranges FROM watching.viewing_ranges r WHERE viewing_record_id=previous.id;
      SELECT scope_number_at_recording INTO scope_num FROM watching.scope_ratings
        WHERE viewing_record_id=previous.id AND user_id=actor AND org_id=item.org_id ORDER BY recorded_at DESC LIMIT 1;
      IF scope_num IS NULL AND previous.scope_key ~ '^(tmdb-season|cour):[1-9][0-9]*$' THEN
        scope_num:=split_part(previous.scope_key,':',2)::integer;
        IF previous.scope_kind='SEASON' AND scope_num>jsonb_array_length(coalesce(to_jsonb(item.season_episodes),'[]')) THEN scope_num:=NULL; END IF;
      END IF;
      relation:=watching.progress_scope_relation(to_jsonb(item),previous.scope_kind,previous.scope_key,scope_num,target_sn,target_ep,frozen_ranges);
      IF relation='UNKNOWN' AND item.watched AND previous.kind='COMPLETION' AND previous.completion_basis='FINISHED_TITLE'
        AND NOT EXISTS(SELECT 1 FROM watching.viewing_records newer WHERE newer.media_item_id=mid AND newer.kind='COMPLETION' AND newer.completion_basis='FINISHED_TITLE' AND newer.retracted_at IS NULL AND (newer.recorded_at,newer.id)>(previous.recorded_at,previous.id)) THEN
        -- A full-title completion is contradicted by an explicit first-view rollback.
        relation:='PARTIAL';
      END IF;
      IF relation='REMOVED' OR relation='PARTIAL' AND (previous.kind='COMPLETION' OR jsonb_array_length(frozen_ranges)>0) THEN
        UPDATE watching.viewing_records SET retracted_at=clock_timestamp(),retracted_by=actor,
          retraction_reason='Backwards progression correction',retraction_operation_key=op,retraction_operation_hash=fingerprint WHERE id=previous.id;
        command:=jsonb_set(command,'{retract_ids}',coalesce(command->'retract_ids','[]')||jsonb_build_array(previous.id));
        IF previous.kind='FIRST_WATCH' AND relation='PARTIAL' THEN
          SELECT coalesce(jsonb_agg(r || jsonb_build_object('episode_to',least((r->>'episode_to')::integer,
            CASE WHEN (r->>'season_number_at_recording')::integer<target_sn THEN (r->>'episode_to')::integer ELSE target_ep END),
            'episode_ids',CASE WHEN jsonb_typeof(r->'episode_ids')='array' THEN
              (SELECT jsonb_agg(value ORDER BY i) FROM jsonb_array_elements(r->'episode_ids') WITH ORDINALITY t(value,i)
                WHERE i<=least((r->>'episode_to')::integer,CASE WHEN (r->>'season_number_at_recording')::integer<target_sn THEN (r->>'episode_to')::integer ELSE target_ep END)-(r->>'episode_from')::integer+1)
              ELSE 'null'::jsonb END,
            'minutes',CASE WHEN r->>'minutes' IS NULL THEN NULL ELSE (r->>'minutes')::numeric *
              (least((r->>'episode_to')::integer,CASE WHEN (r->>'season_number_at_recording')::integer<target_sn THEN (r->>'episode_to')::integer ELSE target_ep END)-(r->>'episode_from')::integer+1) /
              ((r->>'episode_to')::integer-(r->>'episode_from')::integer+1) END)),'[]')
            INTO clipped_ranges FROM jsonb_array_elements(frozen_ranges) r
            WHERE (r->>'season_number_at_recording')::integer<target_sn OR
              (r->>'season_number_at_recording')::integer=target_sn AND (r->>'episode_from')::integer<=target_ep;
          command:=jsonb_set(command,'{records}',coalesce(command->'records','[]')||jsonb_build_array(
            (to_jsonb(previous)-ARRAY['id','recorded_at','retracted_at','retracted_by'])||jsonb_build_object(
              'supersedes_id',previous.id,'origin','USER_CORRECTION','ranges',clipped_ranges)));
        END IF;
      END IF;
    END LOOP;
  END IF;

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
  IF backwards_correction THEN
    IF item.legacy_consumption IS NOT NULL THEN
      SELECT jsonb_agg(CASE WHEN i<target_sn THEN value::integer WHEN i=target_sn THEN least(value::integer,target_ep) ELSE 0 END ORDER BY i)
        INTO clipped_counts FROM jsonb_array_elements_text(item.legacy_consumption->'counts') WITH ORDINALITY t(value,i);
      IF clipped_counts IS DISTINCT FROM item.legacy_consumption->'counts' THEN
        patch:=patch||jsonb_build_object('legacy_consumption',item.legacy_consumption||jsonb_build_object('counts',clipped_counts,'completed',false));
      END IF;
    END IF;
    FOR map_field IN SELECT unnest(ARRAY['season_years','cour_years','season_ratings','cour_ratings']) LOOP
      map_value:=coalesce(nullif(patch->map_field,'null'),to_jsonb(item)->map_field,'{}');
      IF jsonb_typeof(map_value)<>'object' THEN map_value:='{}'; END IF;
      scope_kind:=CASE WHEN map_field LIKE 'cour_%' THEN 'COUR' ELSE 'SEASON' END;
      FOR scope_slot IN SELECT key FROM jsonb_each(map_value) LOOP
        scope_num:=scope_slot::integer;
        frozen_ranges:=NULL;
        -- A compatibility value has no stable identity of its own. Resolve every possible
        -- leaf subject by scope_key, never choose an owner by ordinal/score coincidence.
        -- Preserve the slot if ANY identified subject is kept or uncertain.
        identified:=false; all_invalid:=true;
        FOR opinion IN SELECT DISTINCT ON (r.scope_key) r.* FROM watching.scope_ratings r
          WHERE r.media_item_id=mid AND r.user_id=actor AND r.org_id=item.org_id AND r.scope_kind=scope_kind
            AND r.score IS NOT NULL AND r.scope_number_at_recording=scope_num AND (map_field LIKE '%years' OR r.score=(map_value->>scope_slot)::numeric)
            AND NOT EXISTS(SELECT 1 FROM watching.scope_ratings successor WHERE successor.previous_rating_id=r.id)
          ORDER BY r.scope_key,r.recorded_at DESC,r.id DESC LOOP
          identified:=true;
          SELECT jsonb_agg(to_jsonb(r)) INTO frozen_ranges FROM watching.viewing_ranges r WHERE viewing_record_id=opinion.viewing_record_id;
          relation:=watching.progress_scope_relation(to_jsonb(item),scope_kind,opinion.scope_key,scope_num,target_sn,target_ep,frozen_ranges);
          IF NOT (relation='REMOVED' OR map_field LIKE '%ratings' AND relation='PARTIAL' AND frozen_ranges IS NOT NULL) THEN
            all_invalid:=false; EXIT;
          END IF;
        END LOOP;
        IF NOT identified THEN
          relation:=watching.progress_scope_relation(to_jsonb(item),scope_kind,NULL,scope_num,target_sn,target_ep,NULL);
          all_invalid:=relation='REMOVED';
        END IF;
        IF all_invalid THEN
          IF map_field LIKE '%years' THEN removed_years:=array_append(removed_years,(map_value->>scope_slot)::integer); END IF;
          map_value:=map_value-scope_slot;
        END IF;
      END LOOP;
      IF map_value IS DISTINCT FROM coalesce(to_jsonb(item)->map_field,'{}') THEN patch:=patch||jsonb_build_object(map_field,map_value); END IF;
    END LOOP;
    -- Append a clear to each invalid opinion lineage. Prior opinions remain immutable audit.
    FOR opinion IN SELECT r.* FROM watching.scope_ratings r
      WHERE r.media_item_id=mid AND r.user_id=actor AND r.org_id=item.org_id AND r.score IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM watching.scope_ratings successor WHERE successor.previous_rating_id=r.id)
      ORDER BY r.recorded_at,r.id FOR UPDATE LOOP
      SELECT jsonb_agg(to_jsonb(r)) INTO frozen_ranges FROM watching.viewing_ranges r WHERE viewing_record_id=opinion.viewing_record_id;
      relation:=watching.progress_scope_relation(to_jsonb(item),opinion.scope_kind,opinion.scope_key,
        opinion.scope_number_at_recording,target_sn,target_ep,frozen_ranges);
      IF relation='REMOVED' OR relation='PARTIAL' AND frozen_ranges IS NOT NULL OR EXISTS(
        SELECT 1 FROM watching.viewing_records v WHERE v.id=opinion.viewing_record_id AND v.retraction_operation_key=op
      ) THEN
        INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,
          score,previous_rating_id,action,operation_key,operation_hash)
        VALUES(item.org_id,actor,mid,opinion.work_key,opinion.scope_kind,opinion.scope_key,opinion.scope_number_at_recording,
          NULL,opinion.id,'CORRECTION',gen_random_uuid(),fingerprint);
        -- Compatibility slots were resolved once above against ALL possible stable subjects.
        -- Clearing this lineage must not erase another subject's equal-valued projection.
      END IF;
    END LOOP;
    -- Invalidate a calendar projection only on exclusive evidence. Never invent its replacement.
    SELECT coalesce(array_agg(value::integer),'{}') INTO kept_years FROM jsonb_each_text(
      coalesce(patch->'season_years',to_jsonb(item.season_years),'{}')) y;
    SELECT kept_years||coalesce(array_agg(value::integer),'{}') INTO kept_years FROM jsonb_each_text(coalesce(patch->'cour_years',to_jsonb(item.cour_years),'{}'));
    FOR date_field IN SELECT unnest(ARRAY['watched_at','viewing_date','last_watched_at','legacy_calendar']) LOOP
      date_value:=CASE date_field WHEN 'viewing_date' THEN to_jsonb(item.viewing_date)
        WHEN 'legacy_calendar' THEN item.legacy_consumption->'calendar_date' ELSE to_jsonb(item)->date_field END;
      IF date_value IS NULL OR date_value='null' THEN CONTINUE; END IF;
      date_year:=CASE WHEN date_field='viewing_date' THEN (date_value->>'year')::integer ELSE left(date_value#>>'{}',4)::integer END;
      date_month:=CASE WHEN date_field='viewing_date' THEN (date_value->>'month')::integer ELSE substring(date_value#>>'{}',6,2)::integer END;
      date_day:=CASE WHEN date_field='viewing_date' THEN (date_value->>'day')::integer ELSE substring(date_value#>>'{}',9,2)::integer END;
      solely_removed:=date_year=ANY(removed_years) AND NOT date_year=ANY(kept_years);
      solely_removed:=solely_removed OR (EXISTS(SELECT 1 FROM watching.viewing_records v WHERE v.media_item_id=mid AND v.user_id=actor
        AND v.retraction_operation_key=op AND v.year=date_year AND v.month IS NOT DISTINCT FROM date_month AND v.day IS NOT DISTINCT FROM date_day)
        AND NOT date_year=ANY(kept_years));
      IF solely_removed AND NOT EXISTS(SELECT 1 FROM watching.viewing_records v WHERE v.media_item_id=mid AND v.user_id=actor
        AND v.retracted_at IS NULL AND v.year=date_year AND (v.month IS NULL OR date_month IS NULL OR v.month=date_month)
        AND (v.day IS NULL OR date_day IS NULL OR v.day=date_day)) THEN
        IF date_field='legacy_calendar' THEN
          patch:=patch||jsonb_build_object('legacy_consumption',coalesce(patch->'legacy_consumption',item.legacy_consumption)||jsonb_build_object('calendar_date',NULL));
        ELSIF NOT patch ? date_field OR patch->date_field IS NOT DISTINCT FROM to_jsonb(item)->date_field THEN
          patch:=patch||jsonb_build_object(date_field,NULL);
          IF date_field='watched_at' AND item.legacy_consumption IS NOT NULL AND NOT item.legacy_consumption ? 'calendar_date' THEN
            patch:=patch||jsonb_build_object('legacy_consumption',coalesce(patch->'legacy_consumption',item.legacy_consumption)||jsonb_build_object('calendar_date',NULL));
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- A compatibility finish projection must not redate unrelated legacy consumption.
  -- Reserved-field validation ran above; only this trusted command can add this snapshot fact.
  IF patch ? 'watched_at' AND (patch->>'watched_at')::timestamp IS DISTINCT FROM item.watched_at
     AND item.legacy_consumption IS NOT NULL AND NOT (item.legacy_consumption ? 'calendar_date') AND NOT patch ? 'legacy_consumption' THEN
    patch := patch || jsonb_build_object('legacy_consumption',item.legacy_consumption || jsonb_build_object('calendar_date',item.watched_at));
  END IF;
  -- Global edits of a proven single scope go through the same append-only opinion ledger.
  -- No backfill: only an explicit score change creates a new assertion; unknown dates stay unknown.
  IF patch ? 'user_rating' AND patch->'user_rating' IS DISTINCT FROM to_jsonb(item)->'user_rating' THEN
    whole:=watching.whole_rating_scope(to_jsonb(item)||patch);
    IF whole IS NOT NULL THEN
      SELECT * INTO rating_previous FROM watching.scope_ratings r WHERE r.user_id=actor AND r.org_id=item.org_id
        AND r.work_key='tv:'||item.tmdb_id AND r.scope_kind=whole->>'kind' AND r.scope_key=whole->>'key'
        ORDER BY recorded_at DESC,id DESC LIMIT 1;
      IF rating_previous.id IS NULL AND item.user_rating IS NOT NULL THEN
        INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,
          score,action,operation_key,operation_hash)
          VALUES(item.org_id,actor,mid,'tv:'||item.tmdb_id,whole->>'kind','legacy-'||lower(whole->>'kind')||':1',1,
            item.user_rating,'INITIAL',gen_random_uuid(),'legacy-opinion:'||fingerprint) RETURNING * INTO rating_previous;
      END IF;
      SELECT array_agg(value::bigint) INTO whole_ids FROM jsonb_array_elements_text(whole->'ids');
      INSERT INTO watching.viewing_records(org_id,user_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,
        completion_basis,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
        VALUES(item.org_id,actor,mid,'tv:'||item.tmdb_id,item.title,item.type,'COMPLETION',whole->>'kind',whole->>'key',
          'AVAILABLE_SCOPE','UNKNOWN','UNKNOWN','CONFIRMED',op,ordinal,fingerprint,'USER_ACTION') RETURNING id INTO rid;
      ordinal:=ordinal+1;
      INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,episode_ids,minutes,duration_basis)
        SELECT rid,'tmdb-season:1',1,min((e->'episode'->>'number')::integer),max((e->'episode'->>'number')::integer),whole_ids,0,'MILESTONE'
        FROM jsonb_array_elements(whole->'episodes') e;
      INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,viewing_record_id,
        provider_snapshot_id,mapping_snapshot_id,episode_ids,score,previous_rating_id,action,operation_key,operation_hash)
        VALUES(item.org_id,actor,mid,'tv:'||item.tmdb_id,whole->>'kind',whole->>'key',1,rid,(whole->>'snapshot_id')::uuid,
          (whole->>'mapping_snapshot_id')::uuid,whole_ids,(patch->>'user_rating')::numeric,rating_previous.id,
          CASE WHEN patch->>'user_rating' IS NULL THEN 'CORRECTION' WHEN rating_previous.id IS NULL THEN 'INITIAL' ELSE 'REVISE' END,op,fingerprint);
      map_field:=CASE WHEN whole->>'kind'='COUR' THEN 'cour_ratings' ELSE 'season_ratings' END;
      map_value:=coalesce(nullif(patch->map_field,'null'),to_jsonb(item)->map_field,'{}');
      patch:=patch||jsonb_build_object(map_field,CASE WHEN patch->>'user_rating' IS NULL THEN map_value-'1' ELSE map_value||jsonb_build_object('1',patch->'user_rating') END);
    END IF;
  END IF;
  patch := patch || jsonb_build_object('history_version',CASE WHEN ordinal > 0 THEN 1 ELSE item.history_version END,
    'personal_operation_key',op,'personal_operation_hash',fingerprint,'updated_at',now());
  IF patch <> '{}' THEN
    SELECT string_agg(format('%I = p.%I', key,key), ', ') INTO assignments FROM jsonb_object_keys(patch) key;
    EXECUTE format('UPDATE watching.media_items m SET %s FROM jsonb_populate_record(NULL::watching.media_items,$1) p WHERE m.id=$2 RETURNING m.*',assignments) INTO item USING patch,mid;
  END IF;
  IF backwards_correction THEN
    INSERT INTO watching.progress_corrections(operation_key,operation_hash,user_id,org_id,media_item_id,work_key,before_state,after_state,reason)
    VALUES(op,fingerprint,actor,item.org_id,mid,CASE WHEN item.tmdb_id IS NULL THEN 'local:'||mid ELSE 'tv:'||item.tmdb_id END,
      correction_before,to_jsonb(item),'Explicit backwards progression correction');
  END IF;
  -- The trigger increments the revision for this command, in the same transaction.
  RETURN to_jsonb(item);
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
