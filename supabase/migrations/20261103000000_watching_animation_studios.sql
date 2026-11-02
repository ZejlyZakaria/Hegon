-- Prospective cache metadata only. No backfill, no personal-data mutation, no new objects.
BEGIN;
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
        watched=CASE WHEN growth AND m.watched AND seen<aired_total AND NOT m.paused AND NOT m.dropped AND NOT m.want_to_watch AND NOT m.is_reference THEN false ELSE m.watched END,
        in_progress=CASE WHEN growth AND (m.watched OR m.caught_up_at IS NOT NULL) AND seen<aired_total AND NOT m.paused AND NOT m.dropped AND NOT m.want_to_watch AND NOT m.is_reference THEN true ELSE m.in_progress END
        WHERE id=m.id;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('classification',classification,'reason_code',reason,'accepted',take,'growth',growth,'snapshot_id',sid);
END $$;
COMMIT;
