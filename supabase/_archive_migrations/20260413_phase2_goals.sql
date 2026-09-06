-- Phase 2 — Core Modules V1
-- Migration : Goals (tables, RLS, indexes)

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.goals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  category      text        CHECK (category IN ('personal', 'work', 'health', 'learning', 'finance', 'other')),
  status        text        NOT NULL DEFAULT 'active'  CHECK (status  IN ('active', 'completed', 'paused', 'abandoned')),
  priority      text        NOT NULL DEFAULT 'medium'  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  progress      int         NOT NULL DEFAULT 0         CHECK (progress BETWEEN 0 AND 100),
  progress_mode text        NOT NULL DEFAULT 'manual'  CHECK (progress_mode IN ('manual', 'auto')),
  target_date   date,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.goal_milestones (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      uuid        NOT NULL REFERENCES public.goals ON DELETE CASCADE,
  title        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  due_date     date,
  completed_at timestamptz,
  order_index  int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Lien tâches → goal
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals ON DELETE SET NULL;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.goals
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- goal_milestones n'a pas de org_id — on passe par goals
CREATE POLICY "org_isolation" ON public.goal_milestones
  USING (
    goal_id IN (
      SELECT id FROM public.goals
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  )
  WITH CHECK (
    goal_id IN (
      SELECT id FROM public.goals
      WHERE org_id IN (SELECT * FROM public.my_orgs())
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_goals_org_id      ON public.goals (org_id);
CREATE INDEX idx_goals_user_id     ON public.goals (user_id);
CREATE INDEX idx_goals_status      ON public.goals (status);
CREATE INDEX idx_goals_target_date ON public.goals (target_date);
CREATE INDEX idx_goal_milestones_goal_id ON public.goal_milestones (goal_id);
CREATE INDEX idx_tasks_goal_id     ON public.tasks (goal_id);
