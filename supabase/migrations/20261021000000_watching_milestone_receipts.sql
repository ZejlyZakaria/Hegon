-- Wave2D: prospective observations only. No backfill or invocation of receipt writers.
BEGIN;
CREATE TABLE watching.achievement_unlocks (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  rule_version integer NOT NULL CHECK(rule_version=1),
  metric_key text NOT NULL,
  target numeric NOT NULL CHECK(target>0),
  actual_value numeric NOT NULL CHECK(actual_value>=target AND actual_value<'Infinity'::numeric),
  observed_at timestamptz NOT NULL DEFAULT now(),
  observation_kind text NOT NULL DEFAULT 'FIRST_OBSERVED_SATISFIED' CHECK(observation_kind='FIRST_OBSERVED_SATISFIED'),
  evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
  PRIMARY KEY(org_id,user_id,achievement_key)
);
CREATE TABLE public.goal_completion_receipts (
  goal_id uuid PRIMARY KEY, -- Retain the receipt if its goal is deleted. Identity is never reused.
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  target numeric NOT NULL CHECK(target>0),
  actual_value numeric NOT NULL CHECK(actual_value>=target AND actual_value<'Infinity'::numeric),
  completed_at timestamptz NOT NULL DEFAULT now(),
  observation_kind text NOT NULL DEFAULT 'FIRST_OBSERVED_SATISFIED' CHECK(observation_kind='FIRST_OBSERVED_SATISFIED'),
  evidence_version integer NOT NULL CHECK(evidence_version=1),
  source text NOT NULL CHECK(source='WATCHING_HISTORY_V1')
);
CREATE INDEX goal_completion_receipts_owner ON public.goal_completion_receipts(user_id,org_id);
ALTER TABLE watching.achievement_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_completion_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievement_unlocks_read ON watching.achievement_unlocks FOR SELECT TO authenticated
  USING(user_id=auth.uid() AND org_id IN (SELECT public.my_orgs()));
CREATE POLICY goal_completion_receipts_read ON public.goal_completion_receipts FOR SELECT TO authenticated
  USING(user_id=auth.uid() AND org_id IN (SELECT public.my_orgs()));
REVOKE ALL ON watching.achievement_unlocks,public.goal_completion_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON watching.achievement_unlocks,public.goal_completion_receipts TO authenticated,service_role;

-- One statement yields a coherent snapshot; one JSON row avoids nested PostgREST row caps.
CREATE FUNCTION watching.receipt_source(p_org uuid,p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'items',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM watching.media_items m WHERE m.org_id=p_org AND m.user_id=p_user AND NOT coalesce(m.is_reference,false)),'[]'),
  'rewatches',coalesce((SELECT jsonb_agg(to_jsonb(rw) ORDER BY rw.id) FROM watching.rewatches rw WHERE rw.org_id=p_org AND rw.user_id=p_user),'[]'),
  'history',jsonb_build_object('records',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('ranges',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM watching.viewing_ranges v WHERE v.viewing_record_id=r.id),'[]')) ORDER BY r.id) FROM watching.viewing_records r WHERE r.org_id=p_org AND r.user_id=p_user),'[]'),
    'ratings',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM watching.scope_ratings s WHERE s.org_id=p_org AND s.user_id=p_user),'[]')),
  'cours',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.tmdb_id) FROM watching.anime_cours c WHERE c.tmdb_id IN (SELECT m.tmdb_id FROM watching.media_items m WHERE m.org_id=p_org AND m.user_id=p_user AND m.type='anime')),'[]'))
$$;
REVOKE ALL ON FUNCTION watching.receipt_source(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION watching.receipt_snapshot(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_org NOT IN (SELECT public.my_orgs()) THEN RAISE EXCEPTION 'Unauthorized observation' USING ERRCODE='42501'; END IF;
 snapshot:=watching.receipt_source(p_org,auth.uid());
 RETURN snapshot||jsonb_build_object('source_hash',md5(snapshot::text),'measured_at',clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION watching.receipt_snapshot(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION watching.receipt_snapshot(uuid) TO authenticated;

-- Only a trusted server evaluator can submit metrics. No authenticated browser write RPC.
CREATE FUNCTION watching.record_achievement_unlocks(p_org uuid,p_user uuid,p_hash text,p_metrics jsonb) RETURNS void
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
    VALUES(p_org,p_user,m->>'achievement_key',1,m->>'metric_key',expected,(m->>'actual_value')::numeric,jsonb_build_object('source',CASE WHEN m->>'achievement_key'='marathoner' THEN 'WATCHING_STATS_HOURS_V1' ELSE 'WATCHING_HISTORY_V1' END,'source_hash',p_hash,'evidence_version',1)) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION watching.record_achievement_unlocks(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION watching.record_achievement_unlocks(uuid,uuid,text,jsonb) TO service_role;

-- Goals owns completion and consumes a module-independent measured-value contract.
CREATE FUNCTION public.record_goal_completion_receipts(p_org uuid,p_user uuid,p_observations jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o jsonb; g public.goals; value numeric; live numeric; stamp timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE org_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Unauthorized owner' USING ERRCODE='42501'; END IF;
 FOR o IN SELECT entry.value FROM jsonb_array_elements(p_observations) entry ORDER BY entry.value->>'goalId' LOOP
  SELECT * INTO g FROM public.goals WHERE id=(o->>'goalId')::uuid AND user_id=p_user AND org_id=p_org FOR UPDATE;
  IF NOT FOUND OR g.metric_module<>'watching' OR g.progress_mode<>'auto' OR g.status NOT IN ('active','completed') THEN RAISE EXCEPTION 'Invalid goal observation'; END IF;
  IF o->>'metricKey' IS DISTINCT FROM coalesce(g.metric_key,'titles') OR (o->>'target')::numeric IS DISTINCT FROM g.metric_target OR o->>'period' IS DISTINCT FROM coalesce(g.metric_period,'all_time') OR (o->>'year')::integer IS DISTINCT FROM g.metric_year THEN RAISE EXCEPTION 'Stale goal definition' USING ERRCODE='40001'; END IF;
  value:=(o->>'currentValue')::numeric; live:=coalesce((o->>'liveValue')::numeric,value); stamp:=(o->>'measuredAt')::timestamptz;
  IF live<0 OR live>='Infinity'::numeric OR value IS NULL OR value<0 OR value>='Infinity'::numeric OR stamp IS NULL OR stamp<clock_timestamp()-interval '30 seconds' OR stamp>clock_timestamp()+interval '1 second' OR o->>'source' IS DISTINCT FROM 'WATCHING_HISTORY_V1' OR (o->>'evidenceVersion')::integer IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Invalid goal metric'; END IF;
  IF (o->>'shouldComplete')::boolean IS DISTINCT FROM coalesce(g.metric_target>0 AND value>=g.metric_target,false) THEN RAISE EXCEPTION 'Invalid threshold decision'; END IF;
  IF g.metric_target>0 AND value>=g.metric_target THEN
   INSERT INTO public.goal_completion_receipts(goal_id,org_id,user_id,metric_key,target,actual_value,evidence_version,source)
    VALUES(g.id,g.org_id,g.user_id,coalesce(g.metric_key,'titles'),g.metric_target,value,1,'WATCHING_HISTORY_V1') ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.goals SET progress=CASE WHEN g.metric_target>0 THEN least(100,floor(live*100/g.metric_target))::integer ELSE 0 END,
    status=CASE WHEN EXISTS(SELECT 1 FROM public.goal_completion_receipts WHERE goal_id=g.id) THEN 'completed' ELSE g.status END,
    completed_at=CASE WHEN EXISTS(SELECT 1 FROM public.goal_completion_receipts WHERE goal_id=g.id) THEN coalesce(g.completed_at,(SELECT completed_at FROM public.goal_completion_receipts WHERE goal_id=g.id)) ELSE g.completed_at END WHERE id=g.id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.record_goal_completion_receipts(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_goal_completion_receipts(uuid,uuid,jsonb) TO service_role;
CREATE FUNCTION public.preserve_goal_completion_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt public.goal_completion_receipts;
BEGIN
 SELECT * INTO receipt FROM public.goal_completion_receipts WHERE goal_id=OLD.id;
 IF FOUND THEN NEW.status:='completed'; NEW.completed_at:=coalesce(OLD.completed_at,receipt.completed_at); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_goal_completion_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER preserve_goal_completion_receipt BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.preserve_goal_completion_receipt();
NOTIFY pgrst,'reload schema';
COMMIT;
