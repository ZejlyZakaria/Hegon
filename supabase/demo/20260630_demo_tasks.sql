-- Demo · Tasks — read-only policies + fictional persona seed.
--
-- Part of the LinkedIn showcase. Same demo user / own org as the other demo
-- modules; this makes the Tasks tables read-only for demo accounts and seeds a
-- coherent fictional board (NO real personal data) — the SAME persona as Habits
-- (a developer leveling up: building HEGON, hunting a job, learning).
--
-- Run order (manual, from the Supabase SQL editor, after the demo account exists):
--   1. paste + run this whole file once  (creates policies + the seed function)
--   2. SELECT public.seed_demo_tasks('demo@example.com');   -- (re-runnable)
--
-- Revealing the module in the demo Dock is done separately, from the owner
-- "Demo & Sharing" panel — NOT here, so you control the reveal on your schedule.

-- ── 1. Read-only at the data layer (RESTRICTIVE = ANDed with the access policy) ─
-- SELECT untouched; only writes are denied for demo users. Non-demo users
-- evaluate `NOT false = true`, so they are never restricted. `to_regclass` guard
-- = safe for tables that may not exist.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspaces', 'projects', 'statuses', 'tags', 'tasks', 'task_tags',
    'task_activities', 'activity_log', 'attachments', 'comments', 'task_dependencies',
    'org_invitations', 'workspace_members'
  ]
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

-- ── 2. Seed — a coherent fictional board ─────────────────────────────────────
-- No source user: invented data. SECURITY DEFINER → bypasses the read-only
-- policies during the seed. Idempotent: wipes the demo's projects/tags first.
-- org_id + position are provided explicitly so the BEFORE INSERT triggers
-- (set_*_org_id / set_task_position) keep our values.

CREATE OR REPLACE FUNCTION public.seed_demo_tasks(p_demo_email text)
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
  -- projects
  p_hegon uuid := gen_random_uuid();
  p_job   uuid := gen_random_uuid();
  p_learn uuid := gen_random_uuid();
  -- tags
  tag_frontend uuid := gen_random_uuid();
  tag_backend  uuid := gen_random_uuid();
  tag_design   uuid := gen_random_uuid();
  tag_urgent   uuid := gen_random_uuid();
  tag_research uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE email = p_demo_email;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'demo user % not found', p_demo_email; END IF;

  -- Earliest membership = the org getCurrentOrgId() resolves to (deterministic).
  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user ORDER BY created_at ASC LIMIT 1;
  IF v_demo_org IS NULL THEN RAISE EXCEPTION 'demo user % has no org', p_demo_email; END IF;

  -- Reuse the demo's existing workspace (created by the Watching seed), renamed;
  -- create one if somehow missing.
  SELECT id INTO v_ws FROM public.workspaces
    WHERE user_id = v_demo_user ORDER BY position ASC NULLS LAST, created_at ASC LIMIT 1;
  IF v_ws IS NULL THEN
    INSERT INTO public.workspaces (user_id, org_id, name, position)
    VALUES (v_demo_user, v_demo_org, 'Personal', 1)
    RETURNING id INTO v_ws;
  ELSE
    UPDATE public.workspaces SET name = 'Personal' WHERE id = v_ws;
  END IF;

  -- Wipe previous demo board (cascades statuses / task_tags / activities).
  DELETE FROM public.tasks    WHERE project_id IN (SELECT id FROM public.projects WHERE workspace_id = v_ws);
  DELETE FROM public.statuses WHERE project_id IN (SELECT id FROM public.projects WHERE workspace_id = v_ws);
  DELETE FROM public.projects WHERE workspace_id = v_ws;
  DELETE FROM public.tags     WHERE workspace_id = v_ws;

  -- Projects.
  INSERT INTO public.projects (id, workspace_id, org_id, name, description, color, status, position)
  VALUES
    (p_hegon, v_ws, v_demo_org, 'HEGON',    'Building my life OS.',        '#3b82f6', 'active', 1),
    (p_job,   v_ws, v_demo_org, 'Job Hunt', 'Landing my first dev role.',  '#22c55e', 'active', 2),
    (p_learn, v_ws, v_demo_org, 'Learning', 'Leveling up every week.',     '#a855f7', 'active', 3);

  -- Statuses: the default 4-column workflow for each project.
  INSERT INTO public.statuses (project_id, org_id, name, color, type, icon, position, is_completed)
  SELECT p.pid, v_demo_org, w.name, w.color, w.type, w.icon, w.pos, (w.type = 'done')
  FROM (VALUES (p_hegon), (p_job), (p_learn)) AS p(pid)
  CROSS JOIN (VALUES
    ('Backlog',     '#6b7280', 'backlog',     'circle_dashed', 1),
    ('Todo',        '#94a3b8', 'todo',        'circle_empty',  2),
    ('In Progress', '#3b82f6', 'in_progress', 'circle_quarter',3),
    ('Done',        '#22c55e', 'done',        'circle_check',  4)
  ) AS w(name, color, type, icon, pos);

  -- Tasks — HEGON.
  INSERT INTO public.tasks (project_id, org_id, title, status_id, priority, created_by, assignee_id, due_date, completed_at, position, is_archived)
  VALUES
    (p_hegon, v_demo_org, 'Set up Supabase RLS & multi-tenancy', (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='done'),        'high',   v_demo_user, v_demo_user, NULL,             now() - interval '20 days', 1, false),
    (p_hegon, v_demo_org, 'Ship the Watching module',            (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='done'),        'high',   v_demo_user, v_demo_user, NULL,             now() - interval '10 days', 2, false),
    (p_hegon, v_demo_org, 'Dark theme polish pass',              (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='done'),        'medium', v_demo_user, v_demo_user, NULL,             now() - interval '4 days',  3, false),
    (p_hegon, v_demo_org, 'Build the demo mode (read-only)',     (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='in_progress'), 'high',   v_demo_user, v_demo_user, current_date + 2, NULL, 1, false),
    (p_hegon, v_demo_org, 'Mobile responsive pass',              (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='in_progress'), 'medium', v_demo_user, v_demo_user, current_date + 6, NULL, 2, false),
    (p_hegon, v_demo_org, 'Wire up Stripe billing',              (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='todo'),        'high',   v_demo_user, v_demo_user, current_date + 5, NULL, 1, false),
    (p_hegon, v_demo_org, 'Write the onboarding flow',           (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='todo'),        'medium', v_demo_user, v_demo_user, current_date + 9, NULL, 2, false),
    (p_hegon, v_demo_org, 'Design the analytics dashboard',      (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='backlog'),     'medium', v_demo_user, v_demo_user, NULL,             NULL, 1, false),
    (p_hegon, v_demo_org, 'Add CSV export',                      (SELECT id FROM public.statuses WHERE project_id = p_hegon AND type='backlog'),     'low',    v_demo_user, v_demo_user, NULL,             NULL, 2, false);

  -- Tasks — Job Hunt.
  INSERT INTO public.tasks (project_id, org_id, title, status_id, priority, created_by, assignee_id, due_date, completed_at, position, is_archived)
  VALUES
    (p_job, v_demo_org, 'Update my CV',                  (SELECT id FROM public.statuses WHERE project_id = p_job AND type='done'),        'high',     v_demo_user, v_demo_user, NULL,             now() - interval '6 days', 1, false),
    (p_job, v_demo_org, 'Rewrite my LinkedIn headline',  (SELECT id FROM public.statuses WHERE project_id = p_job AND type='done'),        'medium',   v_demo_user, v_demo_user, NULL,             now() - interval '8 days', 2, false),
    (p_job, v_demo_org, 'Record the LinkedIn demo video',(SELECT id FROM public.statuses WHERE project_id = p_job AND type='in_progress'), 'critical', v_demo_user, v_demo_user, current_date + 1, NULL, 1, false),
    (p_job, v_demo_org, 'Apply to 5 startups',           (SELECT id FROM public.statuses WHERE project_id = p_job AND type='todo'),        'high',     v_demo_user, v_demo_user, current_date + 3, NULL, 1, false),
    (p_job, v_demo_org, 'Prepare system-design answers', (SELECT id FROM public.statuses WHERE project_id = p_job AND type='todo'),        'medium',   v_demo_user, v_demo_user, current_date + 7, NULL, 2, false),
    (p_job, v_demo_org, 'Refresh my portfolio site',     (SELECT id FROM public.statuses WHERE project_id = p_job AND type='backlog'),     'medium',   v_demo_user, v_demo_user, NULL,             NULL, 1, false);

  -- Tasks — Learning.
  INSERT INTO public.tasks (project_id, org_id, title, status_id, priority, created_by, assignee_id, due_date, completed_at, position, is_archived)
  VALUES
    (p_learn, v_demo_org, 'Finish the TypeScript advanced course',           (SELECT id FROM public.statuses WHERE project_id = p_learn AND type='done'),        'medium', v_demo_user, v_demo_user, NULL,              now() - interval '12 days', 1, false),
    (p_learn, v_demo_org, 'Build a small CLI in Go',                         (SELECT id FROM public.statuses WHERE project_id = p_learn AND type='in_progress'), 'medium', v_demo_user, v_demo_user, NULL,              NULL, 1, false),
    (p_learn, v_demo_org, 'Read "Designing Data-Intensive Applications"',    (SELECT id FROM public.statuses WHERE project_id = p_learn AND type='todo'),        'low',    v_demo_user, v_demo_user, current_date + 14, NULL, 1, false),
    (p_learn, v_demo_org, 'Rust book — chapters 10 to 13',                   (SELECT id FROM public.statuses WHERE project_id = p_learn AND type='backlog'),     'low',    v_demo_user, v_demo_user, NULL,              NULL, 1, false);

  -- Backdate creation so completed tasks read as genuinely older than "today".
  UPDATE public.tasks SET created_at = now() - interval '30 days'
  WHERE project_id IN (p_hegon, p_job, p_learn);

  -- Tags (workspace-scoped).
  INSERT INTO public.tags (id, workspace_id, user_id, org_id, name, color)
  VALUES
    (tag_frontend, v_ws, v_demo_user, v_demo_org, 'frontend', '#60a5fa'),
    (tag_backend,  v_ws, v_demo_user, v_demo_org, 'backend',  '#22c55e'),
    (tag_design,   v_ws, v_demo_user, v_demo_org, 'design',   '#f59e0b'),
    (tag_urgent,   v_ws, v_demo_user, v_demo_org, 'urgent',   '#f43f5e'),
    (tag_research, v_ws, v_demo_user, v_demo_org, 'research', '#a855f7');

  -- Link a few tasks to tags (by title within their project).
  INSERT INTO public.task_tags (task_id, tag_id, org_id)
  SELECT tk.id, m.tag_id, v_demo_org
  FROM (VALUES
    (p_hegon, 'Build the demo mode (read-only)',                tag_backend),
    (p_hegon, 'Build the demo mode (read-only)',                tag_urgent),
    (p_hegon, 'Mobile responsive pass',                         tag_frontend),
    (p_hegon, 'Mobile responsive pass',                         tag_design),
    (p_hegon, 'Wire up Stripe billing',                         tag_backend),
    (p_hegon, 'Design the analytics dashboard',                 tag_design),
    (p_hegon, 'Design the analytics dashboard',                 tag_frontend),
    (p_job,   'Record the LinkedIn demo video',                 tag_urgent),
    (p_job,   'Prepare system-design answers',                  tag_research),
    (p_learn, 'Build a small CLI in Go',                        tag_backend),
    (p_learn, 'Read "Designing Data-Intensive Applications"',   tag_research)
  ) AS m(pid, title, tag_id)
  JOIN public.tasks tk ON tk.project_id = m.pid AND tk.title = m.title;

  SELECT count(*) INTO v_count FROM public.tasks WHERE project_id IN (p_hegon, p_job, p_learn);
  RETURN v_count;
END;
$$;
