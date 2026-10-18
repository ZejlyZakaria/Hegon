-- Wave 2B: compact catalogue evidence and append-only scoped opinions. No legacy backfill.
CREATE TABLE watching.provider_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('tmdb','anilist')),
  work_key text NOT NULL CHECK (work_key ~ '^tv:[1-9][0-9]*$'),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  contract_version integer NOT NULL CHECK (contract_version = 1),
  facts jsonb NOT NULL,
  fingerprint text NOT NULL CHECK(fingerprint=encode(sha256(convert_to(facts::text,'UTF8')),'hex')),
  previous_snapshot_id uuid,
  classification text NOT NULL CHECK (classification IN ('BASELINE','GROWTH','REGRESSION','RESTORATION','CORRECTION','AMBIGUOUS')),
  reason_code text NOT NULL,
  UNIQUE(provider,work_key,id),
  FOREIGN KEY(provider,work_key,previous_snapshot_id) REFERENCES watching.provider_snapshots(provider,work_key,id)
);
CREATE INDEX provider_snapshots_work ON watching.provider_snapshots(provider,work_key,observed_at);
CREATE TABLE watching.provider_heads (
  provider text NOT NULL CHECK (provider IN ('tmdb','anilist')),
  work_key text NOT NULL CHECK (work_key ~ '^tv:[1-9][0-9]*$'),
  accepted_snapshot_id uuid,
  latest_observed_snapshot_id uuid,
  checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  accepted_checked_at timestamptz,
  refresh_outcome text NOT NULL CHECK (refresh_outcome IN ('ACCEPTED','REJECTED','UNCHANGED','FAILED')),
  error_code text CHECK(error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,80}$'),
  PRIMARY KEY(provider,work_key),
  CHECK((accepted_snapshot_id IS NULL)=(accepted_checked_at IS NULL)),
  FOREIGN KEY(provider,work_key,accepted_snapshot_id) REFERENCES watching.provider_snapshots(provider,work_key,id),
  FOREIGN KEY(provider,work_key,latest_observed_snapshot_id) REFERENCES watching.provider_snapshots(provider,work_key,id)
);
CREATE TABLE watching.scope_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_item_id uuid REFERENCES watching.media_items(id) ON DELETE SET NULL,
  work_key text NOT NULL,
  scope_kind text NOT NULL CHECK(scope_kind IN ('SEASON','COUR')),
  scope_key text NOT NULL,
  scope_number_at_recording integer NOT NULL CHECK(scope_number_at_recording > 0),
  viewing_record_id uuid REFERENCES watching.viewing_records(id),
  provider_snapshot_id uuid REFERENCES watching.provider_snapshots(id),
  mapping_snapshot_id uuid REFERENCES watching.provider_snapshots(id),
  episode_ids bigint[],
  score numeric CHECK(score > 0 AND score <= 10),
  previous_rating_id uuid REFERENCES watching.scope_ratings(id),
  action text NOT NULL CHECK(action IN ('INITIAL','CONFIRM','REVISE','CORRECTION')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  operation_key uuid NOT NULL,
  operation_hash text NOT NULL,
  CHECK(score IS NOT NULL OR action='CORRECTION'),
  CHECK(episode_ids IS NULL OR (cardinality(episode_ids)>0 AND array_position(episode_ids,NULL) IS NULL AND 0 < ALL(episode_ids))),
  UNIQUE(user_id,operation_key)
);
CREATE UNIQUE INDEX scope_ratings_successor ON watching.scope_ratings(previous_rating_id) WHERE previous_rating_id IS NOT NULL;
CREATE INDEX scope_ratings_owner ON watching.scope_ratings(user_id,org_id,work_key,scope_key,recorded_at);
ALTER TABLE watching.provider_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE watching.provider_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE watching.scope_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_snapshots_read ON watching.provider_snapshots FOR SELECT TO authenticated USING(true);
CREATE POLICY provider_heads_read ON watching.provider_heads FOR SELECT TO authenticated USING(true);
CREATE POLICY scope_ratings_read ON watching.scope_ratings FOR SELECT TO authenticated USING(user_id=auth.uid() AND org_id IN (SELECT public.my_orgs()));
REVOKE ALL ON watching.provider_snapshots,watching.provider_heads,watching.scope_ratings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON watching.provider_snapshots,watching.provider_heads,watching.scope_ratings TO authenticated,service_role;

-- Reject unknown fields/full payloads and malformed/contradictory compact observations.
CREATE FUNCTION watching.valid_provider_facts(provider text,facts jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
#variable_conflict use_column
DECLARE s jsonb; e jsonb; seen bigint[] := '{}'; seasons bigint[] := '{}'; numbers integer[] := '{}'; episode_numbers integer[]; count_aired integer; cour_cursor integer:=1;
BEGIN
  IF jsonb_typeof(facts) IS DISTINCT FROM 'object' OR pg_column_size(facts)>2000000 THEN RETURN false; END IF;
  IF provider='anilist' THEN
    IF facts - 'cours' <> '{}' OR jsonb_typeof(facts->'cours') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(facts->'cours') ORDER BY (value->>'number')::integer LOOP
      IF s - ARRAY['id','number','announced','start','end'] <> '{}' OR s->>'id' IS NULL OR s->>'number' IS NULL OR (s->>'id')::bigint<=0 OR (s->>'number')::integer<=0
        OR (s->>'id')::bigint=ANY(seen) OR (s->>'number')::integer=ANY(numbers)
        OR s->>'start' IS NULL OR (s->>'start')::integer<=0 OR ((s->>'end') IS NOT NULL AND (s->>'end')::integer<(s->>'start')::integer)
        OR ((s->>'announced') IS NOT NULL AND ((s->>'announced')::integer<=0 OR (s->>'end')::integer-(s->>'start')::integer+1<>(s->>'announced')::integer))
        OR NOT(s ?& ARRAY['id','number','announced','start','end']) THEN RETURN false; END IF;
      IF cour_cursor IS NOT NULL AND (s->>'start')::integer<>cour_cursor THEN RETURN false; END IF;
      cour_cursor:=(s->>'end')::integer+1;
      seen:=array_append(seen,(s->>'id')::bigint); numbers:=array_append(numbers,(s->>'number')::integer);
    END LOOP;
    IF coalesce((SELECT max(n) FROM unnest(numbers) n),0)<>cardinality(numbers) THEN RETURN false; END IF;
    RETURN true;
  END IF;
  IF provider<>'tmdb' OR facts - ARRAY['status','seasons'] <> '{}' OR jsonb_typeof(facts->'seasons') IS DISTINCT FROM 'array'
    OR facts->>'status' IS NULL OR facts->>'status' NOT IN ('ongoing','ended','canceled') THEN RETURN false; END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(facts->'seasons') LOOP
    IF s - ARRAY['id','number','announced','aired','end_date','episodes'] <> '{}' OR NOT(s ?& ARRAY['id','number','announced','aired','end_date','episodes'])
      OR s->>'id' IS NULL OR s->>'number' IS NULL OR (s->>'id')::bigint<=0 OR (s->>'number')::integer<=0 OR (s->>'id')::bigint=ANY(seasons)
      OR (s->>'number')::integer=ANY(numbers) OR s->>'announced' IS NULL OR (s->>'announced')::integer<0 OR jsonb_typeof(s->'episodes')<>'array'
      OR ((s->>'aired') IS NOT NULL AND ((s->>'aired')::integer<0 OR (s->>'aired')::integer>(s->>'announced')::integer)) THEN RETURN false; END IF;
    seasons:=array_append(seasons,(s->>'id')::bigint); numbers:=array_append(numbers,(s->>'number')::integer);
    count_aired:=0; episode_numbers:='{}';
    FOR e IN SELECT value FROM jsonb_array_elements(s->'episodes') LOOP
      IF e - ARRAY['id','number','air_date','aired'] <> '{}' OR NOT(e ?& ARRAY['id','number','air_date','aired'])
        OR e->>'id' IS NULL OR e->>'number' IS NULL OR (e->>'id')::bigint<=0 OR (e->>'number')::integer<=0 OR (e->>'id')::bigint=ANY(seen)
        OR (e->>'number')::integer=ANY(episode_numbers) OR (e->>'number')::integer>(s->>'announced')::integer OR jsonb_typeof(e->'aired') NOT IN ('boolean','null') OR ((e->>'aired')::boolean AND e->>'air_date' IS NULL) THEN RETURN false; END IF;
      IF e->>'air_date' IS NOT NULL AND (e->>'air_date')::date::text<>e->>'air_date' THEN RETURN false; END IF;
      seen:=array_append(seen,(e->>'id')::bigint); episode_numbers:=array_append(episode_numbers,(e->>'number')::integer);
      IF (e->>'aired')::boolean THEN count_aired:=count_aired+1; END IF;
    END LOOP;
    IF (s->>'aired') IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->'episodes') episode WHERE episode->>'aired' IS NULL) THEN RETURN false; END IF;
    IF (s->>'aired') IS NOT NULL AND jsonb_array_length(s->'episodes')>0 AND count_aired<>(s->>'aired')::integer THEN RETURN false; END IF;
    IF s->>'aired' IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->'episodes') episode WHERE (episode->>'aired')::boolean AND (episode->>'number')::integer>count_aired) THEN RETURN false; END IF;
    IF s->>'end_date' IS NOT NULL AND (s->>'end_date')::date::text<>s->>'end_date' THEN RETURN false; END IF;
  END LOOP;
  IF coalesce((SELECT max(n) FROM unnest(numbers) n),0)<>cardinality(numbers) THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

ALTER TABLE watching.provider_snapshots ADD CONSTRAINT provider_facts_valid CHECK(watching.valid_provider_facts(provider,facts));

-- Sole provider decision/write boundary. Serializes observation, acceptance and projections.
CREATE FUNCTION watching.observe_provider(command jsonb) RETURNS jsonb
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
      ELSE UPDATE watching.anime_cours SET resolved_at=clock_timestamp() WHERE tmdb_id=split_part(w,':',2)::integer; END IF;
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
    ELSE UPDATE watching.anime_cours SET resolved_at=clock_timestamp() WHERE tmdb_id=split_part(w,':',2)::integer; END IF;
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
REVOKE ALL ON FUNCTION watching.observe_provider(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION watching.observe_provider(jsonb) TO service_role;

-- Resolve today's scope by stable provider identity; ordinals are only current UI coordinates.
CREATE FUNCTION watching.provider_scope(w text,kind text,num integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
#variable_conflict use_column
DECLARE t watching.provider_snapshots; a watching.provider_snapshots; s jsonb; c jsonb; ids bigint[]; eps jsonb; available integer;
BEGIN
  SELECT p.* INTO t FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.provider='tmdb' AND h.work_key=w;
  IF kind='SEASON' THEN
    SELECT value INTO s FROM jsonb_array_elements(t.facts->'seasons') WHERE (value->>'number')::integer=num;
    SELECT array_agg((e->>'id')::bigint ORDER BY (e->>'number')::integer),jsonb_agg(jsonb_build_object('season_id',s->>'id','season_number',num,'episode',e) ORDER BY (e->>'number')::integer)
      INTO ids,eps FROM jsonb_array_elements(s->'episodes') e WHERE (e->>'aired')::boolean;
    IF s->>'aired' IS NULL OR cardinality(ids) IS DISTINCT FROM (s->>'aired')::integer THEN ids:=NULL; END IF;
    RETURN jsonb_build_object('key',CASE WHEN s IS NULL THEN 'unverified-season:'||num ELSE 'tmdb-season:'||(s->>'id') END,'ids',to_jsonb(ids),'episodes',eps,'snapshot_id',t.id,'mapping_snapshot_id',NULL,'start',1,'end',NULL,'available',(s->>'aired')::integer);
  END IF;
  SELECT p.* INTO a FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.provider='anilist' AND h.work_key=w;
  SELECT value INTO c FROM jsonb_array_elements(a.facts->'cours') WHERE (value->>'number')::integer=num;
  WITH seasons AS (
    SELECT value s,coalesce(sum((value->>'announced')::integer) OVER(ORDER BY (value->>'number')::integer ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) offset_n FROM jsonb_array_elements(t.facts->'seasons')
  ), scoped AS (
    SELECT s,e FROM seasons CROSS JOIN LATERAL jsonb_array_elements(s->'episodes') e
    WHERE offset_n+(e->>'number')::integer BETWEEN (c->>'start')::integer AND (c->>'end')::integer AND (e->>'aired')::boolean
  ) SELECT array_agg((e->>'id')::bigint ORDER BY (s->>'number')::integer,(e->>'number')::integer),
    jsonb_agg(jsonb_build_object('season_id',s->>'id','season_number',(s->>'number')::integer,'episode',e) ORDER BY (s->>'number')::integer,(e->>'number')::integer) INTO ids,eps FROM scoped;
  IF t.id IS NULL OR c->>'end' IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.facts->'seasons') s WHERE s->>'aired' IS NULL OR jsonb_array_length(s->'episodes')<(s->>'aired')::integer) THEN ids:=NULL; available:=NULL; ELSE available:=coalesce(cardinality(ids),0); END IF;
  RETURN jsonb_build_object('key',CASE WHEN c IS NULL THEN 'unverified-cour:'||num ELSE 'anilist-cour:'||(c->>'id') END,'ids',to_jsonb(ids),'episodes',eps,'snapshot_id',t.id,'mapping_snapshot_id',a.id,'start',(c->>'start')::integer,'end',(c->>'end')::integer,'available',available);
END $$;

CREATE FUNCTION watching.scope_rating_command(command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_column
DECLARE actor uuid:=auth.uid(); mid uuid:=(command->>'media_id')::uuid; op uuid:=(command->>'operation_key')::uuid;
  fingerprint text:=encode(sha256(convert_to(command::text,'UTF8')),'hex'); m watching.media_items; previous watching.scope_ratings; receipt watching.scope_ratings; legacy_receipt watching.scope_ratings;
  w text; kind text:=command->>'scope_kind'; num integer:=(command->>'scope_number')::integer; ctx jsonb;
  ids bigint[]; score numeric:=(command->>'score')::numeric; act text:=command->>'action'; rid uuid; rating_id uuid; key text;
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
  -- On an explicit legacy edit only, retain the old opinion with NULL coverage. Never backfill.
  IF (CASE WHEN kind='COUR' THEN m.cour_ratings ELSE m.season_ratings END)->>num::text IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM watching.scope_ratings previous_slot WHERE previous_slot.user_id=actor AND previous_slot.org_id=m.org_id
      AND previous_slot.work_key=w AND previous_slot.scope_kind=kind AND previous_slot.scope_number_at_recording=num
      AND previous_slot.score=((CASE WHEN kind='COUR' THEN m.cour_ratings ELSE m.season_ratings END)->>num::text)::numeric) THEN
    INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,score,action,operation_key,operation_hash)
      VALUES(m.org_id,actor,mid,w,kind,'legacy-'||lower(kind)||':'||num,num,
        ((CASE WHEN kind='COUR' THEN m.cour_ratings ELSE m.season_ratings END)->>num::text)::numeric,'INITIAL',gen_random_uuid(),'legacy-opinion:'||fingerprint) RETURNING * INTO legacy_receipt;
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
  -- Compatibility map only; global user_rating is never touched.
  IF kind='COUR' THEN
    UPDATE watching.media_items SET cour_ratings=CASE WHEN score IS NULL THEN coalesce(cour_ratings,'{}')-num::text ELSE coalesce(cour_ratings,'{}')||jsonb_build_object(num::text,score) END,
      personal_operation_key=op,personal_operation_hash=fingerprint,history_version=CASE WHEN rid IS NULL THEN history_version ELSE 1 END WHERE id=mid RETURNING * INTO m;
  ELSE
    UPDATE watching.media_items SET season_ratings=CASE WHEN score IS NULL THEN coalesce(season_ratings,'{}')-num::text ELSE coalesce(season_ratings,'{}')||jsonb_build_object(num::text,score) END,
      personal_operation_key=op,personal_operation_hash=fingerprint,history_version=CASE WHEN rid IS NULL THEN history_version ELSE 1 END WHERE id=mid RETURNING * INTO m;
  END IF;
  RETURN jsonb_build_object('rating_id',rating_id,'media',to_jsonb(m));
END $$;
REVOKE ALL ON FUNCTION watching.scope_rating_command(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION watching.scope_rating_command(jsonb) TO authenticated;

CREATE FUNCTION watching.scope_rating_context(mid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
#variable_conflict use_column
DECLARE m watching.media_items; s jsonb; ctx jsonb; r watching.scope_ratings; ids bigint[]; output jsonb:='[]'; kind text; num integer; legacy numeric; validity text;
BEGIN
  SELECT * INTO m FROM watching.media_items WHERE id=mid AND user_id=auth.uid() AND org_id IN(SELECT public.my_orgs());
  IF m.id IS NULL THEN RAISE EXCEPTION 'Unauthorized media' USING ERRCODE='42501'; END IF;
  FOR kind IN SELECT unnest(ARRAY['SEASON','COUR']) LOOP
    IF kind='COUR' AND m.type<>'anime' THEN CONTINUE; END IF;
    FOR num IN SELECT generate_series(1,greatest(coalesce(jsonb_array_length(m.season_episodes),0),coalesce((SELECT max((key)::integer) FROM jsonb_object_keys(CASE WHEN kind='COUR' THEN coalesce(m.cour_ratings,'{}') ELSE coalesce(m.season_ratings,'{}') END) key),0),
      CASE WHEN kind='COUR' THEN coalesce((SELECT jsonb_array_length(p.facts->'cours') FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.work_key='tv:'||m.tmdb_id AND h.provider='anilist'),0) ELSE 0 END)) LOOP
      ctx:=watching.provider_scope('tv:'||m.tmdb_id,kind,num);
      SELECT * INTO r FROM watching.scope_ratings WHERE user_id=m.user_id AND org_id=m.org_id AND work_key='tv:'||m.tmdb_id AND scope_kind=kind AND scope_key=ctx->>'key' ORDER BY recorded_at DESC,id DESC LIMIT 1;
      legacy:=(CASE WHEN kind='COUR' THEN m.cour_ratings ELSE m.season_ratings END->>num::text)::numeric;
      IF r.id IS NULL AND EXISTS(SELECT 1 FROM watching.scope_ratings previous_slot WHERE previous_slot.user_id=m.user_id AND previous_slot.org_id=m.org_id
        AND previous_slot.work_key='tv:'||m.tmdb_id AND previous_slot.scope_kind=kind AND previous_slot.scope_number_at_recording=num
        AND previous_slot.scope_key<>ctx->>'key' AND previous_slot.scope_key ~ '^(anilist-cour|tmdb-season):') THEN legacy:=NULL; END IF;
      SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(NULLIF(ctx->'ids','null'));
      validity:=CASE WHEN r.id IS NULL THEN CASE WHEN legacy IS NULL THEN 'UNRATED' ELSE 'SCOPE_UNVERIFIED' END
        WHEN r.score IS NULL THEN 'UNRATED' WHEN EXISTS(SELECT 1 FROM watching.viewing_records v WHERE v.id=r.viewing_record_id AND v.retracted_at IS NOT NULL) THEN 'SCOPE_UNVERIFIED' WHEN r.episode_ids IS NULL OR ids IS NULL OR NOT r.episode_ids <@ ids THEN 'SCOPE_UNVERIFIED'
        WHEN ids <@ r.episode_ids THEN 'CURRENT' ELSE 'NEEDS_RECONFIRMATION' END;
      output:=output||jsonb_build_array(jsonb_build_object('kind',kind,'number',num,'scope_key',ctx->>'key','rating_id',r.id,'score',CASE WHEN r.id IS NULL THEN legacy ELSE r.score END,'validity',validity,'covered_episodes',cardinality(r.episode_ids),'provider_snapshot_id',ctx->>'snapshot_id','mapping_snapshot_id',ctx->>'mapping_snapshot_id','available_episodes',(ctx->>'available')::integer,'range_start',ctx->'start','range_end',ctx->'end'));
    END LOOP;
  END LOOP;
  RETURN output;
END $$;
REVOKE ALL ON FUNCTION watching.scope_rating_context(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION watching.scope_rating_context(uuid) TO authenticated;
REVOKE ALL ON FUNCTION watching.provider_scope(text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION watching.valid_provider_facts(text,jsonb) FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE watching.scope_ratings IS 'Append-only scoped opinions; NULL membership means unverified. No legacy backfill; global rating remains separate.';

NOTIFY pgrst, 'reload schema';
