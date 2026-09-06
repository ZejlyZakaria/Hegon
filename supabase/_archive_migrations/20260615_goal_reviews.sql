-- Review ritual — the keystone cadence that turns the tracker into a system.
-- One row per weekly review: the three reflection fields + a snapshot of every
-- active goal's progress at that moment. The snapshot doubles as the anchor for
-- the NEXT review's "what moved" delta (current progress − last snapshot), so the
-- momentum mirror needs no extra history table.

CREATE TABLE IF NOT EXISTS public.goal_reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  period_start date        NOT NULL,
  period_end   date        NOT NULL,
  wins         text        NOT NULL DEFAULT '',
  blockers     text        NOT NULL DEFAULT '',
  focus        text        NOT NULL DEFAULT '',
  -- [{ goal_id, title, progress }] — every active goal at review time.
  snapshot     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- the journal entry this review wrote to (if the user mirrored it), nullable.
  journal_entry_id uuid    REFERENCES public.journal_entries ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_reviews_org_created
  ON public.goal_reviews (org_id, created_at DESC);

ALTER TABLE public.goal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.goal_reviews
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));
