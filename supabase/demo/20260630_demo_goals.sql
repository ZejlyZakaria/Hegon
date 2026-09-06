-- Demo · Goals — read-only policies + fictional persona seed.
--
-- Part of the LinkedIn showcase. Same demo user / own org as the other demo
-- modules; the SAME persona (a developer leveling up). The goals LINK to the
-- tasks + habits seeded by the other demo scripts, so the "Fueling this goal"
-- sections (tasks + habits) are populated.
--
-- Run order (manual, from the Supabase SQL editor, after the demo account exists):
--   IMPORTANT: run the Tasks + Habits demo seeds FIRST so the links resolve.
--   1. paste + run this whole file once  (creates policies + the seed function)
--   2. SELECT public.seed_demo_goals('demo@example.com');   -- (re-runnable)
--
-- Revealing the module in the demo Dock is done separately, from the owner
-- "Demo & Sharing" panel — NOT here.

-- ── 1. Read-only at the data layer ────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['goals', 'goal_milestones', 'goal_reviews', 'goal_progress_history']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS "demo_readonly_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo_readonly_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo_readonly_delete" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "demo_readonly_insert" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.is_demo_user())', t);
    EXECUTE format(
      'CREATE POLICY "demo_readonly_update" ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT public.is_demo_user())', t);
    EXECUTE format(
      'CREATE POLICY "demo_readonly_delete" ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT public.is_demo_user())', t);
  END LOOP;
END $$;

-- ── 2. Seed — 4 manual goals, linked to the demo's tasks + habits ─────────────
-- Manual progress (predictable, no dependency on the recalc RPC). SECURITY
-- DEFINER → bypasses the read-only policies (here AND on tasks/habits, so the
-- links can be written). Idempotent: deleting the goals cascades milestones +
-- progress_history and SET NULLs the tasks/habits links.

CREATE OR REPLACE FUNCTION public.seed_demo_goals(p_demo_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_user uuid;
  v_demo_org  uuid;
  v_ws        uuid;
  v_count     integer;
  g_role  uuid := gen_random_uuid();  -- Land my first role (parent)
  g_hegon uuid := gen_random_uuid();  -- Build & ship HEGON
  g_dev   uuid := gen_random_uuid();  -- Become a better developer
  g_rout  uuid := gen_random_uuid();  -- Build a consistent routine
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE email = p_demo_email;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'demo user % not found', p_demo_email; END IF;

  -- Earliest membership = the org getCurrentOrgId() resolves to (deterministic).
  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user ORDER BY created_at ASC LIMIT 1;
  IF v_demo_org IS NULL THEN RAISE EXCEPTION 'demo user % has no org', p_demo_email; END IF;

  SELECT id INTO v_ws FROM public.workspaces
    WHERE user_id = v_demo_user ORDER BY position ASC NULLS LAST, created_at ASC LIMIT 1;

  -- Wipe previous demo goals (cascades milestones + history; SET NULLs links).
  DELETE FROM public.goal_reviews WHERE user_id = v_demo_user;
  DELETE FROM public.goals        WHERE user_id = v_demo_user;

  -- Goals.
  INSERT INTO public.goals (id, org_id, user_id, title, description, why, category, status, priority, progress, progress_mode, target_date, started_at, parent_goal_id)
  VALUES
    (g_role,  v_demo_org, v_demo_user, 'Land my first full-stack role', 'Sign a permanent contract.',    'Stability + grow with a real team.',          'career',    'active', 'critical', 30, 'manual', current_date + 120, now() - interval '40 days', NULL),
    (g_hegon, v_demo_org, v_demo_user, 'Build & ship HEGON',            'Get the app production-ready.',  'My portfolio centerpiece — proof I can ship.', 'career',    'active', 'high',     35, 'manual', current_date + 30,  now() - interval '40 days', g_role),
    (g_dev,   v_demo_org, v_demo_user, 'Become a better developer',     'Level up fundamentals weekly.', 'Depth beats breadth — go deep.',               'growth',    'active', 'medium',   55, 'manual', current_date + 200, now() - interval '40 days', g_role),
    (g_rout,  v_demo_org, v_demo_user, 'Build a consistent routine',    'Show up every day.',            'Systems over motivation.',                     'lifestyle', 'active', 'medium',   60, 'manual', current_date + 90,  now() - interval '40 days', NULL);

  -- Milestones (a few done, the rest pending).
  INSERT INTO public.goal_milestones (goal_id, title, status, completed_at, order_index)
  VALUES
    (g_role,  'Polish my CV',                'completed', now() - interval '6 days',  1),
    (g_role,  'Rebuild portfolio site',      'pending',   NULL,                       2),
    (g_role,  'Apply to 20 companies',       'pending',   NULL,                       3),
    (g_role,  'Pass a technical interview',  'pending',   NULL,                       4),
    (g_hegon, 'Ship the Watching module',    'completed', now() - interval '10 days', 1),
    (g_hegon, 'Build the demo mode',         'pending',   NULL,                       2),
    (g_hegon, 'Ship the Tasks module',       'pending',   NULL,                       3),
    (g_hegon, 'Record the launch video',     'pending',   NULL,                       4),
    (g_dev,   'Finish the TypeScript course','completed', now() - interval '12 days', 1),
    (g_dev,   'Build a CLI in Go',           'pending',   NULL,                       2),
    (g_dev,   'Read 6 tech books this year', 'pending',   NULL,                       3),
    (g_rout,  'Hit a 30-day workout streak', 'pending',   NULL,                       1),
    (g_rout,  'Meditate for 100 days',       'pending',   NULL,                       2);

  -- Link the seeded tasks (by project) — "Fueling this goal" → Tasks.
  IF v_ws IS NOT NULL THEN
    UPDATE public.tasks SET goal_id = g_hegon WHERE project_id IN (SELECT id FROM public.projects WHERE workspace_id = v_ws AND name = 'HEGON');
    UPDATE public.tasks SET goal_id = g_role  WHERE project_id IN (SELECT id FROM public.projects WHERE workspace_id = v_ws AND name = 'Job Hunt');
    UPDATE public.tasks SET goal_id = g_dev   WHERE project_id IN (SELECT id FROM public.projects WHERE workspace_id = v_ws AND name = 'Learning');
  END IF;

  -- Link the seeded habits (by title) — "Fueling this goal" → Habits.
  UPDATE public.habits SET goal_id = g_dev
    WHERE user_id = v_demo_user AND title IN ('Deep work — 1h', 'Read 20 pages');
  UPDATE public.habits SET goal_id = g_rout
    WHERE user_id = v_demo_user AND title IN ('Workout', 'Meditate 10 min', 'Drink 2L water', 'Evening shutdown');

  -- Backdated momentum curve (the detail-page sparkline). Today's point is added
  -- by the snapshot_goal_progress trigger on insert; these are the rising history.
  INSERT INTO public.goal_progress_history (goal_id, org_id, progress, recorded_on)
  SELECT m.gid, v_demo_org, m.prog, current_date - m.days
  FROM (VALUES
    (g_role,   8, 28), (g_role,  15, 21), (g_role,  22, 14), (g_role,  27, 7),
    (g_hegon, 10, 28), (g_hegon, 18, 21), (g_hegon, 26, 14), (g_hegon, 32, 7),
    (g_dev,   18, 28), (g_dev,   32, 21), (g_dev,   44, 14), (g_dev,   51, 7),
    (g_rout,  22, 28), (g_rout,  38, 21), (g_rout,  50, 14), (g_rout,  57, 7)
  ) AS m(gid, prog, days)
  ON CONFLICT (goal_id, recorded_on) DO NOTHING;

  SELECT count(*) INTO v_count FROM public.goals WHERE user_id = v_demo_user;
  RETURN v_count;
END;
$$;
