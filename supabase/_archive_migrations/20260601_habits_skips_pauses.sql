-- Habits V2 — Skip days & Pauses
--   skip  = one-off neutral day. The day is neither completed nor missed; the streak is preserved.
--   pause = a date range where the habit is hidden from Today and its streak is frozen (bridged).
-- RLS follows the habit_completions pattern: no org_id column, isolation goes through habits.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.habit_skips (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id   uuid        NOT NULL REFERENCES public.habits ON DELETE CASCADE,
  skip_date  date        NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, skip_date)
);

CREATE TABLE public.habit_pauses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id    uuid        NOT NULL REFERENCES public.habits ON DELETE CASCADE,
  pause_start date        NOT NULL,
  pause_end   date,                           -- NULL = open-ended (still paused)
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (pause_end IS NULL OR pause_end >= pause_start)
);

-- ============================================================
-- RLS — isolation through the parent habit (same as habit_completions)
-- ============================================================

ALTER TABLE public.habit_skips  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.habit_skips
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

CREATE POLICY "org_isolation" ON public.habit_pauses
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

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_habit_skips_habit_id  ON public.habit_skips (habit_id);
CREATE INDEX idx_habit_skips_date       ON public.habit_skips (skip_date);
CREATE INDEX idx_habit_pauses_habit_id ON public.habit_pauses (habit_id);
