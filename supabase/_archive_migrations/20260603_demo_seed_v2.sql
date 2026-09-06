-- Demo seed v2 — make the seed fully self-sufficient.
--
-- A user created from the Supabase dashboard may not have triggered
-- handle_new_user, so it can lack an org / membership / profile, and it never
-- has a workspace (so the middleware routes it to /onboarding, where the
-- workspace INSERT then fails RLS — 42501). This version provisions everything
-- the demo needs (org, membership, workspace, profile) before copying media, so
-- the demo logs straight into the app, read-only.

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
  IF v_demo_user IS NULL THEN   RAISE EXCEPTION 'demo user % not found', p_demo_email;     END IF;
  IF v_source_user IS NULL THEN RAISE EXCEPTION 'source user % not found', p_source_email; END IF;

  -- Org + owner membership (create if the signup trigger didn't run).
  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user LIMIT 1;
  IF v_demo_org IS NULL THEN
    INSERT INTO public.organizations (name, slug, plan)
    VALUES ('Demo', 'demo-' || left(replace(v_demo_user::text, '-', ''), 8), 'free')
    RETURNING id INTO v_demo_org;
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_demo_org, v_demo_user, 'owner');
  END IF;

  -- Public profile, flagged read-only.
  INSERT INTO public.profiles (id, email, is_demo)
  VALUES (v_demo_user, p_demo_email, true)
  ON CONFLICT (id) DO UPDATE SET is_demo = true;

  -- A workspace so the middleware never routes the demo to onboarding.
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE user_id = v_demo_user) THEN
    INSERT INTO public.workspaces (name, user_id, org_id)
    VALUES ('Demo', v_demo_user, v_demo_org);
  END IF;

  -- Wipe any previous demo media (re-runnable), then copy the source library.
  DELETE FROM watching.media_items WHERE user_id = v_demo_user;

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

  RETURN v_count;
END;
$$;
