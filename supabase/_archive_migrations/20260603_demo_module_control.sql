-- Owner-controlled demo module visibility.
-- The owner toggles which modules the demo account exposes, from their own
-- Settings. Writing the demo's user_settings needs SECURITY DEFINER (the demo's
-- row is otherwise own-row only under RLS).

-- Live (shipped) module keys — kept in sync with src/shared/constants/modules.ts
-- (LIVE_MODULES). Visible = these minus the demo's hidden_modules.

CREATE OR REPLACE FUNCTION public.get_demo_visible_modules()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT m
    FROM unnest(ARRAY['goals', 'habits', 'journal', 'books', 'sport', 'watching', 'tasks']) AS m
    EXCEPT
    SELECT unnest(COALESCE(
      (SELECT hidden_modules FROM public.user_settings
       WHERE user_id = (SELECT id FROM public.profiles WHERE is_demo = true LIMIT 1)),
      '{}'::text[]
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.set_demo_visible_modules(p_visible text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo uuid;
  v_all  text[] := ARRAY['goals', 'habits', 'journal', 'books', 'sport', 'watching', 'tasks'];
BEGIN
  -- Owner only: must be authenticated and never the demo itself.
  IF auth.uid() IS NULL OR public.is_demo_user() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT id INTO v_demo FROM public.profiles WHERE is_demo = true LIMIT 1;
  IF v_demo IS NULL THEN RAISE EXCEPTION 'no demo user'; END IF;

  INSERT INTO public.user_settings (user_id, hidden_modules)
  VALUES (v_demo, ARRAY(SELECT m FROM unnest(v_all) AS m EXCEPT SELECT unnest(p_visible)))
  ON CONFLICT (user_id) DO UPDATE
    SET hidden_modules = EXCLUDED.hidden_modules,
        updated_at     = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_demo_visible_modules()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_demo_visible_modules(text[])   TO authenticated;
