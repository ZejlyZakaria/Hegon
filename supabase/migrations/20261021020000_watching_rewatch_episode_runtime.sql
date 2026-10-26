-- Rewatch episode runtimes belong to accepted provider facts, not transient browser caches.
-- Backward compatible optional runtime; no existing data rewrite or object-count change.
BEGIN;
CREATE OR REPLACE FUNCTION watching.valid_provider_facts(provider text,facts jsonb) RETURNS boolean
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
      IF e - ARRAY['id','number','air_date','aired','runtime'] <> '{}' OR NOT(e ?& ARRAY['id','number','air_date','aired'])
        OR e->>'id' IS NULL OR e->>'number' IS NULL OR (e->>'id')::bigint<=0 OR (e->>'number')::integer<=0 OR (e->>'id')::bigint=ANY(seen)
        OR (e->>'number')::integer=ANY(episode_numbers) OR (e->>'number')::integer>(s->>'announced')::integer OR jsonb_typeof(e->'aired') NOT IN ('boolean','null') OR ((e->>'aired')::boolean AND e->>'air_date' IS NULL) THEN RETURN false; END IF;
      IF e ? 'runtime' AND e->'runtime'<>'null'::jsonb AND (jsonb_typeof(e->'runtime')<>'number' OR (e->>'runtime')::numeric<=0 OR (e->>'runtime')::numeric>1440) THEN RETURN false; END IF;
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
NOTIFY pgrst, 'reload schema';
COMMIT;
