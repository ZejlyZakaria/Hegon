-- episode_highlights: the episode becomes an object the panel can READ (air date, synopsis),
-- and the two columns nobody used go — decided 2026-09-12 (owner), built with the season panel.
--
--   · air_date / overview — a photo of the moment you starred it (title + still already were).
--     Backfilled once from TMDB by scripts/backfill-episode-highlights.mjs after this runs.
--   · rating — per-episode /10. Real data on 2026-09-12: 648 rows, 643 best ep, 17 ratings (2.6 %),
--     12 of the 17 also best ep. A second verdict nobody gave. Gone, with its check constraint.
--   · note — 0 rows ever written, displayed nowhere.
--
-- seed_demo_watching copied `note` → re-created with the new columns (and `highlighted`, which it
-- had silently dropped: every demo highlight was seeded as false).

alter table watching.episode_highlights
  add column if not exists air_date date,
  add column if not exists overview text;

-- A highlight row is a best episode now, nothing else. Rows that only carried a rating are not
-- best episodes and would render as such once `highlighted` is the sole meaning of the row.
delete from watching.episode_highlights where highlighted = false;

alter table watching.episode_highlights
  drop constraint if exists episode_highlights_rating_check,
  drop column if exists rating,
  drop column if exists note;

CREATE OR REPLACE FUNCTION "public"."seed_demo_watching"("p_demo_email" "text", "p_source_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'watching'
    AS $_$
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
  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user ORDER BY created_at ASC LIMIT 1;
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

  -- Wipe previous demo Watching data (re-runnable). Deleting lists then media
  -- items cascades all list-items + episode highlights.
  DELETE FROM watching.media_lists WHERE user_id = v_demo_user;
  DELETE FROM watching.media_items WHERE user_id = v_demo_user;

  -- 1. media_items — all columns except the ones we override / let default.
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

  -- 2. media_lists + media_list_items (FK remap: list via the CTE, media by tmdb_id+type).
  WITH src_lists AS MATERIALIZED (
    SELECT id AS src_id, name, description, emoji, color, is_ranked,
           gen_random_uuid() AS new_id
    FROM watching.media_lists WHERE user_id = v_source_user
  ),
  ins_lists AS (
    INSERT INTO watching.media_lists (id, user_id, org_id, name, description, emoji, color, is_ranked, created_at, updated_at)
    SELECT new_id, v_demo_user, v_demo_org, name, description, emoji, color, is_ranked, now(), now()
    FROM src_lists
    RETURNING 1
  )
  INSERT INTO watching.media_list_items (id, list_id, media_item_id, user_id, org_id, position, note, added_at)
  SELECT gen_random_uuid(), sl.new_id, dm.id, v_demo_user, v_demo_org, sli.position, sli.note, sli.added_at
  FROM watching.media_list_items sli
  JOIN src_lists sl                 ON sl.src_id = sli.list_id
  JOIN watching.media_items sm      ON sm.id = sli.media_item_id
  JOIN watching.media_items dm      ON dm.tmdb_id = sm.tmdb_id AND dm.type = sm.type AND dm.user_id = v_demo_user
  WHERE sli.user_id = v_source_user;

  -- 3. episode_highlights (FK remap: media by tmdb_id+type).
  -- `highlighted` was never copied: every demo highlight landed as false and the rail stayed empty.
  INSERT INTO watching.episode_highlights (id, user_id, media_item_id, org_id, season, episode, title, still_path, air_date, overview, highlighted, created_at)
  SELECT gen_random_uuid(), v_demo_user, dm.id, v_demo_org, eh.season, eh.episode, eh.title, eh.still_path, eh.air_date, eh.overview, eh.highlighted, now()
  FROM watching.episode_highlights eh
  JOIN watching.media_items sm ON sm.id = eh.media_item_id
  JOIN watching.media_items dm ON dm.tmdb_id = sm.tmdb_id AND dm.type = sm.type AND dm.user_id = v_demo_user
  WHERE eh.user_id = v_source_user;

  -- Demo Dock: only Watching visible, land there by default.
  INSERT INTO public.user_settings (user_id, default_module, hidden_modules)
  VALUES (v_demo_user, 'watching', ARRAY['dashboard', 'goals', 'habits', 'journal', 'books', 'sport', 'tasks'])
  ON CONFLICT (user_id) DO UPDATE
    SET default_module = EXCLUDED.default_module,
        hidden_modules = EXCLUDED.hidden_modules,
        updated_at     = now();

  RETURN v_count;
END;
$_$;
