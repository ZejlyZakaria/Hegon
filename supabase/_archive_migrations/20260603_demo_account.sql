-- Demo account — a read-only showcase login for sharing HEGON (e.g. LinkedIn).
--
-- Model: the demo user lives in its OWN org (auto-created by handle_new_user),
-- seeded with a COPY of the source user's Watching library. Because every
-- Watching query filters by user_id, the copy flows through the normal app code
-- with zero changes. Privacy is guaranteed by org_isolation (the demo never
-- shares an org with the real data), and writes are blocked at the DB layer.

-- ── 1. Mark demo users ────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Is the current user a demo (read-only) account?
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_demo FROM public.profiles WHERE id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_user() TO authenticated;

-- ── 2. Read-only at the data layer (RESTRICTIVE = ANDed with org_isolation) ───
-- SELECT is untouched; only writes are denied for demo users. Non-demo users
-- evaluate `NOT false = true`, so they are never restricted.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['media_items', 'media_lists', 'media_list_items', 'episode_highlights']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "demo_readonly_insert" ON watching.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo_readonly_update" ON watching.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo_readonly_delete" ON watching.%I', t);

    EXECUTE format(
      'CREATE POLICY "demo_readonly_insert" ON watching.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.is_demo_user())', t);
    EXECUTE format(
      'CREATE POLICY "demo_readonly_update" ON watching.%I AS RESTRICTIVE FOR UPDATE USING (NOT public.is_demo_user())', t);
    EXECUTE format(
      'CREATE POLICY "demo_readonly_delete" ON watching.%I AS RESTRICTIVE FOR DELETE USING (NOT public.is_demo_user())', t);
  END LOOP;
END $$;

-- ── 3. Seed function — copy the source user's Watching into the demo's org ────
-- Re-runnable: wipes the demo's media first, then copies. Column-introspection
-- keeps it correct even as the media_items schema evolves. Run from the SQL
-- editor after creating the demo auth user:
--   SELECT public.seed_demo_watching('demo@example.com', 'zejly12@gmail.com');

CREATE OR REPLACE FUNCTION public.seed_demo_watching(p_demo_email text, p_source_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, watching
AS $$
DECLARE
  v_demo_user   uuid;
  v_demo_org    uuid;
  v_source_user uuid;
  v_cols        text;
  v_count       integer;
BEGIN
  SELECT id INTO v_demo_user   FROM auth.users WHERE email = p_demo_email;
  SELECT id INTO v_source_user FROM auth.users WHERE email = p_source_email;
  IF v_demo_user IS NULL THEN  RAISE EXCEPTION 'demo user % not found', p_demo_email;   END IF;
  IF v_source_user IS NULL THEN RAISE EXCEPTION 'source user % not found', p_source_email; END IF;

  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user LIMIT 1;
  IF v_demo_org IS NULL THEN RAISE EXCEPTION 'demo user has no org'; END IF;

  -- Wipe any previous demo media (re-runnable).
  DELETE FROM watching.media_items WHERE user_id = v_demo_user;

  -- All columns except the ones we override / let default.
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'watching' AND table_name = 'media_items'
    AND column_name NOT IN ('id', 'user_id', 'org_id', 'created_at', 'updated_at');

  EXECUTE format(
    'INSERT INTO watching.media_items (id, user_id, org_id, %1$s)
     SELECT gen_random_uuid(), %2$L, %3$L, %1$s
     FROM watching.media_items WHERE user_id = %4$L',
    v_cols, v_demo_user, v_demo_org, v_source_user
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Demo Dock: only Watching visible, land there by default.
  INSERT INTO public.user_settings (user_id, default_module, hidden_modules)
  VALUES (v_demo_user, 'watching', ARRAY['goals', 'habits', 'journal', 'books', 'sport', 'tasks'])
  ON CONFLICT (user_id) DO UPDATE
    SET default_module = EXCLUDED.default_module,
        hidden_modules = EXCLUDED.hidden_modules,
        updated_at     = now();

  -- Flag the demo profile read-only.
  UPDATE public.profiles SET is_demo = true WHERE id = v_demo_user;

  RETURN v_count;
END;
$$;
