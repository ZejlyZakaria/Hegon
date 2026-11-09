-- Bind an existing global opinion to proven episode identities before catalogue growth.
-- No backfill, consumption event, watch date, or compatibility projection is created at deployment.
BEGIN;
ALTER TABLE watching.scope_ratings DROP CONSTRAINT scope_ratings_scope_kind_check;
ALTER TABLE watching.scope_ratings ADD CONSTRAINT scope_ratings_scope_kind_check CHECK(scope_kind IN ('SEASON','COUR','WHOLE_TITLE'));

CREATE FUNCTION watching.global_rating_basis(m jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE ctx jsonb; t jsonb; a jsonb; s jsonb; entries jsonb:='[]'; ids jsonb; sid uuid; aid uuid; n integer; c jsonb; cour_ids jsonb:='[]'; next_episode integer:=1;
BEGIN
  IF m->>'type' NOT IN ('serie','anime') OR coalesce((m->>'is_reference')::boolean,false) OR m->>'user_rating' IS NULL THEN RETURN NULL; END IF;
  ctx:=watching.whole_rating_scope(m);
  IF ctx IS NOT NULL THEN RETURN ctx||jsonb_build_object('score',(m->>'user_rating')::numeric); END IF;
  SELECT p.facts,p.id INTO t,sid FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.work_key='tv:'||(m->>'tmdb_id') AND h.provider='tmdb';
  IF coalesce(jsonb_array_length(t->'seasons'),0)=0 THEN RETURN NULL; END IF;
  IF m->>'type'='anime' THEN
    SELECT p.facts,p.id INTO a,aid FROM watching.provider_heads h JOIN watching.provider_snapshots p ON p.id=h.accepted_snapshot_id WHERE h.work_key='tv:'||(m->>'tmdb_id') AND h.provider='anilist';
    IF a IS NULL OR coalesce(jsonb_array_length(a->'cours'),0)=0 THEN RETURN NULL; END IF;
  END IF;
  -- A failed single-scope proof must not be laundered into a whole-title proof.
  IF jsonb_array_length(t->'seasons')=1 AND (m->>'type'<>'anime' OR jsonb_array_length(a->'cours')<=1) THEN RETURN NULL; END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(t->'seasons') ORDER BY (value->>'number')::integer LOOP
    n:=(s->>'number')::integer;
    IF n<=0 OR coalesce((s->>'aired')::integer,0)<=0 OR s->>'aired' IS DISTINCT FROM s->>'announced'
      OR n>coalesce((m->>'current_season')::integer,0) OR n=(m->>'current_season')::integer AND (s->>'aired')::integer>coalesce((m->>'current_episode')::integer,0) THEN RETURN NULL; END IF;
    ctx:=watching.provider_scope('tv:'||(m->>'tmdb_id'),'SEASON',n);
    IF jsonb_array_length(NULLIF(ctx->'ids','null')) IS DISTINCT FROM (s->>'aired')::integer THEN RETURN NULL; END IF;
    entries:=entries||(ctx->'episodes');
  END LOOP;
  SELECT jsonb_agg(e->'episode'->'id' ORDER BY (e->>'season_number')::integer,(e->'episode'->>'number')::integer) INTO ids FROM jsonb_array_elements(entries) e;
  IF jsonb_array_length(ids)<>(SELECT count(DISTINCT e->'episode'->>'id') FROM jsonb_array_elements(entries) e) THEN RETURN NULL; END IF;
  IF m->>'type'='anime' THEN
    FOR c IN SELECT value FROM jsonb_array_elements(a->'cours') ORDER BY (value->>'number')::integer LOOP
      IF (c->>'start')::integer IS DISTINCT FROM next_episode OR coalesce((c->>'announced')::integer,0)<=0
        OR (c->>'end')::integer IS DISTINCT FROM next_episode+(c->>'announced')::integer-1 THEN RETURN NULL; END IF;
      ctx:=watching.provider_scope('tv:'||(m->>'tmdb_id'),'COUR',(c->>'number')::integer);
      IF jsonb_array_length(NULLIF(ctx->'ids','null')) IS DISTINCT FROM (c->>'announced')::integer THEN RETURN NULL; END IF;
      cour_ids:=cour_ids||(ctx->'ids');next_episode:=(c->>'end')::integer+1;
    END LOOP;
    IF cour_ids IS DISTINCT FROM ids THEN RETURN NULL; END IF;
  END IF;
  RETURN jsonb_build_object('kind','WHOLE_TITLE','key','whole:'||md5(ids::text),'number',1,'score',(m->>'user_rating')::numeric,
    'ids',ids,'episodes',entries,'snapshot_id',sid,'mapping_snapshot_id',aid);
END $$;
REVOKE ALL ON FUNCTION watching.global_rating_basis(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION watching.capture_global_opinion(m jsonb, explicit_edit boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ctx jsonb; prior watching.scope_ratings; rid uuid; op uuid:=gen_random_uuid(); ids bigint[]; fingerprint text;
BEGIN
  ctx:=watching.global_rating_basis(m);
  IF ctx IS NULL THEN
    -- Clearing a whole-title opinion retains a tombstone, not an inferred new scope.
    IF explicit_edit AND m->>'user_rating' IS NULL THEN
      FOR prior IN SELECT r.* FROM watching.scope_ratings r WHERE r.media_item_id=(m->>'id')::uuid AND r.scope_kind='WHOLE_TITLE' AND r.score IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM watching.scope_ratings successor WHERE successor.previous_rating_id=r.id) LOOP
        INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,previous_rating_id,action,operation_key,operation_hash)
          VALUES(prior.org_id,prior.user_id,prior.media_item_id,prior.work_key,prior.scope_kind,prior.scope_key,1,prior.id,'CORRECTION',gen_random_uuid(),'global-binding-clear-v1');
      END LOOP;
    END IF;
    RETURN;
  END IF;
  SELECT * INTO prior FROM watching.scope_ratings r WHERE r.media_item_id=(m->>'id')::uuid AND r.scope_kind=ctx->>'kind' AND r.scope_key=ctx->>'key' ORDER BY r.recorded_at DESC,r.id DESC LIMIT 1;
  IF prior.id IS NOT NULL AND (NOT explicit_edit OR prior.score IS NOT DISTINCT FROM (m->>'user_rating')::numeric) THEN RETURN; END IF;
  -- Legacy scope edits/clears already own this subject; a catalogue refresh cannot revive it.
  IF NOT explicit_edit AND EXISTS(SELECT 1 FROM watching.scope_ratings r WHERE r.media_item_id=(m->>'id')::uuid) THEN RETURN; END IF;
  SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(ctx->'ids');
  fingerprint:='global-binding-v1:'||md5(ctx::text);
  INSERT INTO watching.viewing_records(org_id,user_id,media_item_id,work_key,title_snapshot,media_type_snapshot,kind,scope_kind,scope_key,completion_basis,date_precision,date_confidence,scope_confidence,operation_key,operation_index,operation_hash,origin)
    VALUES((m->>'org_id')::uuid,(m->>'user_id')::uuid,(m->>'id')::uuid,'tv:'||(m->>'tmdb_id'),m->>'title',m->>'type','COMPLETION',ctx->>'kind',ctx->>'key','AVAILABLE_SCOPE','UNKNOWN','UNKNOWN','CONFIRMED',op,0,fingerprint,'LEGACY_IMPORT') RETURNING id INTO rid;
  INSERT INTO watching.viewing_ranges(viewing_record_id,season_key,season_number_at_recording,episode_from,episode_to,episode_ids,minutes,duration_basis)
    SELECT rid,'tmdb-season:'||(e->>'season_number'),(e->>'season_number')::integer,min((e->'episode'->>'number')::integer),max((e->'episode'->>'number')::integer),array_agg((e->'episode'->>'id')::bigint ORDER BY (e->'episode'->>'number')::integer),0,'MILESTONE'
    FROM jsonb_array_elements(ctx->'episodes') e GROUP BY e->>'season_number';
  INSERT INTO watching.scope_ratings(org_id,user_id,media_item_id,work_key,scope_kind,scope_key,scope_number_at_recording,viewing_record_id,provider_snapshot_id,mapping_snapshot_id,episode_ids,score,previous_rating_id,action,operation_key,operation_hash)
    VALUES((m->>'org_id')::uuid,(m->>'user_id')::uuid,(m->>'id')::uuid,'tv:'||(m->>'tmdb_id'),ctx->>'kind',ctx->>'key',(ctx->>'number')::integer,rid,(ctx->>'snapshot_id')::uuid,(ctx->>'mapping_snapshot_id')::uuid,ids,(m->>'user_rating')::numeric,prior.id,CASE WHEN prior.id IS NULL THEN 'INITIAL' ELSE 'REVISE' END,op,fingerprint);
END $$;
REVOKE ALL ON FUNCTION watching.capture_global_opinion(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION watching.bind_global_before_catalogue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m watching.media_items;
BEGIN
  FOR m IN SELECT * FROM watching.media_items WHERE type IN ('serie','anime') AND NOT is_reference AND 'tv:'||tmdb_id=OLD.work_key AND user_rating IS NOT NULL ORDER BY id FOR UPDATE LOOP
    PERFORM watching.capture_global_opinion(to_jsonb(m));
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION watching.bind_global_before_catalogue() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER bind_global_before_catalogue BEFORE UPDATE OF accepted_snapshot_id ON watching.provider_heads FOR EACH ROW
  WHEN(OLD.accepted_snapshot_id IS NOT NULL AND OLD.accepted_snapshot_id IS DISTINCT FROM NEW.accepted_snapshot_id) EXECUTE FUNCTION watching.bind_global_before_catalogue();

CREATE FUNCTION watching.bind_global_after_edit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM watching.capture_global_opinion(to_jsonb(OLD));
  PERFORM watching.capture_global_opinion(to_jsonb(NEW),true);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION watching.bind_global_after_edit() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER bind_global_after_edit AFTER UPDATE OF user_rating ON watching.media_items FOR EACH ROW
  WHEN(OLD.user_rating IS DISTINCT FROM NEW.user_rating) EXECUTE FUNCTION watching.bind_global_after_edit();

CREATE FUNCTION watching.global_rating_bases(p_org uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$
  SELECT coalesce(jsonb_object_agg(id::text,basis),'{}') FROM (
    SELECT m.id,watching.global_rating_basis(to_jsonb(m)) basis FROM watching.media_items m
    WHERE m.user_id=auth.uid() AND m.org_id=p_org AND m.org_id IN(SELECT public.my_orgs()) AND m.type IN ('serie','anime') AND NOT m.is_reference AND m.user_rating IS NOT NULL
  ) candidates WHERE basis IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION watching.global_rating_bases(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION watching.global_rating_bases(uuid) TO authenticated;
COMMIT;
