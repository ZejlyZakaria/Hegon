-- Habits V2 — Streak Freeze
-- A freeze protects a single missed scheduled day so the streak isn't broken.
-- It's a limited resource: a monthly budget enforced in the app (default 3/month).
-- Like skips/pauses it has no org_id; isolation goes through the parent habit.

CREATE TABLE public.habit_freezes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id    uuid        NOT NULL REFERENCES public.habits ON DELETE CASCADE,
  freeze_date date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, freeze_date)
);

ALTER TABLE public.habit_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.habit_freezes
  USING (
    habit_id IN (
      SELECT id FROM public.habits
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  )
  WITH CHECK (
    habit_id IN (
      SELECT id FROM public.habits
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  );

CREATE INDEX idx_habit_freezes_habit_id ON public.habit_freezes (habit_id);
CREATE INDEX idx_habit_freezes_date     ON public.habit_freezes (freeze_date);
