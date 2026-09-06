-- Momentum — daily snapshots of each goal's progress, powering the sparkline on
-- the detail page ("you went 20% → 60% this month"). A trigger captures EVERY
-- progress change server-side (manual slider, auto task recalc, cross-module
-- watching/books recalc), so the history is always complete regardless of where
-- the change originated. One row per (goal, day): the last value of the day wins.

CREATE TABLE IF NOT EXISTS public.goal_progress_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid        NOT NULL REFERENCES public.goals ON DELETE CASCADE,
  org_id      uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  progress    int         NOT NULL CHECK (progress BETWEEN 0 AND 100),
  recorded_on date        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, recorded_on)
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_history_goal
  ON public.goal_progress_history (goal_id, recorded_on);

ALTER TABLE public.goal_progress_history ENABLE ROW LEVEL SECURITY;

-- Read-only for the user's org. The trigger writes via SECURITY DEFINER (bypasses
-- RLS), so there's deliberately no path for the client to forge history rows.
CREATE POLICY "org_isolation" ON public.goal_progress_history
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- Snapshot the starting point on insert, then on every progress change.
CREATE OR REPLACE FUNCTION public.snapshot_goal_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.progress IS DISTINCT FROM OLD.progress THEN
    INSERT INTO public.goal_progress_history (goal_id, org_id, progress, recorded_on)
    VALUES (NEW.id, NEW.org_id, NEW.progress, (now() AT TIME ZONE 'utc')::date)
    ON CONFLICT (goal_id, recorded_on)
    DO UPDATE SET progress = EXCLUDED.progress, created_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_goal_progress
  AFTER INSERT OR UPDATE OF progress ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_goal_progress();
