-- Make the Dashboard a controllable module for the demo account.
-- Until now the demo module universe (v_all) hardcoded the 7 LIVE_MODULES and
-- omitted the dashboard (which is a separate constant on the front, DASHBOARD_MODULE),
-- so the owner could never expose/hide it for the demo. Add 'dashboard' to the
-- universe in both RPCs. Dashboard stays ALWAYS-on for the owner (it's the home,
-- not in the owner's Dock toggle list); only the demo's visibility is controlled.
--
-- Keep in sync with src/shared/constants/modules.ts → [DASHBOARD_MODULE, ...LIVE_MODULES].

CREATE OR REPLACE FUNCTION public.get_demo_visible_modules()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT m
    FROM unnest(ARRAY['dashboard', 'goals', 'habits', 'journal', 'books', 'sport', 'watching', 'tasks']) AS m
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
  v_all  text[] := ARRAY['dashboard', 'goals', 'habits', 'journal', 'books', 'sport', 'watching', 'tasks'];
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
