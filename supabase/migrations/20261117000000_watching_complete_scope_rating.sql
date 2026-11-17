-- Prospective eligibility only. No backfill, retraction, calendar or personal-data updates.
BEGIN;
CREATE FUNCTION watching.rating_scope_complete(w text,kind text,num integer) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE facts jsonb; scope jsonb; ctx jsonb; total integer;
BEGIN
  SELECT p.facts INTO facts FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id
    WHERE h.work_key=w AND h.provider=CASE WHEN kind='COUR' THEN 'anilist' ELSE 'tmdb' END;
  IF kind NOT IN ('SEASON','COUR') THEN RETURN false; END IF;
  SELECT value INTO scope FROM jsonb_array_elements(facts->CASE WHEN kind='COUR' THEN 'cours' ELSE 'seasons' END)
    WHERE (value->>'number')::integer=num;
  total:=(scope->>'announced')::integer;
  IF total IS NULL OR total<=0 THEN RETURN false; END IF;
  IF kind='SEASON' AND (scope->>'aired')::integer IS DISTINCT FROM total THEN RETURN false; END IF;
  IF kind='COUR' AND (scope->>'end')::integer-(scope->>'start')::integer+1 IS DISTINCT FROM total THEN RETURN false; END IF;
  ctx:=watching.provider_scope(w,kind,num);
  RETURN coalesce(jsonb_array_length(NULLIF(ctx->'ids','null'))=total,false);
END $$;
REVOKE ALL ON FUNCTION watching.rating_scope_complete(text,text,integer) FROM PUBLIC,anon,authenticated,service_role;

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
  IF score IS NOT NULL AND NOT watching.rating_scope_complete(w,kind,num) THEN
    RAISE EXCEPTION 'The entire season or part must be released before rating';
  END IF;
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
COMMIT;
