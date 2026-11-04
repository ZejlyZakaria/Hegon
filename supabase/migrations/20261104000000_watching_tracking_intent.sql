-- Prospective only. One availability signal; no historical data repair or backfill.
BEGIN;
ALTER TABLE watching.media_items ADD COLUMN resume_required boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN watching.media_items.resume_required IS 'Proven new content after a completed scope; availability is not an intention to resume. Cleared by an explicit Resume or forward viewing, never a correction.';
CREATE OR REPLACE FUNCTION watching.observe_provider(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE
  p text:=command->>'provider'; w text:=command->>'work_key'; f jsonb:=command->'facts';
  h watching.provider_heads; accepted watching.provider_snapshots; latest watching.provider_snapshots;
  classification text; reason text; sid uuid; fp text; take boolean:=false; growth boolean:=false;
  old_ids bigint[]; new_ids bigint[]; removed boolean; count_down boolean; new_content integer; proved integer;
  sa integer[]; se integer[]; ends text[]; m watching.media_items; seen integer; before_seen integer; sn integer; aired_total integer;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'Provider command unavailable' USING ERRCODE='42501'; END IF;
  IF p IS NULL OR w IS NULL OR p NOT IN ('tmdb','anilist') OR w !~ '^tv:[1-9][0-9]*$' THEN RAISE EXCEPTION 'Invalid provider/work'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('watching-provider:'||w,0));
  INSERT INTO watching.provider_heads(provider,work_key,refresh_outcome) VALUES(p,w,'FAILED') ON CONFLICT DO NOTHING;
  SELECT * INTO h FROM watching.provider_heads WHERE provider=p AND work_key=w FOR UPDATE;
  IF f IS NULL OR f='null'::jsonb OR NOT watching.valid_provider_facts(p,f) THEN
    UPDATE watching.provider_heads SET checked_at=clock_timestamp(),refresh_outcome='FAILED',error_code=coalesce(command->>'error_code','INVALID_RESPONSE') WHERE provider=p AND work_key=w;
    RETURN jsonb_build_object('classification','FAILED','accepted',false,'growth',false);
  END IF;
  -- Validate optional animation credits before even an UNCHANGED observation can refresh them.
  IF p='anilist' AND (command->'projection' ? 'cours') AND (
    jsonb_typeof(command->'projection'->'cours') IS DISTINCT FROM 'array' OR
    jsonb_array_length(command->'projection'->'cours')<>jsonb_array_length(f->'cours') OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(f->'cours') compact WHERE NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') c WHERE compact->>'id'=c->>'anilist_id'
        AND compact->>'number'=c->>'season' AND compact->>'start'=c->>'start_episode'
        AND compact->>'end' IS NOT DISTINCT FROM c->>'end_episode' AND compact->>'announced' IS NOT DISTINCT FROM c->>'episodes')) OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') c GROUP BY c->>'anilist_id' HAVING count(*)>1)
  ) THEN RAISE EXCEPTION 'Invalid cour projection'; END IF;
  IF p='anilist' THEN
    FOR sn IN SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') c WHERE c ? 'studios' AND jsonb_typeof(c->'studios') IS DISTINCT FROM 'array' LOOP
      RAISE EXCEPTION 'Invalid animation studio metadata';
    END LOOP;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') c CROSS JOIN LATERAL jsonb_array_elements(coalesce(c->'studios','[]')) studio
      WHERE jsonb_typeof(studio) IS DISTINCT FROM 'object' OR coalesce(studio->>'id','') !~ '^[1-9][0-9]*$' OR
        jsonb_typeof(studio->'name') IS DISTINCT FROM 'string' OR btrim(studio->>'name')='') THEN
      RAISE EXCEPTION 'Invalid animation studio metadata';
    END IF;
  END IF;
  -- Workers cannot claim future episodes have aired.
  IF p='tmdb' AND EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') s CROSS JOIN LATERAL jsonb_array_elements(s->'episodes') e WHERE (e->>'aired')::boolean AND (e->>'air_date')::date>(clock_timestamp() AT TIME ZONE 'UTC')::date) THEN RAISE EXCEPTION 'Future aired evidence'; END IF;
  IF p='tmdb' THEN
    SELECT jsonb_build_object('status',f->'status','seasons',coalesce(jsonb_agg(
      season||jsonb_build_object('episodes',(SELECT coalesce(jsonb_agg(ep ORDER BY (ep->>'number')::integer),'[]') FROM jsonb_array_elements(season->'episodes') ep))
      ORDER BY (season->>'number')::integer),'[]')) INTO f FROM jsonb_array_elements(f->'seasons') season;
    IF command->'projection' IS NOT NULL AND (jsonb_typeof(command->'projection'->'season_posters') IS DISTINCT FROM 'array'
      OR jsonb_typeof(command->'projection'->'season_air_dates') IS DISTINCT FROM 'array'
      OR jsonb_array_length(command->'projection'->'season_posters')<>jsonb_array_length(f->'seasons')
      OR jsonb_array_length(command->'projection'->'season_air_dates')<>jsonb_array_length(f->'seasons')) THEN RAISE EXCEPTION 'Invalid season projection'; END IF;
  ELSE
    SELECT jsonb_build_object('cours',coalesce(jsonb_agg(cour ORDER BY (cour->>'number')::integer),'[]')) INTO f FROM jsonb_array_elements(f->'cours') cour;
  END IF;
  SELECT * INTO accepted FROM watching.provider_snapshots WHERE id=h.accepted_snapshot_id;
  SELECT * INTO latest FROM watching.provider_snapshots WHERE id=h.latest_observed_snapshot_id;
  fp:=encode(sha256(convert_to(f::text,'UTF8')),'hex');
  IF latest.fingerprint=fp THEN
    UPDATE watching.provider_heads SET checked_at=clock_timestamp(),accepted_checked_at=CASE WHEN h.accepted_snapshot_id=latest.id OR latest.classification='RESTORATION' THEN clock_timestamp() ELSE accepted_checked_at END,refresh_outcome=CASE WHEN h.accepted_snapshot_id=latest.id OR latest.classification='RESTORATION' THEN 'UNCHANGED' ELSE 'REJECTED' END,error_code=NULL WHERE provider=p AND work_key=w;
    IF h.accepted_snapshot_id=latest.id OR latest.classification='RESTORATION' THEN
      IF p='tmdb' THEN UPDATE watching.media_items SET last_synced_at=clock_timestamp(),season_posters=coalesce(command->'projection'->'season_posters',season_posters),season_air_dates=coalesce(command->'projection'->'season_air_dates',season_air_dates) WHERE type<>'film' AND tmdb_id=split_part(w,':',2)::bigint;
      ELSE UPDATE watching.anime_cours SET cours=(
        SELECT coalesce(jsonb_agg(CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') p WHERE p->>'anilist_id'=c->>'anilist_id' AND p ? 'studios')
          THEN jsonb_set(c,'{studios}',(SELECT p->'studios' FROM jsonb_array_elements(command->'projection'->'cours') p WHERE p->>'anilist_id'=c->>'anilist_id')) ELSE c END ORDER BY ord),'[]')
        FROM jsonb_array_elements(cours) WITH ORDINALITY existing(c,ord)),resolved_at=clock_timestamp()
      WHERE tmdb_id=split_part(w,':',2)::integer; END IF;
    END IF;
    RETURN jsonb_build_object('classification',CASE WHEN h.accepted_snapshot_id=latest.id OR latest.classification='RESTORATION' THEN 'UNCHANGED' ELSE latest.classification END,'accepted',false,'growth',false,'snapshot_id',latest.id);
  END IF;
  IF p='anilist' AND (EXISTS(SELECT 1 FROM jsonb_array_elements(f->'cours') c WHERE c->>'announced' IS NULL OR c->>'end' IS NULL)
    OR EXISTS(SELECT 1 FROM watching.media_items m WHERE m.tmdb_id=split_part(w,':',2)::bigint AND m.type<>'film' AND m.episodes IS NOT NULL
      AND m.episodes<>(SELECT coalesce(sum((c->>'announced')::integer),0) FROM jsonb_array_elements(f->'cours') c)) AND jsonb_array_length(f->'cours')>0) THEN
    classification:='AMBIGUOUS'; reason:='COUR_MAPPING_INCOMPLETE_OR_MISMATCH';
  ELSIF accepted.id IS NULL AND p='tmdb' AND EXISTS(
    SELECT 1 FROM watching.media_items legacy CROSS JOIN LATERAL generate_series(1,greatest(coalesce(cardinality(legacy.season_aired),0),coalesce(jsonb_array_length(legacy.season_episodes),0))) oldnum
    WHERE legacy.tmdb_id=split_part(w,':',2)::bigint AND legacy.type<>'film' AND EXISTS(
      SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') fresh WHERE (fresh->>'number')::integer=oldnum
        AND (fresh->>'aired' IS NULL OR coalesce(legacy.season_aired[oldnum],0)<=(fresh->>'aired')::integer)
        AND coalesce((legacy.season_episodes->>(oldnum-1))::integer,0)<=(fresh->>'announced')::integer))
  ) THEN classification:='REGRESSION'; reason:='LEGACY_PROJECTION_REGRESSION';
  ELSIF accepted.id IS NULL THEN classification:='BASELINE'; reason:='FIRST_VALID_OBSERVATION'; take:=true;
  ELSIF accepted.fingerprint=fp THEN classification:='RESTORATION'; reason:='ACCEPTED_FACTS_RESTORED';
  ELSIF p='anilist' THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'cours') a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'cours') n WHERE n->>'id'=a->>'id')) THEN
      classification:='REGRESSION'; reason:='COUR_MEMBERSHIP_REMOVED';
    ELSE classification:='CORRECTION'; reason:='COUR_MAPPING_CHANGE_NO_GROWTH'; take:=true; END IF;
  ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') s WHERE s->>'aired' IS NULL OR jsonb_array_length(s->'episodes')<(s->>'aired')::integer) THEN
    classification:='AMBIGUOUS'; reason:='INCOMPLETE_AIRING_OR_MEMBERSHIP';
  ELSE
    SELECT coalesce(array_agg((e->>'id')::bigint),'{}') INTO old_ids FROM jsonb_array_elements(accepted.facts->'seasons') s CROSS JOIN LATERAL jsonb_array_elements(s->'episodes') e WHERE (e->>'aired')::boolean;
    SELECT coalesce(array_agg((e->>'id')::bigint),'{}') INTO new_ids FROM jsonb_array_elements(f->'seasons') s CROSS JOIN LATERAL jsonb_array_elements(s->'episodes') e WHERE (e->>'aired')::boolean;
    removed:=NOT old_ids <@ new_ids;
    SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') n WHERE n->>'id'=a->>'id' AND n->>'number'=a->>'number')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') n WHERE n->>'id'=a->>'id' AND ((n->>'announced')::integer<(a->>'announced')::integer OR ((a->>'aired') IS NOT NULL AND ((n->>'aired') IS NULL OR (n->>'aired')::integer<(a->>'aired')::integer))))) INTO count_down;
    IF removed OR count_down THEN classification:='REGRESSION'; reason:='ACCEPTED_MEMBERSHIP_OR_COUNTS_REMOVED';
    ELSE
      SELECT count(*),count(*) FILTER(WHERE (e->>'air_date')::date>(coalesce(h.accepted_checked_at,accepted.observed_at) AT TIME ZONE 'UTC')::date) INTO new_content,proved
        FROM jsonb_array_elements(f->'seasons') s CROSS JOIN LATERAL jsonb_array_elements(s->'episodes') e WHERE (e->>'aired')::boolean AND NOT((e->>'id')::bigint=ANY(old_ids));
      IF new_content>0 AND proved=new_content AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') s WHERE s->>'aired' IS NULL OR jsonb_array_length(s->'episodes')<(s->>'aired')::integer) THEN
        -- Stable identities must retain season/episode coordinates and past air dates.
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') a CROSS JOIN LATERAL jsonb_array_elements(a->'episodes') old
          WHERE (old->>'aired')::boolean AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') n CROSS JOIN LATERAL jsonb_array_elements(n->'episodes') fresh
            WHERE n->>'id'=a->>'id' AND fresh->>'id'=old->>'id' AND fresh->>'number'=old->>'number' AND fresh->>'air_date'=old->>'air_date')) THEN
          classification:='AMBIGUOUS'; reason:='PRIOR_IDENTITY_CHANGED';
        ELSE classification:='GROWTH'; reason:='NEW_IDENTIFIED_EPISODES_AIRED_AFTER_BASELINE'; take:=true; growth:=true; END IF;
      ELSIF new_content>0 AND proved=0 AND EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') old WHERE old->>'aired' IS NULL)
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') fresh CROSS JOIN LATERAL jsonb_array_elements(fresh->'episodes') ep WHERE (ep->>'aired')::boolean AND NOT EXISTS(
          SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') old CROSS JOIN LATERAL jsonb_array_elements(old->'episodes') previous_ep WHERE old->>'id'=fresh->>'id' AND previous_ep->>'id'=ep->>'id' AND previous_ep->>'number'=ep->>'number'))
        AND NOT EXISTS(SELECT 1 FROM watching.media_items item CROSS JOIN LATERAL jsonb_array_elements(f->'seasons') fresh WHERE item.tmdb_id=split_part(w,':',2)::bigint
          AND coalesce(item.season_aired[(fresh->>'number')::integer],0)>0 AND (fresh->>'aired')::integer>item.season_aired[(fresh->>'number')::integer]) THEN
        classification:='CORRECTION'; reason:='UNKNOWN_AIRING_RESOLVED_NO_GROWTH'; take:=true;
      ELSIF new_content>0 THEN classification:='AMBIGUOUS'; reason:='OLD_DISCOVERY_OR_INSUFFICIENT_EVIDENCE';
      ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(f->'seasons') n WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') a WHERE a->>'id'=n->>'id')
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(accepted.facts->'seasons') a WHERE a->>'id'=n->>'id' AND n->>'aired' IS DISTINCT FROM a->>'aired')) THEN
        classification:='AMBIGUOUS'; reason:='COUNT_ONLY_OR_NEW_UNKNOWN_SCOPE';
      ELSE classification:='CORRECTION'; reason:='SAME_AVAILABLE_MEMBERSHIP'; take:=true; END IF;
    END IF;
  END IF;
  INSERT INTO watching.provider_snapshots(provider,work_key,contract_version,facts,fingerprint,previous_snapshot_id,classification,reason_code)
    VALUES(p,w,1,f,fp,h.latest_observed_snapshot_id,classification,reason) RETURNING id INTO sid;
  UPDATE watching.provider_heads SET latest_observed_snapshot_id=sid,accepted_snapshot_id=CASE WHEN take THEN sid ELSE accepted_snapshot_id END,
    checked_at=clock_timestamp(),accepted_checked_at=CASE WHEN take OR classification='RESTORATION' THEN clock_timestamp() ELSE accepted_checked_at END,refresh_outcome=CASE WHEN take OR classification='RESTORATION' THEN 'ACCEPTED' ELSE 'REJECTED' END,error_code=NULL WHERE provider=p AND work_key=w;
  IF classification='RESTORATION' THEN
    IF p='tmdb' THEN UPDATE watching.media_items SET last_synced_at=clock_timestamp(),season_posters=coalesce(command->'projection'->'season_posters',season_posters),season_air_dates=coalesce(command->'projection'->'season_air_dates',season_air_dates) WHERE type<>'film' AND tmdb_id=split_part(w,':',2)::bigint;
    ELSE UPDATE watching.anime_cours SET cours=(
        SELECT coalesce(jsonb_agg(CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') p WHERE p->>'anilist_id'=c->>'anilist_id' AND p ? 'studios')
          THEN jsonb_set(c,'{studios}',(SELECT p->'studios' FROM jsonb_array_elements(command->'projection'->'cours') p WHERE p->>'anilist_id'=c->>'anilist_id')) ELSE c END ORDER BY ord),'[]')
        FROM jsonb_array_elements(cours) WITH ORDINALITY existing(c,ord)),resolved_at=clock_timestamp()
      WHERE tmdb_id=split_part(w,':',2)::integer; END IF;
  END IF;
  IF take AND p='anilist' THEN
    IF jsonb_typeof(command->'projection'->'cours') IS DISTINCT FROM 'array'
      OR jsonb_array_length(command->'projection'->'cours')<>jsonb_array_length(f->'cours') OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(f->'cours') compact WHERE NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(command->'projection'->'cours') c WHERE compact->>'id'=c->>'anilist_id'
          AND compact->>'number'=c->>'season' AND compact->>'start'=c->>'start_episode'
          AND compact->>'end' IS NOT DISTINCT FROM c->>'end_episode'
          AND compact->>'announced' IS NOT DISTINCT FROM c->>'episodes')) THEN RAISE EXCEPTION 'Invalid cour projection'; END IF;
    INSERT INTO watching.anime_cours(tmdb_id,cours,source,resolved_at)
      VALUES(split_part(w,':',2)::integer,command->'projection'->'cours',CASE WHEN jsonb_array_length(f->'cours')=0 THEN 'none' ELSE 'anilist' END,clock_timestamp())
      ON CONFLICT(tmdb_id) DO UPDATE SET cours=excluded.cours,source=excluded.source,resolved_at=excluded.resolved_at;
  END IF;
  IF take AND p='tmdb' THEN
    SELECT array_agg((s->>'aired')::integer ORDER BY (s->>'number')::integer),array_agg((s->>'announced')::integer ORDER BY (s->>'number')::integer),array_agg(s->>'end_date' ORDER BY (s->>'number')::integer)
      INTO sa,se,ends FROM jsonb_array_elements(f->'seasons') s;
    SELECT coalesce(sum(v),0) INTO aired_total FROM unnest(sa) v;
    FOR m IN SELECT * FROM watching.media_items WHERE type<>'film' AND tmdb_id=split_part(w,':',2)::bigint ORDER BY id FOR UPDATE LOOP
      sn:=coalesce(m.current_season,1);
      SELECT coalesce(sum(v),0) INTO before_seen FROM unnest(sa) WITH ORDINALITY t(v,i) WHERE i<sn;
      seen:=before_seen+least(coalesce(m.current_episode,0),coalesce(sa[sn],0));
      UPDATE watching.media_items SET status=f->>'status',season_aired=CASE WHEN array_position(sa,NULL) IS NOT NULL THEN CASE WHEN EXISTS(SELECT 1 FROM unnest(m.season_aired) v WHERE v>0) THEN m.season_aired ELSE NULL END ELSE coalesce(sa,'{}') END,season_episodes=coalesce(to_jsonb(se),'[]'),season_end_dates=coalesce(to_jsonb(ends),'[]'),seasons=cardinality(se),episodes=(SELECT coalesce(sum(v),0) FROM unnest(se) v),last_synced_at=clock_timestamp(),
        season_posters=coalesce(command->'projection'->'season_posters',m.season_posters),season_air_dates=coalesce(command->'projection'->'season_air_dates',m.season_air_dates),
        -- Availability does not mean the owner resumed. Capture a hold only on proven growth
        -- after a completed title/season/identified anime part; weekly active tracking continues.
        watched=CASE WHEN growth AND m.watched AND seen<aired_total AND NOT m.paused AND NOT m.dropped AND NOT m.want_to_watch AND NOT m.is_reference THEN false ELSE m.watched END,
        resume_required=m.resume_required OR coalesce((growth AND seen<aired_total AND
          NOT m.paused AND NOT m.dropped AND NOT m.want_to_watch AND NOT m.is_reference AND
          (m.watched OR ((m.in_progress OR m.caught_up_at IS NOT NULL) AND
            coalesce(m.current_episode,0)>=coalesce(m.season_aired[sn],0) AND
            coalesce(m.season_aired[sn],0)>0 AND
            NOT EXISTS(SELECT 1 FROM unnest(m.season_aired) WITH ORDINALITY t(v,i) WHERE i>sn AND v>0) AND (
              coalesce(m.season_aired[sn],0)>=coalesce((m.season_episodes->>(sn-1))::integer,0) AND
              coalesce((m.season_episodes->>(sn-1))::integer,0)>0 OR
              m.type='anime' AND EXISTS(SELECT 1 FROM watching.anime_cours ac,
                jsonb_array_elements(ac.cours) c WHERE ac.tmdb_id=m.tmdb_id AND ac.source='anilist'
                AND (c->>'end_episode')::integer=(SELECT coalesce(sum(v),0) FROM unnest(m.season_aired) v))
            )))),false)
        WHERE id=m.id;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('classification',classification,'reason_code',reason,'accepted',take,'growth',growth,'snapshot_id',sid);
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
  -- A correction preserves a suspended title's stance. Resume/Finish are explicit commands.
  -- Reject stale callers before any projection, assertion or correction audit is written.
  IF item.id IS NOT NULL AND item.type IN ('serie','anime') AND
      command->>'history_intent'='correction' AND (patch ? 'current_season' OR patch ? 'current_episode') AND
      (item.paused OR item.dropped) AND (
        (patch ? 'watched' AND patch->'watched' IS DISTINCT FROM 'false'::jsonb) OR
        (patch ? 'in_progress' AND patch->'in_progress' IS DISTINCT FROM 'false'::jsonb) OR
        (patch ? 'paused' AND patch->'paused' IS DISTINCT FROM to_jsonb(item)->'paused') OR
        (patch ? 'dropped' AND patch->'dropped' IS DISTINCT FROM to_jsonb(item)->'dropped') OR
        (patch ? 'drop_reason' AND patch->'drop_reason' IS DISTINCT FROM to_jsonb(item)->'drop_reason') OR
        (patch ? 'last_watched_at' AND patch->'last_watched_at' IS DISTINCT FROM to_jsonb(item)->'last_watched_at') OR
        (patch ? 'watched_at' AND patch->'watched_at' IS DISTINCT FROM to_jsonb(item)->'watched_at')
      ) THEN
    RAISE EXCEPTION 'Correcting position preserves Paused/Dropped; use Resume watching or Finish explicitly' USING ERRCODE='22023';
  END IF;
  IF item.id IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_each(patch) e
    WHERE e.key IN ('status','season_aired','season_episodes','season_end_dates','episodes','seasons')
      AND e.value IS DISTINCT FROM to_jsonb(item)->e.key) THEN
    RAISE EXCEPTION 'Catalogue membership is owned by observe_provider' USING ERRCODE='42501';
  END IF;
  -- Corrections may retract evidence, never manufacture a viewing timestamp or a resumption.
  IF item.id IS NOT NULL AND command->>'history_intent'='correction' AND
      (patch ? 'current_season' OR patch ? 'current_episode') THEN
    IF patch->>'caught_up_at' IS NOT NULL AND
        (patch->>'caught_up_at')::timestamptz IS DISTINCT FROM item.caught_up_at OR
       patch->>'last_watched_at' IS NOT NULL AND
        (item.last_watched_at IS NULL OR (patch->>'last_watched_at')::timestamptz>item.last_watched_at) OR
       patch->>'watched_at' IS NOT NULL AND (patch->>'watched_at')::timestamp IS DISTINCT FROM item.watched_at OR
       patch ? 'viewing_date' AND patch->'viewing_date' IS DISTINCT FROM to_jsonb(item)->'viewing_date' OR
       patch ? 'resume_required' AND patch->'resume_required' IS DISTINCT FROM to_jsonb(item.resume_required) THEN
      RAISE EXCEPTION 'Position correction cannot create viewing dates or resume tracking' USING ERRCODE='22023';
    END IF;
    FOR map_field IN SELECT unnest(ARRAY['season_years','cour_years']) LOOP
      IF patch ? map_field AND EXISTS(SELECT 1 FROM jsonb_each(coalesce(nullif(patch->map_field,'null'),'{}')) e
        WHERE e.value IS DISTINCT FROM to_jsonb(item)->map_field->e.key) THEN
        RAISE EXCEPTION 'Position correction cannot create season/cour dates' USING ERRCODE='22023';
      END IF;
    END LOOP;
  END IF;
  IF patch->>'resume_required'='true' AND NOT coalesce(item.resume_required,false) THEN
    RAISE EXCEPTION 'New-content availability is owned by the provider transaction' USING ERRCODE='22023';
  END IF;
  IF item.resume_required AND NOT item.paused AND NOT item.dropped AND command->>'history_intent'='viewing' AND
    (coalesce((patch->>'current_season')::integer,item.current_season,1)>coalesce(item.current_season,1) OR
     coalesce((patch->>'current_season')::integer,item.current_season,1)=coalesce(item.current_season,1) AND
     coalesce((patch->>'current_episode')::integer,item.current_episode,0)>coalesce(item.current_episode,0)) THEN
    patch:=patch||jsonb_build_object('resume_required',false,'in_progress',true,'watched',false);
  END IF;
  IF item.resume_required AND patch->>'resume_required'='false' AND NOT coalesce((
    command->>'history_intent'='viewing' AND
      (coalesce((patch->>'current_season')::integer,item.current_season)>coalesce(item.current_season,1) OR
       coalesce((patch->>'current_season')::integer,item.current_season)=coalesce(item.current_season,1) AND
       coalesce((patch->>'current_episode')::integer,item.current_episode)>coalesce(item.current_episode,0)) OR
    command->>'history_intent'='claim' AND (patch->>'in_progress'='true' AND patch->>'watched'='false' OR patch->>'want_to_watch'='true' OR patch->>'watched'='true' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(command->'records','[]')) v WHERE v->>'kind'='COMPLETION'))
  ),false) THEN RAISE EXCEPTION 'Resume requires an explicit watching action' USING ERRCODE='22023'; END IF;
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

CREATE OR REPLACE FUNCTION watching.receipt_source(p_org uuid,p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'items',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM (SELECT id,personal_revision,history_version,viewing_date,legacy_consumption,tmdb_id,type,title,original_title,poster_url,backdrop_url,year,runtime,status,resume_required,caught_up_at,season_episodes,season_aired,episodes,user_rating,favorite,watched_at,tags,directors,watched,in_progress,paused,dropped,current_season,current_episode,updated_at,season_years,season_ratings,season_posters,season_end_dates,cour_years,cour_ratings FROM watching.media_items WHERE org_id=p_org AND user_id=p_user AND NOT coalesce(is_reference,false)) m),'[]'),
  'rewatches',coalesce((SELECT jsonb_agg(to_jsonb(rw) ORDER BY rw.id) FROM watching.rewatches rw WHERE rw.org_id=p_org AND rw.user_id=p_user),'[]'),
  'history',jsonb_build_object('records',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('ranges',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM watching.viewing_ranges v WHERE v.viewing_record_id=r.id),'[]')) ORDER BY r.id) FROM watching.viewing_records r WHERE r.org_id=p_org AND r.user_id=p_user),'[]'),
    'ratings',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM watching.scope_ratings s WHERE s.org_id=p_org AND s.user_id=p_user),'[]')),
  'cours',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.tmdb_id) FROM watching.anime_cours c WHERE c.tmdb_id IN (SELECT m.tmdb_id FROM watching.media_items m WHERE m.org_id=p_org AND m.user_id=p_user AND m.type='anime')),'[]'))
$$;
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
  IF current_user IN ('authenticated','anon') AND
    jsonb_build_array(NEW.status,NEW.season_aired,NEW.season_episodes,NEW.season_end_dates,NEW.episodes,NEW.seasons)
    IS DISTINCT FROM jsonb_build_array(OLD.status,OLD.season_aired,OLD.season_episodes,OLD.season_end_dates,OLD.episodes,OLD.seasons) THEN
    RAISE EXCEPTION 'Catalogue membership is owned by observe_provider' USING ERRCODE='42501';
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
create or replace function watching.people_ranking(
  p_kind   text,
  p_limit  integer default 50,
  p_offset integer default 0,
  p_user   uuid    default auth.uid()
)
returns table (id integer, name text, profile_url text, n integer)
language sql
stable
set search_path = ''
as $$
  with credits as (
    select
      m.id                        as item_id,
      (p.value->>'id')::integer   as person_id,
      p.value->>'name'            as person_name,
      p.value->>'profile_url'     as person_profile,
      p.value->>'character'       as part
    from watching.media_items m
    cross join lateral jsonb_array_elements(
      case when p_kind = 'directing' then coalesce(m.directors, '[]'::jsonb) else m.cast_members end
    ) as p(value)
    where m.user_id = p_user
      and (m.watched or m.in_progress or m.resume_required or m.paused or m.dropped)
      and (p_kind <> 'voice'  or m.type = 'anime')
      and (p_kind <> 'actors' or m.type <> 'anime')
      and (p.value->>'id') is not null
  ),
  kept as (
    select * from credits
    where p_kind = 'directing'
       or part is null
       or (part !~* '^(self|himself|herself|themselves)\M' and part !~* '\(uncredited\)')
  )
  select
    person_id                                   as id,
    max(person_name)                            as name,
    max(person_profile)                         as profile_url,
    count(distinct item_id)::integer            as n
  from kept
  group by person_id
  having count(distinct item_id) >= 2
  order by n desc, max(person_name) asc
  limit p_limit offset p_offset
$$;
COMMIT;
