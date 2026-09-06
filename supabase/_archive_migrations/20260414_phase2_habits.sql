-- Phase 2 — Core Modules V1
-- Migration : Habits (tables, RLS, indexes)

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.habits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  frequency     text        NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
  custom_days   int[]       DEFAULT NULL,             -- [0..6] 0=dim, 1=lun … 6=sam
  goal_id       uuid        REFERENCES public.goals ON DELETE SET NULL,
  color         text        NOT NULL DEFAULT '#f43f5e',
  archived      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.habit_completions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id       uuid        NOT NULL REFERENCES public.habits ON DELETE CASCADE,
  completed_date date        NOT NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, completed_date)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.habits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.habits
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- habit_completions n'a pas de org_id — on passe par habits
CREATE POLICY "org_isolation" ON public.habit_completions
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

CREATE INDEX idx_habits_org_id              ON public.habits (org_id);
CREATE INDEX idx_habits_user_id             ON public.habits (user_id);
CREATE INDEX idx_habits_archived            ON public.habits (archived);
CREATE INDEX idx_habit_completions_habit_id ON public.habit_completions (habit_id);
CREATE INDEX idx_habit_completions_date     ON public.habit_completions (completed_date);
