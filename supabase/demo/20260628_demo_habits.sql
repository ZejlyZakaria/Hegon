-- Demo · Habits — read-only policies + fictional persona seed.
--
-- Part of the LinkedIn showcase. The demo user lives in its own org (see
-- migrations/20260603_demo_*); this script makes the Habits tables read-only for
-- demo accounts and seeds a coherent fictional history (NO real personal data).
--
-- Run order (manual, from the Supabase SQL editor, after the demo account exists):
--   1. paste + run this whole file once  (creates policies + the seed function)
--   2. SELECT public.seed_demo_habits('demo@example.com');   -- (re-runnable)
--
-- Revealing the module in the demo Dock is done separately, from the owner
-- "Demo & Sharing" panel (set_demo_visible_modules) — NOT here, so you control
-- the reveal on your posting schedule.

-- ── 1. Read-only at the data layer (RESTRICTIVE = ANDed with org_isolation) ───
-- SELECT untouched; only writes are denied for demo users. Non-demo users
-- evaluate `NOT false = true`, so they are never restricted. Mirrors the
-- Watching demo pattern. `to_regclass` guard = safe if a table doesn't exist yet.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['habits', 'habit_completions', 'habit_skips', 'habit_pauses', 'habit_freezes']
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

-- ── 2. Seed — a coherent fictional persona (a developer leveling up) ──────────
-- No source user: the data is invented (unlike Watching, which copies real
-- films). SECURITY DEFINER → bypasses the read-only policies during the seed.
-- Idempotent: wipes the demo's habits first (cascades completions/skips/pauses).
-- Completions are DETERMINISTIC (hash of habit_id+date) so re-running gives the
-- exact same history — no run-to-run drift.

CREATE OR REPLACE FUNCTION public.seed_demo_habits(p_demo_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_user uuid;
  v_demo_org  uuid;
  v_today     date := current_date;
  v_count     integer;
  -- stable habit ids for this run
  h_code  uuid := gen_random_uuid();
  h_read  uuid := gen_random_uuid();
  h_work  uuid := gen_random_uuid();
  h_med   uuid := gen_random_uuid();
  h_water uuid := gen_random_uuid();
  h_shut  uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE email = p_demo_email;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'demo user % not found', p_demo_email; END IF;

  -- Earliest membership = the org getCurrentOrgId() resolves to (deterministic).
  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user ORDER BY created_at ASC LIMIT 1;
  IF v_demo_org IS NULL THEN RAISE EXCEPTION 'demo user % has no org', p_demo_email; END IF;

  -- Wipe previous demo habits (cascades completions / skips / pauses / freezes).
  DELETE FROM public.habits WHERE user_id = v_demo_user;

  -- The 6 habits (created ~130d ago so the history has room). Each gets a distinct
  -- icon; `color` matches that icon's canonical color from the shared ICONS
  -- registry (the modal derives color from icon, so we keep them in sync).
  INSERT INTO public.habits (id, org_id, user_id, title, description, frequency, custom_days, icon, color, created_at)
  VALUES
    (h_code,  v_demo_org, v_demo_user, 'Deep work — 1h',   'One focused hour on a real project.',  'daily',  NULL,          'code-2',    '#a855f7', v_today - 130),
    (h_read,  v_demo_org, v_demo_user, 'Read 20 pages',    'Fiction or tech, every day.',          'daily',  NULL,          'book-open', '#60a5fa', v_today - 130),
    (h_work,  v_demo_org, v_demo_user, 'Workout',          'Strength + mobility.',                 'custom', ARRAY[1,3,5],  'dumbbell',  '#f43f5e', v_today - 130),
    (h_med,   v_demo_org, v_demo_user, 'Meditate 10 min',  'Calm before the day.',                 'daily',  NULL,          'wind',      '#06b6d4', v_today - 130),
    (h_water, v_demo_org, v_demo_user, 'Drink 2L water',   'Stay hydrated.',                       'daily',  NULL,          'droplets',  '#06b6d4', v_today - 130),
    (h_shut,  v_demo_org, v_demo_user, 'Evening shutdown', 'Plan tomorrow, close the laptop.',     'daily',  NULL,          'moon',      '#8b5cf6', v_today - 130);

  -- Completions over the last 120 days. Per-habit target adherence; deterministic
  -- pseudo-random per (habit, date); custom habits only fire on their weekdays.
  WITH defs(habit_id, adherence, freq, days) AS (
    VALUES
      (h_code,  85, 'daily',  NULL::int[]),
      (h_read,  75, 'daily',  NULL),
      (h_work,  80, 'custom', ARRAY[1, 3, 5]),  -- Mon / Wed / Fri (dow 1,3,5)
      (h_med,   70, 'daily',  NULL),
      (h_water, 90, 'daily',  NULL),
      (h_shut,  65, 'daily',  NULL)
  ),
  days AS (
    SELECT generate_series(v_today - 119, v_today, interval '1 day')::date AS d
  )
  INSERT INTO public.habit_completions (habit_id, completed_date)
  SELECT defs.habit_id, days.d
  FROM defs CROSS JOIN days
  WHERE (
          defs.freq = 'daily'
          OR (defs.freq = 'custom' AND extract(dow FROM days.d)::int = ANY (defs.days))
        )
    AND (('x' || substr(md5(defs.habit_id::text || days.d::text), 1, 8))::bit(32)::bigint % 100) < defs.adherence;

  -- Guarantee a clean current streak on "Deep work" (the streak hero shines).
  INSERT INTO public.habit_completions (habit_id, completed_date)
  SELECT h_code, generate_series(v_today - 13, v_today, interval '1 day')::date
  ON CONFLICT (habit_id, completed_date) DO NOTHING;

  -- A couple of skip days (neutral, streak preserved) — shows the skip feature.
  INSERT INTO public.habit_skips (habit_id, skip_date, reason)
  VALUES (h_read, v_today - 40, 'Traveling'),
         (h_read, v_today - 39, 'Traveling')
  ON CONFLICT (habit_id, skip_date) DO NOTHING;

  -- A short pause on Workout (a week off) — shows the pause feature. Clear any
  -- completions inside the window so it reads as a genuine break.
  DELETE FROM public.habit_completions
  WHERE habit_id = h_work AND completed_date BETWEEN v_today - 60 AND v_today - 53;
  INSERT INTO public.habit_pauses (habit_id, pause_start, pause_end)
  VALUES (h_work, v_today - 60, v_today - 53);

  SELECT count(*) INTO v_count
  FROM public.habit_completions
  WHERE habit_id IN (h_code, h_read, h_work, h_med, h_water, h_shut);

  RETURN v_count;
END;
$$;
