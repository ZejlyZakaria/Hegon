


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "internal";


ALTER SCHEMA "internal" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "sport";


ALTER SCHEMA "sport" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "watching";


ALTER SCHEMA "watching" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "internal"."call_edge"("fn" "text", "payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  gateway_key constant text := 'sb_publishable_Fs1GCChzoqGOal70bXGEIA_qbWyhJsQ';
  req_id bigint;
begin
  if fn !~ '^[a-z0-9_-]+$' then
    raise exception 'call_edge: invalid function name %', fn;
  end if;

  select net.http_post(
    url := 'https://femvhonlpafdajyamvcu.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || gateway_key
    ),
    body := payload,
    timeout_milliseconds := 300000
  ) into req_id;

  return req_id;
end;
$_$;


ALTER FUNCTION "internal"."call_edge"("fn" "text", "payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "internal"."notify_new_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform internal.call_edge(
    'notify-new-signup',
    jsonb_build_object('record', jsonb_build_object(
      'email',              new.email,
      'raw_user_meta_data', new.raw_user_meta_data,
      'created_at',         new.created_at
    ))
  );
  return new;
exception when others then
  -- Un mail de notif raté ne doit JAMAIS empêcher une inscription.
  raise warning 'notify_new_signup failed: %', sqlerrm;
  return new;
end;
$$;


ALTER FUNCTION "internal"."notify_new_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inv        record;
  uid        uuid := auth.uid();
  user_email text := lower(auth.jwt() ->> 'email');
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO inv
  FROM public.org_invitations
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid_or_expired');
  END IF;

  IF user_email IS NULL OR lower(inv.email) <> user_email THEN
    RETURN json_build_object('error', 'email_mismatch');
  END IF;

  -- ── Workspace invitation ──────────────────────────────────────────────────
  IF inv.workspace_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = inv.workspace_id AND user_id = uid
    ) THEN
      RETURN json_build_object('error', 'already_member');
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
    VALUES (inv.workspace_id, uid, inv.role, inv.invited_by);

    UPDATE public.org_invitations SET used_at = now() WHERE id = inv.id;

    RETURN json_build_object(
      'success',      true,
      'type',         'workspace',
      'workspace_id', inv.workspace_id
    );

  -- ── Org invitation (comportement existant) ────────────────────────────────
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.memberships
      WHERE org_id = inv.org_id AND user_id = uid
    ) THEN
      RETURN json_build_object('error', 'already_member');
    END IF;

    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (inv.org_id, uid, inv.role);

    UPDATE public.org_invitations SET used_at = now() WHERE id = inv.id;

    RETURN json_build_object(
      'success', true,
      'type',    'org',
      'org_id',  inv.org_id
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."accept_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_task_status_same_project"() RETURNS "trigger"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  status_project uuid;
BEGIN
  IF NEW.status_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT project_id INTO status_project
  FROM public.statuses
  WHERE id = NEW.status_id;

  IF status_project IS NULL OR status_project <> NEW.project_id THEN
    RAISE EXCEPTION 'status_id % does not belong to project %', NEW.status_id, NEW.project_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_task_status_same_project"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_demo_visible_modules"() RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_demo_visible_modules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inv  record;
  org  record;
BEGIN
  SELECT * INTO inv
  FROM public.org_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, name, slug INTO org
  FROM public.organizations
  WHERE id = inv.org_id;

  RETURN json_build_object(
    'id',           inv.id,
    'org_id',       inv.org_id,
    'workspace_id', inv.workspace_id,
    'invited_by',   inv.invited_by,
    'email',        inv.email,
    'token',        inv.token,
    'role',         inv.role,
    'expires_at',   inv.expires_at,
    'used_at',      inv.used_at,
    'created_at',   inv.created_at,
    'org',          json_build_object('name', org.name, 'slug', org.slug)
  );
END;
$$;


ALTER FUNCTION "public"."get_invitation_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_org_id uuid;
  org_name   text;
  org_slug   text;
BEGIN
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  org_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'))
              || '-'
              || left(replace(NEW.id::text, '-', ''), 8);

  INSERT INTO public.organizations (name, slug, plan)
  VALUES (org_name, org_slug, 'free')
  RETURNING id INTO new_org_id;

  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_demo_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((SELECT is_demo FROM public.profiles WHERE id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_demo_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_book_reading"("p_book_id" "uuid", "p_date" "date", "p_pages" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_org  uuid;
  v_user uuid;
BEGIN
  SELECT org_id, user_id INTO v_org, v_user
  FROM public.books WHERE id = p_book_id;

  IF v_org IS NULL OR GREATEST(p_pages, 0) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.book_reading_log (org_id, user_id, book_id, date, pages_read)
  VALUES (v_org, v_user, p_book_id, p_date, GREATEST(p_pages, 0))
  ON CONFLICT (book_id, date)
  DO UPDATE SET pages_read = public.book_reading_log.pages_read + GREATEST(EXCLUDED.pages_read, 0);
END;
$$;


ALTER FUNCTION "public"."log_book_reading"("p_book_id" "uuid", "p_date" "date", "p_pages" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_org_workspace_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT w.id FROM public.workspaces w
  JOIN public.memberships m ON m.org_id = w.org_id
  WHERE m.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_org_workspace_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_orgs"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT org_id
  FROM public.memberships
  WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_orgs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_owned_workspace_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT w.id
  FROM public.workspaces w
  JOIN public.memberships m
    ON m.org_id = w.org_id
   AND m.user_id = auth.uid()
   AND m.role = 'owner';
$$;


ALTER FUNCTION "public"."my_owned_workspace_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_workspace_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_workspace_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_workspace_project_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id
  FROM public.projects p
  INNER JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
  WHERE wm.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_workspace_project_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_goal_progress"("p_goal_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'watching', 'sport'
    AS $$
DECLARE
  v_mode      text;
  v_user      uuid;
  v_mod       text;
  v_key       text;
  v_period    text;
  v_year      int;
  v_target    int;
  v_total     integer;
  v_completed integer;
  v_count     integer;
  v_progress  integer;
BEGIN
  SELECT progress_mode, user_id, metric_module, metric_key, metric_period, metric_year, metric_target
    INTO v_mode, v_user, v_mod, v_key, v_period, v_year, v_target
    FROM goals WHERE id = p_goal_id;

  IF v_mode IS NULL OR v_mode <> 'auto' THEN
    RETURN -1;  -- manual mode or goal deleted → caller skips
  END IF;

  -- ── Metric-driven (cross-module count) ──────────────────────────────────────
  IF v_mod IS NOT NULL THEN
    IF v_mod = 'watching' THEN
      SELECT COUNT(*) INTO v_count
        FROM watching.media_items m
        WHERE m.user_id = v_user
          AND m.watched = true
          AND m.is_reference IS NOT TRUE
          AND (v_key = 'titles' OR m.type = CASE v_key
                 WHEN 'films'  THEN 'film'
                 WHEN 'series' THEN 'serie'
                 WHEN 'anime'  THEN 'anime'
               END)
          AND (v_period <> 'year'
               OR (m.watched_at IS NOT NULL AND EXTRACT(YEAR FROM m.watched_at) = v_year));

    ELSIF v_mod = 'books' THEN
      SELECT COUNT(*) INTO v_count
        FROM books b
        WHERE b.user_id = v_user
          AND b.status = 'read'
          AND (v_period <> 'year'
               OR (b.finished_at IS NOT NULL AND EXTRACT(YEAR FROM b.finished_at) = v_year));

    ELSIF v_mod = 'football' THEN
      SELECT COUNT(*) INTO v_count
        FROM sport.football_watched_matches w
        WHERE w.user_id = v_user
          AND w.watched = true
          -- key 'stadium' → only stadium visits; anything else → every logged match
          AND (v_key IS DISTINCT FROM 'stadium' OR w.watched_where = 'stadium')
          AND (v_period <> 'year'
               OR (w.watched_at IS NOT NULL AND EXTRACT(YEAR FROM w.watched_at) = v_year));

    ELSE
      v_count := 0;  -- unknown module (future-proof) → no progress
    END IF;

    IF v_target IS NULL OR v_target <= 0 THEN
      v_progress := 0;
    ELSE
      v_progress := LEAST(ROUND((v_count::numeric / v_target) * 100), 100);
    END IF;

    UPDATE goals SET progress = v_progress WHERE id = p_goal_id;
    RETURN v_progress;
  END IF;

  -- ── Task-driven (existing behaviour, unchanged) ─────────────────────────────
  SELECT COUNT(*), COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
    INTO v_total, v_completed
    FROM tasks WHERE goal_id = p_goal_id;

  IF v_total = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := ROUND((v_completed::numeric / v_total) * 100);
  END IF;

  UPDATE goals SET progress = v_progress WHERE id = p_goal_id;
  RETURN v_progress;
END;
$$;


ALTER FUNCTION "public"."recalc_goal_progress"("p_goal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_books"("p_demo_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_demo_user uuid;
  v_demo_org  uuid;
  v_count     integer;
  -- referenced books (reading streak + quotes)
  b_atomic uuid := gen_random_uuid();
  b_psych  uuid := gen_random_uuid();
  b_four   uuid := gen_random_uuid();
  b_1984   uuid := gen_random_uuid();
  b_laws   uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE email = p_demo_email;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'demo user % not found', p_demo_email; END IF;

  -- Match getCurrentOrgId() exactly (earliest membership) so the books land in the
  -- org the client actually queries. A bare LIMIT 1 is non-deterministic.
  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user ORDER BY created_at ASC LIMIT 1;
  IF v_demo_org IS NULL THEN RAISE EXCEPTION 'demo user % has no org', p_demo_email; END IF;

  -- Wipe previous demo books (cascades quotes + reading log).
  DELETE FROM public.books              WHERE user_id = v_demo_user;
  DELETE FROM public.book_user_settings WHERE org_id  = v_demo_org;

  -- Library. status: read (rated) · reading (current_page) · want_to_read.
  INSERT INTO public.books (id, org_id, user_id, title, author, cover_url, external_id, year, genre, total_pages, description, status, current_page, rating, favorite, started_at, finished_at)
  VALUES
    -- ── Read ──
    (b_atomic, v_demo_org, v_demo_user, 'Atomic Habits', 'James Clear',
      'https://books.google.com/books/content?id=fFCjDQAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'fFCjDQAAQBAJ', 2018, ARRAY['Self-Help'], 216,
      $d$Tiny changes, remarkable results. James Clear reveals how small habits compound into life-altering outcomes — habit stacking, the two-minute rule, and the Goldilocks zone — backed by psychology and neuroscience.$d$,
      'read', 216, 5, true, now() - interval '40 days', now() - interval '28 days'),
    (b_psych, v_demo_org, v_demo_user, 'The Psychology of Money', 'Morgan Housel',
      'https://books.google.com/books/content?id=TnrrDwAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'TnrrDwAAQBAJ', 2020, ARRAY['Business & Economics'], 209,
      $d$Doing well with money isn't about what you know — it's about how you behave. Through 19 short stories, Morgan Housel explores the strange ways people think about wealth, risk, and happiness.$d$,
      'read', 209, 5, false, now() - interval '58 days', now() - interval '45 days'),
    (b_four, v_demo_org, v_demo_user, 'The Four Agreements', 'Don Miguel Ruiz',
      'https://books.google.com/books/content?id=hzVxiw2DiOsC&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'hzVxiw2DiOsC', 2011, ARRAY['Self-Help'], 161,
      $d$Based on ancient Toltec wisdom, four simple agreements offer a powerful code of conduct that can transform our lives to a new experience of freedom, true happiness, and love.$d$,
      'read', 161, 5, true, now() - interval '108 days', now() - interval '95 days'),
    (gen_random_uuid(), v_demo_org, v_demo_user, 'Discipline Is Destiny', 'Ryan Holiday',
      'https://books.google.com/books/content?id=u_JXEAAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'u_JXEAAAQBAJ', 2022, ARRAY['Business & Economics'], 353,
      $d$The second book of Ryan Holiday's Stoic Virtue series celebrates self-discipline — temperance, self-mastery, and balance — through the stories of figures who embodied it.$d$,
      'read', 353, 4, false, now() - interval '28 days', now() - interval '15 days'),
    (gen_random_uuid(), v_demo_org, v_demo_user, 'The Courage To Be Disliked', 'Ichiro Kishimi',
      'https://books.google.com/books/content?id=IggxDwAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'IggxDwAAQBAJ', 2018, ARRAY['Philosophy'], 315,
      $d$A philosopher and a student debate a liberating idea: by developing the courage to change, set boundaries, and resist the urge to please others, lasting happiness becomes possible.$d$,
      'read', 315, 4, false, now() - interval '74 days', now() - interval '60 days'),
    (gen_random_uuid(), v_demo_org, v_demo_user, 'Man''s Search for Meaning', 'Viktor E. Frankl',
      'https://books.google.com/books/content?id=umJ8DgAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'umJ8DgAAQBAJ', 2017, ARRAY['Nonfiction'], 186,
      $d$A classic of Holocaust literature and a timeless examination of finding purpose in suffering — Frankl's universal lessons for coping and meaning still resonate.$d$,
      'read', 186, 5, false, now() - interval '95 days', now() - interval '80 days'),
    -- ── Reading ──
    (b_1984, v_demo_org, v_demo_user, '1984', 'George Orwell',
      'https://books.google.com/books/content?id=28CZEAAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      '28CZEAAAQBAJ', 2022, ARRAY['Fiction'], 396,
      $d$Winston Smith works at the Ministry of Truth, rewriting the past. As the Party's lies grind at him, his forbidden bond with Julia pushes him toward dissidence. The monument of dystopian fiction.$d$,
      'reading', 103, NULL, true, now() - interval '14 days', NULL),
    (b_laws, v_demo_org, v_demo_user, 'The Laws of Human Nature', 'Robert Greene',
      'https://books.google.com/books/content?id=I_1RDwAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'I_1RDwAAQBAJ', 2018, ARRAY['Self-Help'], 626,
      $d$Robert Greene decodes the drives and motivations behind human behavior — empathy, self-control, reading people's masks — drawing on history's greatest figures.$d$,
      'reading', 240, NULL, false, now() - interval '22 days', NULL),
    -- ── Want to read ──
    (gen_random_uuid(), v_demo_org, v_demo_user, 'Think and Grow Rich', 'Napoleon Hill',
      'https://books.google.com/books/content?id=_LBPEAAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      '_LBPEAAAQBAJ', 2011, ARRAY['Business & Economics'], 353, NULL,
      'want_to_read', 0, NULL, false, NULL, NULL),
    (gen_random_uuid(), v_demo_org, v_demo_user, 'The Art of War', 'Sun Tzu',
      'https://books.google.com/books/content?id=UTGnopblxt8C&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'UTGnopblxt8C', 2002, ARRAY['History'], 100, NULL,
      'want_to_read', 0, NULL, false, NULL, NULL),
    (gen_random_uuid(), v_demo_org, v_demo_user, 'Behave', 'Robert M. Sapolsky',
      'https://books.google.com/books/content?id=sJKoDAAAQBAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      'sJKoDAAAQBAJ', 2017, ARRAY['Science'], 801, NULL,
      'want_to_read', 0, NULL, false, NULL, NULL),
    (gen_random_uuid(), v_demo_org, v_demo_user, 'Crime and Punishment', 'Fyodor Dostoyevsky',
      'https://books.google.com/books/content?id=0HZrq-4zA5QC&printsec=frontcover&img=1&zoom=5&source=gbs_api&fife=w400',
      '0HZrq-4zA5QC', 2008, ARRAY['Fiction'], 1090, NULL,
      'want_to_read', 0, NULL, false, NULL, NULL);

  -- created_at backdated so the shelf isn't "all added today".
  UPDATE public.books
     SET created_at = COALESCE(started_at, now() - interval '20 days') - interval '3 days'
   WHERE user_id = v_demo_user;

  -- Reading log — the source of truth for streak / weekly dots / pages this month.
  -- 1) every finished book credited its pages on its finish day (mirrors the
  --    book_reading_log backfill migration).
  INSERT INTO public.book_reading_log (org_id, user_id, book_id, date, pages_read)
  SELECT org_id, user_id, id, finished_at::date, COALESCE(total_pages, 0)
  FROM public.books
  WHERE user_id = v_demo_user AND status = 'read' AND finished_at IS NOT NULL AND COALESCE(total_pages, 0) > 0
  ON CONFLICT (book_id, date) DO NOTHING;

  -- 2) a live current streak: ~12 pages of "1984" every day for the last 10 days.
  INSERT INTO public.book_reading_log (org_id, user_id, book_id, date, pages_read)
  SELECT v_demo_org, v_demo_user, b_1984, (current_date - g)::date, 8 + (g % 3) * 4
  FROM generate_series(0, 9) AS g
  ON CONFLICT (book_id, date) DO NOTHING;

  -- 3) a few earlier "Laws of Human Nature" sessions (fills the month's pages).
  INSERT INTO public.book_reading_log (org_id, user_id, book_id, date, pages_read)
  SELECT v_demo_org, v_demo_user, b_laws, (current_date - g)::date, 30
  FROM (VALUES (12), (15), (18), (21)) AS s(g)
  ON CONFLICT (book_id, date) DO NOTHING;

  -- A few quotes (the Quotes Wall) on the finished favourites.
  INSERT INTO public.book_quotes (org_id, user_id, book_id, text, page, note, favorite, position)
  VALUES
    (v_demo_org, v_demo_user, b_atomic, $q$You do not rise to the level of your goals. You fall to the level of your systems.$q$, 27, NULL, true, 0),
    (v_demo_org, v_demo_user, b_atomic, $q$Every action you take is a vote for the type of person you wish to become.$q$, 38, NULL, false, 1),
    (v_demo_org, v_demo_user, b_psych,  $q$Spending money to show people how much money you have is the fastest way to have less money.$q$, 96, NULL, true, 0),
    (v_demo_org, v_demo_user, b_four,   $q$Be impeccable with your word. Speak with integrity. Say only what you mean.$q$, 31, $n$The first agreement — the hardest.$n$, false, 0);

  -- Monthly pages target → draws the target line on the activity chart.
  INSERT INTO public.book_user_settings (org_id, monthly_pages_target)
  VALUES (v_demo_org, 400)
  ON CONFLICT (org_id) DO UPDATE SET monthly_pages_target = EXCLUDED.monthly_pages_target, updated_at = now();

  SELECT count(*) INTO v_count FROM public.books WHERE user_id = v_demo_user;
  RETURN v_count;
END;
$_$;


ALTER FUNCTION "public"."seed_demo_books"("p_demo_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_goals"("p_demo_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."seed_demo_goals"("p_demo_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_habits"("p_demo_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user LIMIT 1;
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


ALTER FUNCTION "public"."seed_demo_habits"("p_demo_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_journal"("p_demo_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_demo_user uuid;
  v_demo_org  uuid;
  v_count     integer;
BEGIN
  SELECT id INTO v_demo_user FROM auth.users WHERE email = p_demo_email;
  IF v_demo_user IS NULL THEN RAISE EXCEPTION 'demo user % not found', p_demo_email; END IF;

  SELECT org_id INTO v_demo_org FROM public.memberships WHERE user_id = v_demo_user ORDER BY created_at ASC LIMIT 1;
  IF v_demo_org IS NULL THEN RAISE EXCEPTION 'demo user % has no org', p_demo_email; END IF;

  -- Wipe previous demo journal.
  DELETE FROM public.journal_entries WHERE user_id = v_demo_user;
  IF to_regclass('public.journal_events') IS NOT NULL THEN
    DELETE FROM public.journal_events WHERE org_id = v_demo_org;
  END IF;

  -- Entries. entry_date = today − n (n distinct → the UNIQUE(user, date) holds).
  -- word_count is a GENERATED column → never inserted; the DB computes it.
  INSERT INTO public.journal_entries (org_id, user_id, entry_date, title, content, mood, tags)
  SELECT v_demo_org, v_demo_user, current_date - e.n, e.title, e.content, e.mood, e.tags
  FROM (VALUES
    (0,  NULL::text,    $d$Morocco beat the Netherlands tonight — we're through to the next round! Watched it with the whole family, everyone on their feet screaming at the TV, my voice is completely gone. These are the nights you remember for years. I also shipped the read-only demo earlier, which felt huge right up until kickoff and then nothing else existed. What a day.$d$, 'good', ARRAY['football','win']),
    (1,  NULL,          $d$Spent the whole evening chasing a race condition in the kanban drag. Turns out I was the bug. Fixed it around 1am, too tired to even feel good about it.$d$, 'tired',   ARRAY['work']),
    (2,  NULL,          $d$Sent six applications. The waiting is the worst part — you throw your CV into the void and just wait. Trying hard not to refresh my inbox every five minutes.$d$, 'neutral', ARRAY['job']),
    (3,  NULL,          $d$Gym in the morning, then forty pages of Atomic Habits. "You do not rise to the level of your goals, you fall to the level of your systems." Can't stop thinking about that line.$d$, 'good', ARRAY['health','reflection']),
    (4,  NULL,          $d$Rough day. A rejection email hit harder than I expected and the imposter syndrome crept back in. Closed the laptop early and went for a long walk instead of spiraling.$d$, 'rough', ARRAY['doubt']),
    (6,  NULL,          $d$Demo mode is finally clicking. I'd been overcomplicating the whole thing for days — the simple version was sitting right there the entire time. Always the way.$d$, 'calm', ARRAY['work','idea']),
    (8,  'Slow Sunday', $d$Coffee, a few chapters of 1984, no screens until noon. I always forget how much I need days like this until I actually have one.$d$, 'calm', ARRAY['reflection']),
    (11, NULL,          $d$Three months into HEGON and it actually feels like a real product now, not a side toy. Still a long road ahead, but I'm proud of how far it's come.$d$, 'good', ARRAY['work','win']),
    (14, NULL,          $d$Couldn't find any focus today. Some days the code just won't flow no matter what I try. Logged my habits, read a little, called it early. Tomorrow's a new one.$d$, 'tired', ARRAY[]::text[]),
    (17, NULL,          $d$Finished The Courage to Be Disliked. The idea that other people's opinions of me aren't actually my problem is equal parts freeing and terrifying.$d$, 'neutral', ARRAY['reflection']),
    (21, NULL,          $d$First real interview is on the calendar. Excited and nervous in the same breath. Stayed up too late revising system design instead of sleeping, which I'll regret.$d$, 'neutral', ARRAY['job']),
    (24, NULL,          $d$Tiny win — a recruiter actually replied. Even a "we'll be in touch" feels enormous right now. I'll take it.$d$, 'good', ARRAY['job','win']),
    (29, 'One month in',$d$A full month of journaling without missing a day. Genuinely didn't think I'd keep it up. Seeing the streak in the tracker makes me not want to break it — turns out that's the whole trick.$d$, 'good', ARRAY['reflection','gratitude']),
    (33, NULL,          $d$Built the entire Goals module today. Linking tasks and habits to a goal makes the app feel alive, like all the pieces finally talk to each other.$d$, 'good', ARRAY['work']),
    (40, NULL,          $d$Tired and a little discouraged. Money's tight and the job hunt is slower than I'd hoped. But I keep showing up every single day. That has to count for something.$d$, 'rough', ARRAY['doubt']),
    (46, NULL,          $d$Grateful today. My family believes in this even on the days I don't. That keeps me moving more than they'll ever know.$d$, 'good', ARRAY['gratitude']),
    (54, 'Day one',     $d$Started HEGON for real today. No idea if anyone will ever use it, but building it makes me happy, and right now that's more than enough.$d$, 'calm', ARRAY['work','reflection'])
  ) AS e(n, title, content, mood, tags);

  -- A few upcoming events (guarded — the journal_events table may not be applied).
  -- user_id must be set explicitly (its DEFAULT auth.uid() is NULL inside the seed).
  IF to_regclass('public.journal_events') IS NOT NULL THEN
    INSERT INTO public.journal_events (org_id, user_id, event_date, title, note, type)
    VALUES
      (v_demo_org, v_demo_user, current_date + 1,  'Record the LinkedIn demo video', NULL,                 'deadline'),
      (v_demo_org, v_demo_user, current_date + 5,  'Call with Alten — Fès',          'Java / Spring role', 'reminder'),
      (v_demo_org, v_demo_user, current_date + 9,  'Ship the Tasks module',          NULL,                 'milestone'),
      (v_demo_org, v_demo_user, current_date + 16, 'Mom''s birthday',                NULL,                 'birthday');
  END IF;

  SELECT count(*) INTO v_count FROM public.journal_entries WHERE user_id = v_demo_user;
  RETURN v_count;
END;
$_$;


ALTER FUNCTION "public"."seed_demo_journal"("p_demo_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_tasks"("p_demo_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."seed_demo_tasks"("p_demo_email" "text") OWNER TO "postgres";


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
  INSERT INTO watching.episode_highlights (id, user_id, media_item_id, org_id, season, episode, title, still_path, note, created_at)
  SELECT gen_random_uuid(), v_demo_user, dm.id, v_demo_org, eh.season, eh.episode, eh.title, eh.still_path, eh.note, now()
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


ALTER FUNCTION "public"."seed_demo_watching"("p_demo_email" "text", "p_source_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_demo_visible_modules"("p_visible" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."set_demo_visible_modules"("p_visible" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_project_org_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_project_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_project_position"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.position IS NULL THEN
    SELECT COALESCE(MAX(position), 0) + 1
    INTO NEW.position
    FROM projects
    WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_project_position"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_status_org_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_status_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tag_org_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tag_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_org_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_task_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_position"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.position IS NULL THEN
    SELECT COALESCE(MAX(position), 0) + 1
    INTO NEW.position
    FROM tasks
    WHERE project_id = NEW.project_id AND status_id = NEW.status_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_task_position"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_tag_org_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.tasks
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_task_tag_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_goal_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.progress IS DISTINCT FROM OLD.progress THEN
    INSERT INTO public.goal_progress_history (goal_id, org_id, progress, recorded_on)
    VALUES (NEW.id, NEW.org_id, NEW.progress, (now() AT TIME ZONE 'utc')::date)
    ON CONFLICT (goal_id, recorded_on)
    DO UPDATE SET progress = EXCLUDED.progress, created_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."snapshot_goal_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_status_is_completed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.is_completed := NEW.type IN ('done', 'cancelled');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_status_is_completed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "sport"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "sport"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "watching"."touch_note_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Only the note's own edits stamp it (NULL <-> text counts as a change).
  if new.notes is distinct from old.notes then
    new.note_updated_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "watching"."touch_note_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "page" integer,
    "note" "text",
    "favorite" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."book_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_reading_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "pages_read" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."book_reading_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_user_settings" (
    "org_id" "uuid" NOT NULL,
    "monthly_pages_target" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."book_user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "author" "text",
    "cover_url" "text",
    "external_id" "text",
    "year" integer,
    "genre" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "total_pages" integer,
    "description" "text",
    "status" "text" DEFAULT 'want_to_read'::"text" NOT NULL,
    "current_page" integer DEFAULT 0 NOT NULL,
    "rating" integer,
    "notes" "text",
    "highlights" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "favorite" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "goal_id" "uuid",
    CONSTRAINT "books_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "books_status_check" CHECK (("status" = ANY (ARRAY['want_to_read'::"text", 'reading'::"text", 'read'::"text", 'abandoned'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_milestones_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."goal_milestones" REPLICA IDENTITY FULL;


ALTER TABLE "public"."goal_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_progress_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "progress" integer NOT NULL,
    "recorded_on" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_progress_history_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100)))
);


ALTER TABLE "public"."goal_progress_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "wins" "text" DEFAULT ''::"text" NOT NULL,
    "blockers" "text" DEFAULT ''::"text" NOT NULL,
    "focus" "text" DEFAULT ''::"text" NOT NULL,
    "snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "journal_entry_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."goal_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "progress_mode" "text" DEFAULT 'manual'::"text" NOT NULL,
    "target_date" "date",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metric_module" "text",
    "metric_key" "text",
    "metric_period" "text",
    "metric_year" integer,
    "metric_target" integer,
    "why" "text",
    "parent_goal_id" "uuid",
    CONSTRAINT "goals_category_check" CHECK (("category" = ANY (ARRAY['career'::"text", 'health'::"text", 'finance'::"text", 'growth'::"text", 'lifestyle'::"text", 'other'::"text"]))),
    CONSTRAINT "goals_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "goals_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "goals_progress_mode_check" CHECK (("progress_mode" = ANY (ARRAY['manual'::"text", 'auto'::"text"]))),
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text", 'abandoned'::"text"])))
);

ALTER TABLE ONLY "public"."goals" REPLICA IDENTITY FULL;


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habit_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "habit_id" "uuid" NOT NULL,
    "completed_date" "date" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."habit_completions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."habit_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habit_freezes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "habit_id" "uuid" NOT NULL,
    "freeze_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."habit_freezes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habit_pauses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "habit_id" "uuid" NOT NULL,
    "pause_start" "date" NOT NULL,
    "pause_end" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "habit_pauses_check" CHECK ((("pause_end" IS NULL) OR ("pause_end" >= "pause_start")))
);


ALTER TABLE "public"."habit_pauses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habit_skips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "habit_id" "uuid" NOT NULL,
    "skip_date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."habit_skips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "custom_days" integer[],
    "goal_id" "uuid",
    "color" "text" DEFAULT '#f43f5e'::"text" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "icon" "text" DEFAULT 'star'::"text" NOT NULL,
    "source_module" "text",
    "source_key" "text",
    CONSTRAINT "habits_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'custom'::"text"])))
);

ALTER TABLE ONLY "public"."habits" REPLICA IDENTITY FULL;


ALTER TABLE "public"."habits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "title" "text",
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "mood" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "word_count" integer GENERATED ALWAYS AS (
CASE
    WHEN (TRIM(BOTH FROM "content") = ''::"text") THEN 0
    ELSE "array_length"("regexp_split_to_array"(TRIM(BOTH FROM "content"), '\s+'::"text"), 1)
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "goal_id" "uuid",
    "context" "jsonb",
    CONSTRAINT "journal_entries_mood_check" CHECK (("mood" = ANY (ARRAY['calm'::"text", 'good'::"text", 'neutral'::"text", 'tired'::"text", 'rough'::"text"])))
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "event_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "note" "text",
    "type" "text" DEFAULT 'reminder'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."journal_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "token" "text" DEFAULT "replace"((("gen_random_uuid"())::"text" || ("gen_random_uuid"())::"text"), '-'::"text", ''::"text") NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    CONSTRAINT "org_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."org_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organizations_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_demo" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "status" "text" DEFAULT 'active'::"text",
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL,
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."projects" REPLICA IDENTITY FULL;


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "position" integer DEFAULT 0,
    "is_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'todo'::"text" NOT NULL,
    "icon" "text",
    CONSTRAINT "statuses_type_check" CHECK (("type" = ANY (ARRAY['backlog'::"text", 'todo'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."statuses" REPLICA IDENTITY FULL;


ALTER TABLE "public"."statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."tags" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    CONSTRAINT "task_dependencies_check" CHECK (("task_id" <> "depends_on_task_id"))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_tags" (
    "task_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "parent_task_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status_id" "uuid",
    "priority" "text" DEFAULT 'medium'::"text",
    "created_by" "uuid",
    "assignee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "due_date" timestamp with time zone,
    "start_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "position" numeric DEFAULT 0,
    "is_archived" boolean DEFAULT false,
    "recurring_pattern" "jsonb",
    "org_id" "uuid" NOT NULL,
    "goal_id" "uuid",
    "priority_rank" smallint GENERATED ALWAYS AS (
CASE "priority"
    WHEN 'critical'::"text" THEN 0
    WHEN 'high'::"text" THEN 1
    WHEN 'medium'::"text" THEN 2
    WHEN 'low'::"text" THEN 3
    ELSE 4
END) STORED,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'medium'::"text", 'low'::"text"])))
);

ALTER TABLE ONLY "public"."tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "default_module" "text" DEFAULT 'dashboard'::"text" NOT NULL,
    "week_start" "text" DEFAULT 'monday'::"text" NOT NULL,
    "date_format" "text" DEFAULT 'DD/MM/YYYY'::"text" NOT NULL,
    "hidden_modules" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_settings_date_format_check" CHECK (("date_format" = ANY (ARRAY['DD/MM/YYYY'::"text", 'MM/DD/YYYY'::"text", 'YYYY-MM-DD'::"text"]))),
    CONSTRAINT "user_settings_week_start_check" CHECK (("week_start" = ANY (ARRAY['monday'::"text", 'sunday'::"text"])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"])))
);

ALTER TABLE ONLY "public"."workspace_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."workspaces" REPLICA IDENTITY FULL;


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."f1_circuits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "jolpica_circuit_id" "text" NOT NULL,
    "circuit_name" "text" NOT NULL,
    "locality" "text",
    "country" "text",
    "country_code" "text",
    "latitude" numeric(10,6),
    "longitude" numeric(10,6),
    "circuit_svg_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "circuit_length_km" numeric(5,3),
    "total_laps" integer,
    "aerial_image_url" "text",
    "last_winner_driver_id" "uuid",
    "last_winner_year" integer
);


ALTER TABLE "sport"."f1_circuits" OWNER TO "postgres";


COMMENT ON COLUMN "sport"."f1_circuits"."last_winner_driver_id" IS 'UUID du dernier vainqueur sur ce circuit. Référence f1_drivers(id)';



COMMENT ON COLUMN "sport"."f1_circuits"."last_winner_year" IS 'Année du dernier GP gagné sur ce circuit (ex: 2025)';



CREATE TABLE IF NOT EXISTS "sport"."f1_constructor_standings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season" integer NOT NULL,
    "team_id" "uuid",
    "position" integer NOT NULL,
    "points" numeric(5,1) NOT NULL,
    "wins" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "podiums" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "sport"."f1_constructor_standings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."f1_driver_standings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season" integer NOT NULL,
    "driver_id" "uuid",
    "team_id" "uuid",
    "position" integer NOT NULL,
    "points" numeric(5,1) NOT NULL,
    "wins" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "podiums" integer DEFAULT 0
);


ALTER TABLE "sport"."f1_driver_standings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."f1_drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "jolpica_driver_id" "text" NOT NULL,
    "openf1_driver_number" integer,
    "code" "text",
    "permanent_number" integer,
    "given_name" "text" NOT NULL,
    "family_name" "text" NOT NULL,
    "full_name" "text" GENERATED ALWAYS AS ((("given_name" || ' '::"text") || "family_name")) STORED,
    "date_of_birth" "date",
    "nationality" "text",
    "current_team_id" "uuid",
    "headshot_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "sport"."f1_drivers" OWNER TO "postgres";


COMMENT ON COLUMN "sport"."f1_drivers"."is_active" IS 'Indique si le pilote est actif dans la saison actuelle. false = retraité ou parti de la F1';



CREATE TABLE IF NOT EXISTS "sport"."f1_qualification_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "race_id" "uuid",
    "driver_id" "uuid",
    "team_id" "uuid",
    "grid_position" integer NOT NULL,
    "q1_time" "text",
    "q2_time" "text",
    "q3_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "sport"."f1_qualification_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."f1_races" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season" integer NOT NULL,
    "round" integer NOT NULL,
    "jolpica_round" integer NOT NULL,
    "openf1_meeting_key" integer,
    "race_name" "text" NOT NULL,
    "circuit_id" "uuid",
    "race_date" "date" NOT NULL,
    "race_time" time without time zone,
    "quali_date" "date",
    "quali_time" time without time zone,
    "status" "text" DEFAULT 'upcoming'::"text",
    "ergast_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "f1_races_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "sport"."f1_races" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."f1_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "race_id" "uuid",
    "driver_id" "uuid",
    "team_id" "uuid",
    "position" integer,
    "grid_position" integer,
    "points" numeric(4,1),
    "laps" integer,
    "time_result" "text",
    "fastest_lap" boolean DEFAULT false,
    "fastest_lap_time" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "sport"."f1_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."f1_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "jolpica_constructor_id" "text" NOT NULL,
    "openf1_constructor_id" "text",
    "name" "text" NOT NULL,
    "nationality" "text",
    "color_primary" "text",
    "color_secondary" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "sport"."f1_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_best_xi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "formation" "text" DEFAULT '4-3-3'::"text" NOT NULL,
    "substitutes_count" integer DEFAULT 7 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "sport"."football_best_xi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_best_xi_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "best_xi_id" "uuid",
    "player_external_id" "text",
    "player_name" "text" NOT NULL,
    "nationality" "text",
    "image_url" "text",
    "position_key" "text" NOT NULL,
    "is_substitute" boolean DEFAULT false,
    "substitute_order" integer,
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "sport"."football_best_xi_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_competition_winners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_id" "uuid" NOT NULL,
    "season_year" integer NOT NULL,
    "winner_name" "text" NOT NULL,
    "winner_wikidata_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "season_wikidata_id" "text",
    "season_label" "text"
);


ALTER TABLE "sport"."football_competition_winners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_competitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "country" "text",
    "emblem_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "brand_color" "text",
    "logo_url" "text",
    "wikidata_id" "text"
);


ALTER TABLE "sport"."football_competitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_legends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "player_external_id" "text" NOT NULL,
    "player_name" "text" NOT NULL,
    "nationality" "text",
    "image_url" "text",
    "position" "text",
    "display_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "birth_date" "text",
    "birth_location" "text",
    "height" "text",
    "last_club" "text",
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "sport"."football_legends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_match_id" integer NOT NULL,
    "competition_id" "uuid",
    "season" integer,
    "utc_date" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "matchday" integer,
    "stage" "text",
    "group" "text",
    "venue" "text",
    "attendance" integer,
    "home_team_external_id" "text" NOT NULL,
    "away_team_external_id" "text" NOT NULL,
    "home_team_name" "text" NOT NULL,
    "away_team_name" "text" NOT NULL,
    "home_team_id" "uuid",
    "away_team_id" "uuid",
    "home_score" integer,
    "away_score" integer,
    "home_score_ht" integer,
    "away_score_ht" integer,
    "winner" "text",
    "last_updated" timestamp with time zone,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sport"."football_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "external_match_id" integer NOT NULL,
    "pred_home" integer NOT NULL,
    "pred_away" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "football_predictions_pred_away_check" CHECK ((("pred_away" >= 0) AND ("pred_away" <= 99))),
    CONSTRAINT "football_predictions_pred_home_check" CHECK ((("pred_home" >= 0) AND ("pred_home" <= 99)))
);


ALTER TABLE "sport"."football_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_standings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_id" "uuid",
    "team_id" "uuid",
    "played_games" integer,
    "won" integer,
    "draw" integer,
    "lost" integer,
    "points" integer,
    "goals_for" integer,
    "goals_against" integer,
    "goal_difference" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "position" integer
);


ALTER TABLE "sport"."football_standings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_team_competitions" (
    "team_id" "uuid" NOT NULL,
    "competition_id" "uuid" NOT NULL
);


ALTER TABLE "sport"."football_team_competitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_team_honours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "competition_qid" "text" NOT NULL,
    "competition_name" "text" NOT NULL,
    "category" "text",
    "titles" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sport"."football_team_honours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "api_external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "tla" "text",
    "crest_url" "text",
    "country" "text",
    "founded" integer,
    "venue" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_colors" "text",
    "website" "text",
    "wikidata_id" "text",
    "thesportsdb_id" "text",
    "fanart_url" "text",
    "banner_url" "text",
    "description" "text",
    "stadium_capacity" integer,
    "enriched_at" timestamp with time zone
);


ALTER TABLE "sport"."football_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_user_competitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "competition_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sport"."football_user_competitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "main_team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "sport"."football_user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."football_watched_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "external_match_id" integer NOT NULL,
    "watched" boolean DEFAULT true NOT NULL,
    "watched_where" "text",
    "rating" numeric(3,1),
    "note" "text",
    "watched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "football_watched_matches_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (10)::numeric))),
    CONSTRAINT "football_watched_matches_watched_where_check" CHECK (("watched_where" = ANY (ARRAY['tv'::"text", 'stadium'::"text", 'live'::"text"])))
);


ALTER TABLE "sport"."football_watched_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."tennis_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "tournament_id" "uuid",
    "opponent_cache_id" "uuid",
    "opponent_name" "text" NOT NULL,
    "match_date" timestamp with time zone,
    "status" character varying(20),
    "round" character varying(50),
    "score" "text",
    "winner" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "atp_match_id" character varying(100),
    "tournament_url" "text",
    CONSTRAINT "tennis_matches_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['scheduled'::character varying, 'finished'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "tennis_matches_winner_check" CHECK (("winner" = ANY (ARRAY['player'::"text", 'opponent'::"text", NULL::"text"])))
);


ALTER TABLE "sport"."tennis_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."tennis_players" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "thesportsdb_id" integer,
    "name" "text" NOT NULL,
    "country" "text",
    "country_code" character varying(3),
    "birth_date" "date",
    "photo_thumb_url" "text",
    "photo_cutout_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tennis_explorer_slug" character varying(100)
);


ALTER TABLE "sport"."tennis_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."tennis_players_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "thesportsdb_id" integer,
    "country" "text",
    "country_code" character varying(3),
    "birth_date" "date",
    "photo_thumb_url" "text",
    "photo_cutout_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "sport"."tennis_players_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."tennis_rankings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "rank" integer NOT NULL,
    "points" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "sport"."tennis_rankings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."tennis_tournaments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_code" character varying(50) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "name" "text" NOT NULL,
    "level" character varying(50) NOT NULL,
    "surface" character varying(20),
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "duration_days" integer,
    "city" "text",
    "country" "text",
    "country_code" character varying(3),
    "points_winner" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "sport"."tennis_tournaments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sport"."user_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    CONSTRAINT "user_favorites_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['tennis_player'::"text", 'football_team'::"text", 'f1_team'::"text"])))
);


ALTER TABLE "sport"."user_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."anime_cours" (
    "tmdb_id" integer NOT NULL,
    "cours" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'anilist'::"text" NOT NULL,
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "watching"."anime_cours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."episode_highlights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_item_id" "uuid" NOT NULL,
    "season" integer NOT NULL,
    "episode" integer NOT NULL,
    "title" "text",
    "still_path" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "rating" numeric(3,1),
    "highlighted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "episode_highlights_episode_check" CHECK (("episode" >= 1)),
    CONSTRAINT "episode_highlights_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (10)::numeric))),
    CONSTRAINT "episode_highlights_season_check" CHECK (("season" >= 1))
);


ALTER TABLE "watching"."episode_highlights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."for_you_cache" (
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "for_you_cache_type_check" CHECK (("type" = ANY (ARRAY['film'::"text", 'serie'::"text", 'anime'::"text"])))
);


ALTER TABLE "watching"."for_you_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."media_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "original_title" "text",
    "description" "text",
    "poster_url" "text",
    "backdrop_url" "text",
    "year" integer,
    "runtime" integer,
    "seasons" integer,
    "episodes" integer,
    "current_episode" integer DEFAULT 0,
    "rating" double precision,
    "user_rating" real,
    "watched" boolean DEFAULT false,
    "want_to_watch" boolean DEFAULT false,
    "favorite" boolean DEFAULT false,
    "watched_at" timestamp without time zone,
    "priority" integer,
    "tmdb_id" integer,
    "tags" "text"[],
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "directors" "jsonb",
    "studio" character varying(255),
    "status" character varying(20),
    "priority_level" "text",
    "current_season" integer DEFAULT 1,
    "in_progress" boolean DEFAULT false,
    "season_episodes" "jsonb",
    "org_id" "uuid" NOT NULL,
    "is_reference" boolean DEFAULT false NOT NULL,
    "season_years" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "season_ratings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "season_posters" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "season_air_dates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cast_members" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "dropped" boolean DEFAULT false NOT NULL,
    "drop_reason" "text",
    "paused" boolean DEFAULT false NOT NULL,
    "note_updated_at" timestamp with time zone,
    "season_aired" integer[],
    "caught_up_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "last_watched_at" timestamp with time zone,
    "season_end_dates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "release_date" "date",
    "cour_years" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cour_ratings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "media_items_cour_columns_series_only" CHECK ((("type" <> 'film'::"text") OR ((("cour_years" IS NULL) OR ("cour_years" = '{}'::"jsonb")) AND (("cour_ratings" IS NULL) OR ("cour_ratings" = '{}'::"jsonb"))))),
    CONSTRAINT "media_items_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 10))),
    CONSTRAINT "media_items_priority_level_check" CHECK (("priority_level" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "media_items_type_check" CHECK (("type" = ANY (ARRAY['film'::"text", 'serie'::"text", 'anime'::"text"]))),
    CONSTRAINT "media_items_user_rating_check" CHECK ((("user_rating" IS NULL) OR (("user_rating" >= (0)::double precision) AND ("user_rating" <= (10)::double precision))))
);


ALTER TABLE "watching"."media_items" OWNER TO "postgres";


COMMENT ON COLUMN "watching"."media_items"."season_aired" IS 'Episodes ACTUALLY AIRED per season. The only source of truth for progress, +1, episode locking and completion. season_episodes is announced-only and must never drive a decision.';



COMMENT ON COLUMN "watching"."media_items"."caught_up_at" IS 'When you last saw everything that had aired. Non-null = you were caught up; used to surface "New episodes" when the world moves on.';



COMMENT ON COLUMN "watching"."media_items"."last_synced_at" IS 'Last TMDB refresh of status / season_episodes / season_aired. Null = never synced.';



COMMENT ON COLUMN "watching"."media_items"."last_watched_at" IS 'When you last moved FORWARD through this title (episode/season advance, or marked watched). Never set by a correction. Null = never captured; fall back to the season years you have reached.';



COMMENT ON COLUMN "watching"."media_items"."season_end_dates" IS 'Air date of the LAST AIRED episode of each season (null while a season is still coming out). Floors every "year watched" picker. Filled by the series sync.';



COMMENT ON COLUMN "watching"."media_items"."release_date" IS 'Date de sortie du FILM (TMDB release_date). Null pour séries/animes et pour les vieux films (fallback sur status). Seule source du calcul « Waiting for » : release_date > aujourd''hui = pas encore sorti.';



COMMENT ON COLUMN "watching"."media_items"."cour_years" IS 'Per-COUR watch year for an AniList-overlaid anime: { "<cour>": <year> }. Distinct from season_years (TMDB seasons), which Stats reads.';



COMMENT ON COLUMN "watching"."media_items"."cour_ratings" IS 'Per-COUR rating for an AniList-overlaid anime: { "<cour>": <rating> }.';



COMMENT ON CONSTRAINT "media_items_cour_columns_series_only" ON "watching"."media_items" IS 'cour_years/cour_ratings are cour-indexed (AniList overlay) and meaningless for a film. Mirrors refuseCoursOnFilm() in media.schema.ts.';



CREATE TABLE IF NOT EXISTS "watching"."media_list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "media_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "note" "text",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "watching"."media_list_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."media_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_ranked" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "watching"."media_lists" OWNER TO "postgres";


COMMENT ON COLUMN "watching"."media_lists"."deleted_at" IS 'Soft delete. Non-null = deleted; the row and its media_list_items are kept so the action can be undone. Every read filters on deleted_at is null.';



CREATE TABLE IF NOT EXISTS "watching"."rewatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_item_id" "uuid" NOT NULL,
    "watched_on" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "watching"."rewatches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."theme_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "track_key" "text" NOT NULL,
    "anime_name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "title" "text" NOT NULL,
    "artist" "text" DEFAULT ''::"text" NOT NULL,
    "audio_url" "text",
    "video_url" "text",
    "cover" "text",
    "media_tmdb_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "anime_poster" "text"
);


ALTER TABLE "watching"."theme_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "watching"."trending_cache" (
    "type" "text" NOT NULL,
    "items" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "refreshed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trending_cache_type_check" CHECK (("type" = ANY (ARRAY['film'::"text", 'serie'::"text", 'anime'::"text"])))
);


ALTER TABLE "watching"."trending_cache" OWNER TO "postgres";


ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_quotes"
    ADD CONSTRAINT "book_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_reading_log"
    ADD CONSTRAINT "book_reading_log_book_id_date_key" UNIQUE ("book_id", "date");



ALTER TABLE ONLY "public"."book_reading_log"
    ADD CONSTRAINT "book_reading_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_user_settings"
    ADD CONSTRAINT "book_user_settings_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_milestones"
    ADD CONSTRAINT "goal_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_progress_history"
    ADD CONSTRAINT "goal_progress_history_goal_id_recorded_on_key" UNIQUE ("goal_id", "recorded_on");



ALTER TABLE ONLY "public"."goal_progress_history"
    ADD CONSTRAINT "goal_progress_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_reviews"
    ADD CONSTRAINT "goal_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habit_completions"
    ADD CONSTRAINT "habit_completions_habit_id_completed_date_key" UNIQUE ("habit_id", "completed_date");



ALTER TABLE ONLY "public"."habit_completions"
    ADD CONSTRAINT "habit_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habit_freezes"
    ADD CONSTRAINT "habit_freezes_habit_id_freeze_date_key" UNIQUE ("habit_id", "freeze_date");



ALTER TABLE ONLY "public"."habit_freezes"
    ADD CONSTRAINT "habit_freezes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habit_pauses"
    ADD CONSTRAINT "habit_pauses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habit_skips"
    ADD CONSTRAINT "habit_skips_habit_id_skip_date_key" UNIQUE ("habit_id", "skip_date");



ALTER TABLE ONLY "public"."habit_skips"
    ADD CONSTRAINT "habit_skips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habits"
    ADD CONSTRAINT "habits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_user_id_entry_date_key" UNIQUE ("user_id", "entry_date");



ALTER TABLE ONLY "public"."journal_events"
    ADD CONSTRAINT "journal_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_org_id_user_id_key" UNIQUE ("org_id", "user_id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_workspace_id_name_key" UNIQUE ("workspace_id", "name");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("task_id", "depends_on_task_id");



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_pkey" PRIMARY KEY ("task_id", "tag_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_standings"
    ADD CONSTRAINT "competition_team" UNIQUE ("competition_id", "team_id");



ALTER TABLE ONLY "sport"."f1_circuits"
    ADD CONSTRAINT "f1_circuits_jolpica_circuit_id_key" UNIQUE ("jolpica_circuit_id");



ALTER TABLE ONLY "sport"."f1_circuits"
    ADD CONSTRAINT "f1_circuits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_constructor_standings"
    ADD CONSTRAINT "f1_constructor_standings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_constructor_standings"
    ADD CONSTRAINT "f1_constructor_standings_season_team_id_key" UNIQUE ("season", "team_id");



ALTER TABLE ONLY "sport"."f1_driver_standings"
    ADD CONSTRAINT "f1_driver_standings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_driver_standings"
    ADD CONSTRAINT "f1_driver_standings_season_driver_id_key" UNIQUE ("season", "driver_id");



ALTER TABLE ONLY "sport"."f1_driver_standings"
    ADD CONSTRAINT "f1_driver_standings_season_driver_unique" UNIQUE ("season", "driver_id");



ALTER TABLE ONLY "sport"."f1_drivers"
    ADD CONSTRAINT "f1_drivers_jolpica_driver_id_key" UNIQUE ("jolpica_driver_id");



ALTER TABLE ONLY "sport"."f1_drivers"
    ADD CONSTRAINT "f1_drivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_qualification_results"
    ADD CONSTRAINT "f1_qualification_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_qualification_results"
    ADD CONSTRAINT "f1_qualification_results_race_id_driver_id_key" UNIQUE ("race_id", "driver_id");



ALTER TABLE ONLY "sport"."f1_races"
    ADD CONSTRAINT "f1_races_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_races"
    ADD CONSTRAINT "f1_races_season_round_key" UNIQUE ("season", "round");



ALTER TABLE ONLY "sport"."f1_results"
    ADD CONSTRAINT "f1_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."f1_results"
    ADD CONSTRAINT "f1_results_race_id_driver_id_key" UNIQUE ("race_id", "driver_id");



ALTER TABLE ONLY "sport"."f1_teams"
    ADD CONSTRAINT "f1_teams_jolpica_constructor_id_key" UNIQUE ("jolpica_constructor_id");



ALTER TABLE ONLY "sport"."f1_teams"
    ADD CONSTRAINT "f1_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_best_xi"
    ADD CONSTRAINT "football_best_xi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_best_xi_players"
    ADD CONSTRAINT "football_best_xi_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_competition_winners"
    ADD CONSTRAINT "football_competition_winners_comp_season_uk" UNIQUE ("competition_id", "season_wikidata_id");



ALTER TABLE ONLY "sport"."football_competition_winners"
    ADD CONSTRAINT "football_competition_winners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_competitions"
    ADD CONSTRAINT "football_competitions_api_external_id_key" UNIQUE ("api_external_id");



ALTER TABLE ONLY "sport"."football_competitions"
    ADD CONSTRAINT "football_competitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_legends"
    ADD CONSTRAINT "football_legends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_matches"
    ADD CONSTRAINT "football_matches_external_match_id_key" UNIQUE ("external_match_id");



ALTER TABLE ONLY "sport"."football_matches"
    ADD CONSTRAINT "football_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_predictions"
    ADD CONSTRAINT "football_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_predictions"
    ADD CONSTRAINT "football_predictions_user_id_external_match_id_key" UNIQUE ("user_id", "external_match_id");



ALTER TABLE ONLY "sport"."football_standings"
    ADD CONSTRAINT "football_standings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_team_competitions"
    ADD CONSTRAINT "football_team_competitions_pkey" PRIMARY KEY ("team_id", "competition_id");



ALTER TABLE ONLY "sport"."football_team_honours"
    ADD CONSTRAINT "football_team_honours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_team_honours"
    ADD CONSTRAINT "football_team_honours_team_id_competition_qid_key" UNIQUE ("team_id", "competition_qid");



ALTER TABLE ONLY "sport"."football_teams"
    ADD CONSTRAINT "football_teams_api_external_id_key" UNIQUE ("api_external_id");



ALTER TABLE ONLY "sport"."football_teams"
    ADD CONSTRAINT "football_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_user_competitions"
    ADD CONSTRAINT "football_user_competitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_user_competitions"
    ADD CONSTRAINT "football_user_competitions_user_id_competition_id_key" UNIQUE ("user_id", "competition_id");



ALTER TABLE ONLY "sport"."football_user_settings"
    ADD CONSTRAINT "football_user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_user_settings"
    ADD CONSTRAINT "football_user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "sport"."football_watched_matches"
    ADD CONSTRAINT "football_watched_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."football_watched_matches"
    ADD CONSTRAINT "football_watched_matches_user_id_external_match_id_key" UNIQUE ("user_id", "external_match_id");



ALTER TABLE ONLY "sport"."tennis_matches"
    ADD CONSTRAINT "tennis_matches_atp_match_id_player_id_key" UNIQUE ("atp_match_id", "player_id");



ALTER TABLE ONLY "sport"."tennis_matches"
    ADD CONSTRAINT "tennis_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."tennis_matches"
    ADD CONSTRAINT "tennis_matches_player_id_opponent_name_match_date_tournamen_key" UNIQUE ("player_id", "opponent_name", "match_date", "tournament_id");



ALTER TABLE ONLY "sport"."tennis_players_cache"
    ADD CONSTRAINT "tennis_players_cache_name_key" UNIQUE ("name");



ALTER TABLE ONLY "sport"."tennis_players_cache"
    ADD CONSTRAINT "tennis_players_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."tennis_players_cache"
    ADD CONSTRAINT "tennis_players_cache_thesportsdb_id_key" UNIQUE ("thesportsdb_id");



ALTER TABLE ONLY "sport"."tennis_players"
    ADD CONSTRAINT "tennis_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."tennis_players"
    ADD CONSTRAINT "tennis_players_tennis_explorer_slug_key" UNIQUE ("tennis_explorer_slug");



ALTER TABLE ONLY "sport"."tennis_players"
    ADD CONSTRAINT "tennis_players_thesportsdb_id_key" UNIQUE ("thesportsdb_id");



ALTER TABLE ONLY "sport"."tennis_rankings"
    ADD CONSTRAINT "tennis_rankings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."tennis_rankings"
    ADD CONSTRAINT "tennis_rankings_player_id_key" UNIQUE ("player_id");



ALTER TABLE ONLY "sport"."tennis_tournaments"
    ADD CONSTRAINT "tennis_tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."tennis_tournaments"
    ADD CONSTRAINT "tennis_tournaments_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "sport"."tennis_tournaments"
    ADD CONSTRAINT "tennis_tournaments_tournament_code_key" UNIQUE ("tournament_code");



ALTER TABLE ONLY "sport"."user_favorites"
    ADD CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sport"."user_favorites"
    ADD CONSTRAINT "user_favorites_user_id_entity_type_entity_id_key" UNIQUE ("user_id", "entity_type", "entity_id");



ALTER TABLE ONLY "watching"."anime_cours"
    ADD CONSTRAINT "anime_cours_pkey" PRIMARY KEY ("tmdb_id");



ALTER TABLE ONLY "watching"."episode_highlights"
    ADD CONSTRAINT "episode_highlights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "watching"."episode_highlights"
    ADD CONSTRAINT "episode_highlights_user_id_media_item_id_season_episode_key" UNIQUE ("user_id", "media_item_id", "season", "episode");



ALTER TABLE ONLY "watching"."for_you_cache"
    ADD CONSTRAINT "for_you_cache_pkey" PRIMARY KEY ("user_id", "type");



ALTER TABLE ONLY "watching"."media_items"
    ADD CONSTRAINT "media_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "watching"."media_items"
    ADD CONSTRAINT "media_items_unique_user_tmdb" UNIQUE ("user_id", "tmdb_id", "type");



ALTER TABLE ONLY "watching"."media_list_items"
    ADD CONSTRAINT "media_list_items_list_id_media_item_id_key" UNIQUE ("list_id", "media_item_id");



ALTER TABLE ONLY "watching"."media_list_items"
    ADD CONSTRAINT "media_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "watching"."media_lists"
    ADD CONSTRAINT "media_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "watching"."rewatches"
    ADD CONSTRAINT "rewatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "watching"."theme_favorites"
    ADD CONSTRAINT "theme_favorites_org_id_track_key_key" UNIQUE ("org_id", "track_key");



ALTER TABLE ONLY "watching"."theme_favorites"
    ADD CONSTRAINT "theme_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "watching"."trending_cache"
    ADD CONSTRAINT "trending_cache_pkey" PRIMARY KEY ("type");



CREATE INDEX "idx_activity_log_created_at" ON "public"."task_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_org_id" ON "public"."task_activities" USING "btree" ("org_id");



CREATE INDEX "idx_activity_log_task_id" ON "public"."task_activities" USING "btree" ("task_id");



CREATE INDEX "idx_attachments_org_id" ON "public"."attachments" USING "btree" ("org_id");



CREATE INDEX "idx_attachments_task_id" ON "public"."attachments" USING "btree" ("task_id");



CREATE INDEX "idx_book_quotes_book_id" ON "public"."book_quotes" USING "btree" ("book_id", "position");



CREATE INDEX "idx_book_quotes_favorite" ON "public"."book_quotes" USING "btree" ("org_id") WHERE ("favorite" = true);



CREATE INDEX "idx_book_quotes_org_id" ON "public"."book_quotes" USING "btree" ("org_id");



CREATE INDEX "idx_book_reading_log_book" ON "public"."book_reading_log" USING "btree" ("book_id");



CREATE INDEX "idx_book_reading_log_org_date" ON "public"."book_reading_log" USING "btree" ("org_id", "date");



CREATE INDEX "idx_books_created_at" ON "public"."books" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_books_finished_at" ON "public"."books" USING "btree" ("finished_at" DESC NULLS LAST);



CREATE INDEX "idx_books_org_id" ON "public"."books" USING "btree" ("org_id");



CREATE INDEX "idx_books_status" ON "public"."books" USING "btree" ("status");



CREATE INDEX "idx_books_user_id" ON "public"."books" USING "btree" ("user_id");



CREATE INDEX "idx_comments_org_id" ON "public"."comments" USING "btree" ("org_id");



CREATE INDEX "idx_comments_task_id" ON "public"."comments" USING "btree" ("task_id");



CREATE INDEX "idx_goal_milestones_goal_id" ON "public"."goal_milestones" USING "btree" ("goal_id");



CREATE INDEX "idx_goal_progress_history_goal" ON "public"."goal_progress_history" USING "btree" ("goal_id", "recorded_on");



CREATE INDEX "idx_goal_reviews_org_created" ON "public"."goal_reviews" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_goals_org_id" ON "public"."goals" USING "btree" ("org_id");



CREATE INDEX "idx_goals_parent_goal_id" ON "public"."goals" USING "btree" ("parent_goal_id");



CREATE INDEX "idx_goals_status" ON "public"."goals" USING "btree" ("status");



CREATE INDEX "idx_goals_target_date" ON "public"."goals" USING "btree" ("target_date");



CREATE INDEX "idx_goals_user_id" ON "public"."goals" USING "btree" ("user_id");



CREATE INDEX "idx_habit_completions_date" ON "public"."habit_completions" USING "btree" ("completed_date");



CREATE INDEX "idx_habit_completions_habit_id" ON "public"."habit_completions" USING "btree" ("habit_id");



CREATE INDEX "idx_habit_freezes_date" ON "public"."habit_freezes" USING "btree" ("freeze_date");



CREATE INDEX "idx_habit_freezes_habit_id" ON "public"."habit_freezes" USING "btree" ("habit_id");



CREATE INDEX "idx_habit_pauses_habit_id" ON "public"."habit_pauses" USING "btree" ("habit_id");



CREATE INDEX "idx_habit_skips_date" ON "public"."habit_skips" USING "btree" ("skip_date");



CREATE INDEX "idx_habit_skips_habit_id" ON "public"."habit_skips" USING "btree" ("habit_id");



CREATE INDEX "idx_habits_archived" ON "public"."habits" USING "btree" ("archived");



CREATE INDEX "idx_habits_org_id" ON "public"."habits" USING "btree" ("org_id");



CREATE INDEX "idx_habits_user_id" ON "public"."habits" USING "btree" ("user_id");



CREATE INDEX "idx_journal_entries_entry_date" ON "public"."journal_entries" USING "btree" ("entry_date" DESC);



CREATE INDEX "idx_journal_entries_mood" ON "public"."journal_entries" USING "btree" ("mood");



CREATE INDEX "idx_journal_entries_org_id" ON "public"."journal_entries" USING "btree" ("org_id");



CREATE INDEX "idx_journal_entries_user_id" ON "public"."journal_entries" USING "btree" ("user_id");



CREATE INDEX "idx_memberships_org_id" ON "public"."memberships" USING "btree" ("org_id");



CREATE INDEX "idx_memberships_user_id" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "idx_org_invitations_org_id" ON "public"."org_invitations" USING "btree" ("org_id");



CREATE INDEX "idx_org_invitations_token" ON "public"."org_invitations" USING "btree" ("token");



CREATE INDEX "idx_org_invitations_workspace_id" ON "public"."org_invitations" USING "btree" ("workspace_id");



CREATE INDEX "idx_projects_org_id" ON "public"."projects" USING "btree" ("org_id");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_projects_workspace_id" ON "public"."projects" USING "btree" ("workspace_id");



CREATE INDEX "idx_statuses_org_id" ON "public"."statuses" USING "btree" ("org_id");



CREATE INDEX "idx_statuses_project_id" ON "public"."statuses" USING "btree" ("project_id");



CREATE INDEX "idx_tags_org_id" ON "public"."tags" USING "btree" ("org_id");



CREATE INDEX "idx_task_dependencies_org_id" ON "public"."task_dependencies" USING "btree" ("org_id");



CREATE INDEX "idx_task_tags_org_id" ON "public"."task_tags" USING "btree" ("org_id");



CREATE INDEX "idx_task_tags_tag_id" ON "public"."task_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_task_tags_task_id" ON "public"."task_tags" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_active" ON "public"."tasks" USING "btree" ("project_id", "status_id", "position") WHERE ("is_archived" = false);



CREATE INDEX "idx_tasks_assignee_id" ON "public"."tasks" USING "btree" ("assignee_id");



CREATE INDEX "idx_tasks_created_at" ON "public"."tasks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date") WHERE ("due_date" IS NOT NULL);



CREATE INDEX "idx_tasks_goal_id" ON "public"."tasks" USING "btree" ("goal_id");



CREATE INDEX "idx_tasks_org_id" ON "public"."tasks" USING "btree" ("org_id");



CREATE INDEX "idx_tasks_parent_task_id" ON "public"."tasks" USING "btree" ("parent_task_id") WHERE ("parent_task_id" IS NOT NULL);



CREATE INDEX "idx_tasks_priority" ON "public"."tasks" USING "btree" ("priority");



CREATE INDEX "idx_tasks_priority_rank" ON "public"."tasks" USING "btree" ("priority_rank");



CREATE INDEX "idx_tasks_project_id" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "idx_tasks_status_id" ON "public"."tasks" USING "btree" ("status_id");



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_workspace_id" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspaces_org_id" ON "public"."workspaces" USING "btree" ("org_id");



CREATE INDEX "idx_workspaces_user_id" ON "public"."workspaces" USING "btree" ("user_id");



CREATE INDEX "journal_events_org_date_idx" ON "public"."journal_events" USING "btree" ("org_id", "event_date");



CREATE INDEX "tags_workspace_id_idx" ON "public"."tags" USING "btree" ("workspace_id");



CREATE INDEX "task_activities_created_at_idx" ON "public"."task_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "task_activities_org_id_idx" ON "public"."task_activities" USING "btree" ("org_id");



CREATE INDEX "task_activities_task_id_idx" ON "public"."task_activities" USING "btree" ("task_id");



CREATE INDEX "football_competition_winners_comp_idx" ON "sport"."football_competition_winners" USING "btree" ("competition_id");



CREATE INDEX "football_matches_away_ext_idx" ON "sport"."football_matches" USING "btree" ("away_team_external_id");



CREATE INDEX "football_matches_comp_date_idx" ON "sport"."football_matches" USING "btree" ("competition_id", "utc_date");



CREATE INDEX "football_matches_comp_stage_idx" ON "sport"."football_matches" USING "btree" ("competition_id", "season", "stage");



CREATE INDEX "football_matches_home_ext_idx" ON "sport"."football_matches" USING "btree" ("home_team_external_id");



CREATE INDEX "football_matches_status_idx" ON "sport"."football_matches" USING "btree" ("status");



CREATE INDEX "football_predictions_user_idx" ON "sport"."football_predictions" USING "btree" ("user_id");



CREATE INDEX "football_team_honours_team_idx" ON "sport"."football_team_honours" USING "btree" ("team_id");



CREATE INDEX "football_user_competitions_user_idx" ON "sport"."football_user_competitions" USING "btree" ("user_id");



CREATE INDEX "football_watched_matches_user_idx" ON "sport"."football_watched_matches" USING "btree" ("user_id");



CREATE INDEX "idx_f1_circuits_jolpica" ON "sport"."f1_circuits" USING "btree" ("jolpica_circuit_id");



CREATE INDEX "idx_f1_constructor_standings_position" ON "sport"."f1_constructor_standings" USING "btree" ("position");



CREATE INDEX "idx_f1_constructor_standings_season" ON "sport"."f1_constructor_standings" USING "btree" ("season");



CREATE INDEX "idx_f1_driver_standings_position" ON "sport"."f1_driver_standings" USING "btree" ("position");



CREATE INDEX "idx_f1_driver_standings_season" ON "sport"."f1_driver_standings" USING "btree" ("season");



CREATE INDEX "idx_f1_drivers_jolpica" ON "sport"."f1_drivers" USING "btree" ("jolpica_driver_id");



CREATE INDEX "idx_f1_drivers_openf1" ON "sport"."f1_drivers" USING "btree" ("openf1_driver_number");



CREATE INDEX "idx_f1_drivers_team" ON "sport"."f1_drivers" USING "btree" ("current_team_id");



CREATE INDEX "idx_f1_quali_driver" ON "sport"."f1_qualification_results" USING "btree" ("driver_id");



CREATE INDEX "idx_f1_quali_position" ON "sport"."f1_qualification_results" USING "btree" ("grid_position");



CREATE INDEX "idx_f1_quali_race" ON "sport"."f1_qualification_results" USING "btree" ("race_id");



CREATE INDEX "idx_f1_races_circuit" ON "sport"."f1_races" USING "btree" ("circuit_id");



CREATE INDEX "idx_f1_races_date" ON "sport"."f1_races" USING "btree" ("race_date");



CREATE INDEX "idx_f1_races_season" ON "sport"."f1_races" USING "btree" ("season");



CREATE INDEX "idx_f1_races_status" ON "sport"."f1_races" USING "btree" ("status");



CREATE INDEX "idx_f1_results_driver" ON "sport"."f1_results" USING "btree" ("driver_id");



CREATE INDEX "idx_f1_results_points" ON "sport"."f1_results" USING "btree" ("points");



CREATE INDEX "idx_f1_results_position" ON "sport"."f1_results" USING "btree" ("position");



CREATE INDEX "idx_f1_results_race" ON "sport"."f1_results" USING "btree" ("race_id");



CREATE INDEX "idx_f1_teams_jolpica" ON "sport"."f1_teams" USING "btree" ("jolpica_constructor_id");



CREATE INDEX "idx_f1_teams_openf1" ON "sport"."f1_teams" USING "btree" ("openf1_constructor_id");



CREATE INDEX "idx_football_best_xi_org_id" ON "sport"."football_best_xi" USING "btree" ("org_id");



CREATE INDEX "idx_football_best_xi_players_org_id" ON "sport"."football_best_xi_players" USING "btree" ("org_id");



CREATE INDEX "idx_football_legends_org_id" ON "sport"."football_legends" USING "btree" ("org_id");



CREATE INDEX "idx_football_standings_competition_id" ON "sport"."football_standings" USING "btree" ("competition_id");



CREATE INDEX "idx_football_standings_team_id" ON "sport"."football_standings" USING "btree" ("team_id");



CREATE INDEX "idx_football_user_settings_org_id" ON "sport"."football_user_settings" USING "btree" ("org_id");



CREATE INDEX "idx_tennis_matches_date" ON "sport"."tennis_matches" USING "btree" ("match_date" DESC);



CREATE INDEX "idx_tennis_matches_opponent_cache" ON "sport"."tennis_matches" USING "btree" ("opponent_cache_id");



CREATE INDEX "idx_tennis_matches_player_id" ON "sport"."tennis_matches" USING "btree" ("player_id");



CREATE INDEX "idx_tennis_matches_player_status" ON "sport"."tennis_matches" USING "btree" ("player_id", "status");



CREATE INDEX "idx_tennis_matches_status" ON "sport"."tennis_matches" USING "btree" ("status");



CREATE INDEX "idx_tennis_matches_tournament" ON "sport"."tennis_matches" USING "btree" ("tournament_id");



CREATE INDEX "idx_tennis_players_cache_name" ON "sport"."tennis_players_cache" USING "btree" ("name");



CREATE INDEX "idx_tennis_players_name" ON "sport"."tennis_players" USING "btree" ("name");



CREATE INDEX "idx_tennis_players_thesportsdb_id" ON "sport"."tennis_players" USING "btree" ("thesportsdb_id");



CREATE INDEX "idx_tennis_rankings_player_id" ON "sport"."tennis_rankings" USING "btree" ("player_id");



CREATE INDEX "idx_tennis_rankings_rank" ON "sport"."tennis_rankings" USING "btree" ("rank");



CREATE INDEX "idx_tennis_tournaments_level" ON "sport"."tennis_tournaments" USING "btree" ("level");



CREATE INDEX "idx_tennis_tournaments_slug" ON "sport"."tennis_tournaments" USING "btree" ("slug");



CREATE INDEX "idx_tennis_tournaments_start_date" ON "sport"."tennis_tournaments" USING "btree" ("start_date");



CREATE INDEX "idx_tennis_tournaments_surface" ON "sport"."tennis_tournaments" USING "btree" ("surface");



CREATE INDEX "idx_user_favorites_org_id" ON "sport"."user_favorites" USING "btree" ("org_id");



CREATE INDEX "idx_user_favorites_user_id" ON "sport"."user_favorites" USING "btree" ("user_id");



CREATE INDEX "episode_highlights_media_item_id_idx" ON "watching"."episode_highlights" USING "btree" ("media_item_id");



CREATE INDEX "idx_media_items_in_progress" ON "watching"."media_items" USING "btree" ("user_id", "type", "watched", "current_episode");



CREATE INDEX "idx_media_items_org_id" ON "watching"."media_items" USING "btree" ("org_id");



CREATE INDEX "idx_media_type" ON "watching"."media_items" USING "btree" ("type");



CREATE INDEX "idx_media_user_id" ON "watching"."media_items" USING "btree" ("user_id");



CREATE INDEX "idx_media_watched_at" ON "watching"."media_items" USING "btree" ("watched_at" DESC);



CREATE INDEX "idx_rewatches_media" ON "watching"."rewatches" USING "btree" ("media_item_id", "watched_on" DESC);



CREATE INDEX "idx_theme_favorites_org" ON "watching"."theme_favorites" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "media_items_sync_idx" ON "watching"."media_items" USING "btree" ("last_synced_at" NULLS FIRST) WHERE (("type" <> 'film'::"text") AND (("status" IS NULL) OR (("status")::"text" <> ALL ((ARRAY['ended'::character varying, 'canceled'::character varying, 'cancelled'::character varying])::"text"[]))));



CREATE INDEX "media_lists_live_idx" ON "watching"."media_lists" USING "btree" ("user_id", "created_at") WHERE ("deleted_at" IS NULL);



CREATE OR REPLACE TRIGGER "book_quotes_updated_at" BEFORE UPDATE ON "public"."book_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "book_user_settings_updated_at" BEFORE UPDATE ON "public"."book_user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "books_updated_at" BEFORE UPDATE ON "public"."books" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "goals_updated_at" BEFORE UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "habits_updated_at" BEFORE UPDATE ON "public"."habits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "journal_events_updated_at" BEFORE UPDATE ON "public"."journal_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "projects_set_position" BEFORE INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_project_position"();



CREATE OR REPLACE TRIGGER "tags_set_org_id" BEFORE INSERT ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_tag_org_id"();



CREATE OR REPLACE TRIGGER "tasks_set_position" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_position"();



CREATE OR REPLACE TRIGGER "trg_check_task_status_same_project" BEFORE INSERT OR UPDATE OF "status_id", "project_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."check_task_status_same_project"();



CREATE OR REPLACE TRIGGER "trg_set_project_org_id" BEFORE INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_project_org_id"();



CREATE OR REPLACE TRIGGER "trg_set_status_org_id" BEFORE INSERT ON "public"."statuses" FOR EACH ROW EXECUTE FUNCTION "public"."set_status_org_id"();



CREATE OR REPLACE TRIGGER "trg_set_task_org_id" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_org_id"();



CREATE OR REPLACE TRIGGER "trg_set_task_tag_org_id" BEFORE INSERT ON "public"."task_tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_tag_org_id"();



CREATE OR REPLACE TRIGGER "trg_snapshot_goal_progress" AFTER INSERT OR UPDATE OF "progress" ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."snapshot_goal_progress"();



CREATE OR REPLACE TRIGGER "trg_sync_status_is_completed" BEFORE INSERT OR UPDATE OF "type" ON "public"."statuses" FOR EACH ROW EXECUTE FUNCTION "public"."sync_status_is_completed"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workspaces_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_football_competitions" BEFORE UPDATE ON "sport"."football_competitions" FOR EACH ROW EXECUTE FUNCTION "sport"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_football_teams" BEFORE UPDATE ON "sport"."football_teams" FOR EACH ROW EXECUTE FUNCTION "sport"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_football_user_settings" BEFORE UPDATE ON "sport"."football_user_settings" FOR EACH ROW EXECUTE FUNCTION "sport"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_football_standings_updated_at" BEFORE UPDATE ON "sport"."football_standings" FOR EACH ROW EXECUTE FUNCTION "sport"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tennis_matches_updated_at" BEFORE UPDATE ON "sport"."tennis_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tennis_players_cache_updated_at" BEFORE UPDATE ON "sport"."tennis_players_cache" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tennis_players_updated_at" BEFORE UPDATE ON "sport"."tennis_players" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tennis_tournaments_updated_at" BEFORE UPDATE ON "sport"."tennis_tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_touch_note_updated_at" BEFORE UPDATE ON "watching"."media_items" FOR EACH ROW EXECUTE FUNCTION "watching"."touch_note_updated_at"();



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "activity_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "activity_log_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_quotes"
    ADD CONSTRAINT "book_quotes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_quotes"
    ADD CONSTRAINT "book_quotes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_quotes"
    ADD CONSTRAINT "book_quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_reading_log"
    ADD CONSTRAINT "book_reading_log_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_reading_log"
    ADD CONSTRAINT "book_reading_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_reading_log"
    ADD CONSTRAINT "book_reading_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_user_settings"
    ADD CONSTRAINT "book_user_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_milestones"
    ADD CONSTRAINT "goal_milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_history"
    ADD CONSTRAINT "goal_progress_history_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_history"
    ADD CONSTRAINT "goal_progress_history_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_reviews"
    ADD CONSTRAINT "goal_reviews_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_reviews"
    ADD CONSTRAINT "goal_reviews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_reviews"
    ADD CONSTRAINT "goal_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habit_completions"
    ADD CONSTRAINT "habit_completions_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habit_freezes"
    ADD CONSTRAINT "habit_freezes_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habit_pauses"
    ADD CONSTRAINT "habit_pauses_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habit_skips"
    ADD CONSTRAINT "habit_skips_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habits"
    ADD CONSTRAINT "habits_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."habits"
    ADD CONSTRAINT "habits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habits"
    ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_events"
    ADD CONSTRAINT "journal_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_events"
    ADD CONSTRAINT "journal_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_circuits"
    ADD CONSTRAINT "f1_circuits_last_winner_driver_id_fkey" FOREIGN KEY ("last_winner_driver_id") REFERENCES "sport"."f1_drivers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sport"."f1_constructor_standings"
    ADD CONSTRAINT "f1_constructor_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."f1_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_driver_standings"
    ADD CONSTRAINT "f1_driver_standings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "sport"."f1_drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_driver_standings"
    ADD CONSTRAINT "f1_driver_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."f1_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sport"."f1_drivers"
    ADD CONSTRAINT "f1_drivers_current_team_id_fkey" FOREIGN KEY ("current_team_id") REFERENCES "sport"."f1_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sport"."f1_qualification_results"
    ADD CONSTRAINT "f1_qualification_results_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "sport"."f1_drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_qualification_results"
    ADD CONSTRAINT "f1_qualification_results_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "sport"."f1_races"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_qualification_results"
    ADD CONSTRAINT "f1_qualification_results_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."f1_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_races"
    ADD CONSTRAINT "f1_races_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "sport"."f1_circuits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_results"
    ADD CONSTRAINT "f1_results_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "sport"."f1_drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_results"
    ADD CONSTRAINT "f1_results_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "sport"."f1_races"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."f1_results"
    ADD CONSTRAINT "f1_results_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."f1_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_best_xi"
    ADD CONSTRAINT "football_best_xi_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_best_xi_players"
    ADD CONSTRAINT "football_best_xi_players_best_xi_id_fkey" FOREIGN KEY ("best_xi_id") REFERENCES "sport"."football_best_xi"("id");



ALTER TABLE ONLY "sport"."football_best_xi_players"
    ADD CONSTRAINT "football_best_xi_players_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_best_xi"
    ADD CONSTRAINT "football_best_xi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sport"."football_competition_winners"
    ADD CONSTRAINT "football_competition_winners_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "sport"."football_competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_legends"
    ADD CONSTRAINT "football_legends_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_legends"
    ADD CONSTRAINT "football_legends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_matches"
    ADD CONSTRAINT "football_matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "sport"."football_teams"("id");



ALTER TABLE ONLY "sport"."football_matches"
    ADD CONSTRAINT "football_matches_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "sport"."football_competitions"("id");



ALTER TABLE ONLY "sport"."football_matches"
    ADD CONSTRAINT "football_matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "sport"."football_teams"("id");



ALTER TABLE ONLY "sport"."football_predictions"
    ADD CONSTRAINT "football_predictions_external_match_id_fkey" FOREIGN KEY ("external_match_id") REFERENCES "sport"."football_matches"("external_match_id");



ALTER TABLE ONLY "sport"."football_predictions"
    ADD CONSTRAINT "football_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_standings"
    ADD CONSTRAINT "football_standings_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "sport"."football_competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_standings"
    ADD CONSTRAINT "football_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."football_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_team_competitions"
    ADD CONSTRAINT "football_team_competitions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "sport"."football_competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_team_competitions"
    ADD CONSTRAINT "football_team_competitions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."football_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_team_honours"
    ADD CONSTRAINT "football_team_honours_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport"."football_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_user_competitions"
    ADD CONSTRAINT "football_user_competitions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "sport"."football_competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_user_competitions"
    ADD CONSTRAINT "football_user_competitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_user_settings"
    ADD CONSTRAINT "football_user_settings_main_team_id_fkey" FOREIGN KEY ("main_team_id") REFERENCES "sport"."football_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sport"."football_user_settings"
    ADD CONSTRAINT "football_user_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_user_settings"
    ADD CONSTRAINT "football_user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."football_watched_matches"
    ADD CONSTRAINT "football_watched_matches_external_match_id_fkey" FOREIGN KEY ("external_match_id") REFERENCES "sport"."football_matches"("external_match_id");



ALTER TABLE ONLY "sport"."football_watched_matches"
    ADD CONSTRAINT "football_watched_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."tennis_matches"
    ADD CONSTRAINT "tennis_matches_opponent_cache_id_fkey" FOREIGN KEY ("opponent_cache_id") REFERENCES "sport"."tennis_players_cache"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sport"."tennis_matches"
    ADD CONSTRAINT "tennis_matches_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "sport"."tennis_players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."tennis_matches"
    ADD CONSTRAINT "tennis_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "sport"."tennis_tournaments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sport"."tennis_rankings"
    ADD CONSTRAINT "tennis_rankings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "sport"."tennis_players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."user_favorites"
    ADD CONSTRAINT "user_favorites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sport"."user_favorites"
    ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."episode_highlights"
    ADD CONSTRAINT "episode_highlights_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "watching"."media_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."episode_highlights"
    ADD CONSTRAINT "episode_highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."for_you_cache"
    ADD CONSTRAINT "for_you_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."media_items"
    ADD CONSTRAINT "media_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."media_items"
    ADD CONSTRAINT "media_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."media_list_items"
    ADD CONSTRAINT "media_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "watching"."media_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."media_list_items"
    ADD CONSTRAINT "media_list_items_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "watching"."media_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."media_list_items"
    ADD CONSTRAINT "media_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "watching"."media_lists"
    ADD CONSTRAINT "media_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."rewatches"
    ADD CONSTRAINT "rewatches_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "watching"."media_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."rewatches"
    ADD CONSTRAINT "rewatches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."rewatches"
    ADD CONSTRAINT "rewatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."theme_favorites"
    ADD CONSTRAINT "theme_favorites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "watching"."theme_favorites"
    ADD CONSTRAINT "theme_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."book_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."book_reading_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."book_user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demo_readonly_delete" ON "public"."attachments" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."book_quotes" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."book_reading_log" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."book_user_settings" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."books" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."comments" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."goal_milestones" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."goal_progress_history" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."goal_reviews" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."goals" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."habit_completions" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."habit_freezes" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."habit_pauses" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."habit_skips" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."habits" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."journal_entries" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."journal_events" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."org_invitations" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."projects" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."statuses" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."tags" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."task_activities" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."task_dependencies" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."task_tags" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."tasks" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."workspace_members" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "public"."workspaces" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."attachments" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."book_quotes" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."book_reading_log" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."book_user_settings" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."books" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."comments" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."goal_milestones" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."goal_progress_history" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."goal_reviews" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."goals" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."habit_completions" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."habit_freezes" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."habit_pauses" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."habit_skips" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."habits" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."journal_entries" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."journal_events" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."org_invitations" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."projects" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."statuses" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."tags" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."task_activities" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."task_dependencies" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."task_tags" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."tasks" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."workspace_members" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "public"."workspaces" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."attachments" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."book_quotes" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."book_reading_log" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."book_user_settings" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."books" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."comments" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."goal_milestones" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."goal_progress_history" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."goal_reviews" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."goals" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."habit_completions" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."habit_freezes" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."habit_pauses" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."habit_skips" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."habits" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."journal_entries" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."journal_events" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."org_invitations" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."projects" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."statuses" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."tags" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."task_activities" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."task_dependencies" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."task_tags" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."tasks" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."workspace_members" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "public"."workspaces" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



ALTER TABLE "public"."goal_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_progress_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."habit_completions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."habit_freezes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."habit_pauses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."habit_skips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."habits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations: owner can manage" ON "public"."org_invitations" USING (("org_id" IN ( SELECT "memberships"."org_id"
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."role" = 'owner'::"text"))))) WITH CHECK (("org_id" IN ( SELECT "memberships"."org_id"
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."role" = 'owner'::"text")))));



CREATE POLICY "invitations: self or owner read" ON "public"."org_invitations" FOR SELECT USING ((("lower"("email") = "lower"(("auth"."jwt"() ->> 'email'::"text"))) OR ("org_id" IN ( SELECT "memberships"."org_id"
   FROM "public"."memberships"
  WHERE (("memberships"."user_id" = "auth"."uid"()) AND ("memberships"."role" = 'owner'::"text"))))));



CREATE POLICY "invited_user_read_own_invitation" ON "public"."org_invitations" FOR SELECT USING ((("auth"."jwt"() ->> 'email'::"text") = "email"));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships: self select" ON "public"."memberships" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."org_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_invitations_insert_owner_only" ON "public"."org_invitations" FOR INSERT WITH CHECK ((("workspace_id" IS NULL) OR ("workspace_id" IN ( SELECT "org_invitations"."id"
   FROM "public"."my_owned_workspace_ids"() "my_owned_workspace_ids"("my_owned_workspace_ids")))));



CREATE POLICY "org_isolation" ON "public"."attachments" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."book_quotes" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."book_reading_log" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."book_user_settings" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."books" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."comments" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."goal_milestones" USING (("goal_id" IN ( SELECT "goals"."id"
   FROM "public"."goals"
  WHERE ("goals"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs")))))) WITH CHECK (("goal_id" IN ( SELECT "goals"."id"
   FROM "public"."goals"
  WHERE ("goals"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs"))))));



CREATE POLICY "org_isolation" ON "public"."goal_progress_history" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."goal_reviews" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."goals" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."habit_completions" USING (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs")))))) WITH CHECK (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs"))))));



CREATE POLICY "org_isolation" ON "public"."habit_freezes" USING (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs")))))) WITH CHECK (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs"))))));



CREATE POLICY "org_isolation" ON "public"."habit_pauses" USING (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs")))))) WITH CHECK (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs"))))));



CREATE POLICY "org_isolation" ON "public"."habit_skips" USING (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs")))))) WITH CHECK (("habit_id" IN ( SELECT "habits"."id"
   FROM "public"."habits"
  WHERE ("habits"."org_id" IN ( SELECT "my_orgs"."my_orgs"
           FROM "public"."my_orgs"() "my_orgs"("my_orgs"))))));



CREATE POLICY "org_isolation" ON "public"."habits" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."journal_entries" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."journal_events" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."projects" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."statuses" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."tags" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."task_activities" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."task_dependencies" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."task_tags" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."tasks" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "public"."workspaces" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations: members can select" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "memberships"."org_id"
   FROM "public"."memberships"
  WHERE ("memberships"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_update_self_only" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_visible_to_org_or_workspace_mates" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("id" IN ( SELECT DISTINCT "m1"."user_id"
   FROM ("public"."memberships" "m1"
     JOIN "public"."memberships" "m2" ON (("m1"."org_id" = "m2"."org_id")))
  WHERE ("m2"."user_id" = "auth"."uid"()))) OR ("id" IN ( SELECT DISTINCT "wm"."user_id"
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
           FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids"))) OR ("wm"."workspace_id" IN ( SELECT "my_org_workspace_ids"."my_org_workspace_ids"
           FROM "public"."my_org_workspace_ids"() "my_org_workspace_ids"("my_org_workspace_ids")))))) OR ("id" IN ( SELECT DISTINCT "w"."user_id"
   FROM "public"."workspaces" "w"
  WHERE ("w"."id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
           FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids")))))));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_workspace_access" ON "public"."tags" USING ((("workspace_id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
   FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids"))) OR ("workspace_id" IN ( SELECT "my_org_workspace_ids"."my_org_workspace_ids"
   FROM "public"."my_org_workspace_ids"() "my_org_workspace_ids"("my_org_workspace_ids"))))) WITH CHECK ((("workspace_id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
   FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids"))) OR ("workspace_id" IN ( SELECT "my_org_workspace_ids"."my_org_workspace_ids"
   FROM "public"."my_org_workspace_ids"() "my_org_workspace_ids"("my_org_workspace_ids")))));



ALTER TABLE "public"."task_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_activities_insert" ON "public"."task_activities" FOR INSERT WITH CHECK ((("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "task_activities_select" ON "public"."task_activities" FOR SELECT USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_tags_workspace_access" ON "public"."task_tags" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
           FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids")))))) WITH CHECK (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
           FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids"))))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_settings_own" ON "public"."user_settings" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "workspace_member_access" ON "public"."task_activities" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
           FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids"))))));



CREATE POLICY "workspace_member_read" ON "public"."workspaces" FOR SELECT USING (("id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
   FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids"))));



CREATE POLICY "workspace_member_write" ON "public"."projects" USING (("workspace_id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
   FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids")))) WITH CHECK (("workspace_id" IN ( SELECT "my_workspace_ids"."my_workspace_ids"
   FROM "public"."my_workspace_ids"() "my_workspace_ids"("my_workspace_ids"))));



CREATE POLICY "workspace_member_write" ON "public"."statuses" USING (("project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
   FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids")))) WITH CHECK (("project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
   FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids"))));



CREATE POLICY "workspace_member_write" ON "public"."tasks" USING (("project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
   FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids")))) WITH CHECK (("project_id" IN ( SELECT "my_workspace_project_ids"."my_workspace_project_ids"
   FROM "public"."my_workspace_project_ids"() "my_workspace_project_ids"("my_workspace_project_ids"))));



ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_members_delete" ON "public"."workspace_members" FOR DELETE USING (("workspace_id" IN ( SELECT "my_owned_workspace_ids"."my_owned_workspace_ids"
   FROM "public"."my_owned_workspace_ids"() "my_owned_workspace_ids"("my_owned_workspace_ids"))));



CREATE POLICY "workspace_members_insert" ON "public"."workspace_members" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "my_owned_workspace_ids"."my_owned_workspace_ids"
   FROM "public"."my_owned_workspace_ids"() "my_owned_workspace_ids"("my_owned_workspace_ids"))));



CREATE POLICY "workspace_members_select" ON "public"."workspace_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("workspace_id" IN ( SELECT "my_org_workspace_ids"."my_org_workspace_ids"
   FROM "public"."my_org_workspace_ids"() "my_org_workspace_ids"("my_org_workspace_ids")))));



ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow public read" ON "sport"."football_team_competitions" FOR SELECT USING (true);



CREATE POLICY "Allow public read access on tennis_players" ON "sport"."tennis_players" FOR SELECT USING (true);



CREATE POLICY "Allow public read access on tennis_rankings" ON "sport"."tennis_rankings" FOR SELECT USING (true);



CREATE POLICY "Allow public read access on tennis_tournaments" ON "sport"."tennis_tournaments" FOR SELECT USING (true);



CREATE POLICY "Allow read competitions" ON "sport"."football_competitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read teams" ON "sport"."football_teams" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow service role full access" ON "sport"."football_team_competitions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service_role full access on tennis_players" ON "sport"."tennis_players" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service_role full access on tennis_rankings" ON "sport"."tennis_rankings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service_role full access on tennis_tournaments" ON "sport"."tennis_tournaments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Public read standings" ON "sport"."football_standings" FOR SELECT USING (true);



CREATE POLICY "Public read teams" ON "sport"."football_teams" FOR SELECT USING (true);



CREATE POLICY "Service insert competitions" ON "sport"."football_competitions" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role full access" ON "sport"."football_teams" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role select competitions" ON "sport"."football_competitions" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role update competitions" ON "sport"."football_competitions" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Service write standings" ON "sport"."football_standings" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "sport"."f1_circuits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_circuits_select_public" ON "sport"."f1_circuits" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_constructor_standings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_constructor_standings_select_public" ON "sport"."f1_constructor_standings" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_driver_standings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_driver_standings_select_public" ON "sport"."f1_driver_standings" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_drivers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_drivers_select_public" ON "sport"."f1_drivers" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_qualification_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_qualification_results_select_public" ON "sport"."f1_qualification_results" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_races" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_races_select_public" ON "sport"."f1_races" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_results_select_public" ON "sport"."f1_results" FOR SELECT USING (true);



ALTER TABLE "sport"."f1_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "f1_teams_select_public" ON "sport"."f1_teams" FOR SELECT USING (true);



ALTER TABLE "sport"."football_best_xi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_best_xi_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_competition_winners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "football_competition_winners_select" ON "sport"."football_competition_winners" FOR SELECT USING (true);



ALTER TABLE "sport"."football_competitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_legends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "football_matches_read" ON "sport"."football_matches" FOR SELECT USING (true);



ALTER TABLE "sport"."football_predictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_standings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_team_competitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_team_honours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "football_team_honours_select" ON "sport"."football_team_honours" FOR SELECT USING (true);



ALTER TABLE "sport"."football_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_user_competitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."football_watched_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fp_delete" ON "sport"."football_predictions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fp_insert" ON "sport"."football_predictions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "fp_select" ON "sport"."football_predictions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fp_update" ON "sport"."football_predictions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fuc_delete" ON "sport"."football_user_competitions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fuc_insert" ON "sport"."football_user_competitions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "fuc_select" ON "sport"."football_user_competitions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fwm_delete" ON "sport"."football_watched_matches" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fwm_insert" ON "sport"."football_watched_matches" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "fwm_select" ON "sport"."football_watched_matches" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "fwm_update" ON "sport"."football_watched_matches" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "org_isolation" ON "sport"."football_best_xi" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "sport"."football_best_xi_players" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "sport"."football_legends" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "sport"."football_user_settings" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "sport"."user_favorites" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



ALTER TABLE "sport"."tennis_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tennis_matches_delete_policy" ON "sport"."tennis_matches" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "tennis_matches_insert_policy" ON "sport"."tennis_matches" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "tennis_matches_select_policy" ON "sport"."tennis_matches" FOR SELECT USING (true);



CREATE POLICY "tennis_matches_update_policy" ON "sport"."tennis_matches" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "sport"."tennis_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."tennis_players_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tennis_players_cache_delete_policy" ON "sport"."tennis_players_cache" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "tennis_players_cache_insert_policy" ON "sport"."tennis_players_cache" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "tennis_players_cache_select_policy" ON "sport"."tennis_players_cache" FOR SELECT USING (true);



CREATE POLICY "tennis_players_cache_update_policy" ON "sport"."tennis_players_cache" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "sport"."tennis_rankings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."tennis_tournaments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sport"."user_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users read their own for-you cache" ON "watching"."for_you_cache" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "watching"."anime_cours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anime_cours_read" ON "watching"."anime_cours" FOR SELECT USING (true);



CREATE POLICY "demo_readonly_delete" ON "watching"."episode_highlights" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "watching"."media_items" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "watching"."media_list_items" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "watching"."media_lists" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "watching"."rewatches" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_delete" ON "watching"."theme_favorites" AS RESTRICTIVE FOR DELETE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "watching"."episode_highlights" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "watching"."media_items" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "watching"."media_list_items" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "watching"."media_lists" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "watching"."rewatches" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_insert" ON "watching"."theme_favorites" AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "watching"."episode_highlights" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "watching"."media_items" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "watching"."media_list_items" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "watching"."media_lists" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "watching"."rewatches" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



CREATE POLICY "demo_readonly_update" ON "watching"."theme_favorites" AS RESTRICTIVE FOR UPDATE USING ((NOT "public"."is_demo_user"()));



ALTER TABLE "watching"."episode_highlights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "watching"."for_you_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "watching"."media_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "watching"."media_list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "watching"."media_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_isolation" ON "watching"."episode_highlights" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "watching"."media_items" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "watching"."media_list_items" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "watching"."media_lists" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "watching"."rewatches" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



CREATE POLICY "org_isolation" ON "watching"."theme_favorites" USING (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs")))) WITH CHECK (("org_id" IN ( SELECT "my_orgs"."my_orgs"
   FROM "public"."my_orgs"() "my_orgs"("my_orgs"))));



ALTER TABLE "watching"."rewatches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "watching"."theme_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "watching"."trending_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trending_read" ON "watching"."trending_cache" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."goal_milestones";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."goals";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."habit_completions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."habits";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."org_invitations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."projects";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."statuses";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_activities";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_tags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workspace_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workspaces";






GRANT USAGE ON SCHEMA "internal" TO "supabase_auth_admin";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "sport" TO "service_role";
GRANT USAGE ON SCHEMA "sport" TO "anon";
GRANT USAGE ON SCHEMA "sport" TO "authenticated";



GRANT USAGE ON SCHEMA "watching" TO "anon";
GRANT USAGE ON SCHEMA "watching" TO "authenticated";
GRANT USAGE ON SCHEMA "watching" TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "internal"."call_edge"("fn" "text", "payload" "jsonb") FROM PUBLIC;



GRANT ALL ON FUNCTION "internal"."notify_new_signup"() TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_task_status_same_project"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_task_status_same_project"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_task_status_same_project"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_demo_visible_modules"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_demo_visible_modules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_demo_visible_modules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_demo_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_demo_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_demo_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_book_reading"("p_book_id" "uuid", "p_date" "date", "p_pages" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."log_book_reading"("p_book_id" "uuid", "p_date" "date", "p_pages" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_book_reading"("p_book_id" "uuid", "p_date" "date", "p_pages" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."my_org_workspace_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_org_workspace_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_org_workspace_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_orgs"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_orgs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_orgs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_owned_workspace_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_owned_workspace_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_owned_workspace_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_workspace_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_workspace_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_workspace_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_workspace_project_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_workspace_project_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_workspace_project_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_goal_progress"("p_goal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_goal_progress"("p_goal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_goal_progress"("p_goal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_books"("p_demo_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_books"("p_demo_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_books"("p_demo_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_goals"("p_demo_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_goals"("p_demo_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_goals"("p_demo_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_habits"("p_demo_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_habits"("p_demo_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_habits"("p_demo_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_journal"("p_demo_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_journal"("p_demo_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_journal"("p_demo_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_tasks"("p_demo_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_tasks"("p_demo_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_tasks"("p_demo_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_watching"("p_demo_email" "text", "p_source_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_watching"("p_demo_email" "text", "p_source_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_watching"("p_demo_email" "text", "p_source_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_demo_visible_modules"("p_visible" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_demo_visible_modules"("p_visible" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_demo_visible_modules"("p_visible" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_project_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_project_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_project_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_project_position"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_project_position"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_project_position"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_status_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_status_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_status_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tag_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tag_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tag_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_position"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_position"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_position"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_tag_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_tag_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_tag_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_goal_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_goal_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_goal_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_status_is_completed"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_status_is_completed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_status_is_completed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";












GRANT ALL ON FUNCTION "watching"."touch_note_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "watching"."touch_note_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "watching"."touch_note_updated_at"() TO "service_role";















GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."book_quotes" TO "anon";
GRANT ALL ON TABLE "public"."book_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."book_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."book_reading_log" TO "anon";
GRANT ALL ON TABLE "public"."book_reading_log" TO "authenticated";
GRANT ALL ON TABLE "public"."book_reading_log" TO "service_role";



GRANT ALL ON TABLE "public"."book_user_settings" TO "anon";
GRANT ALL ON TABLE "public"."book_user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."book_user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."books" TO "anon";
GRANT ALL ON TABLE "public"."books" TO "authenticated";
GRANT ALL ON TABLE "public"."books" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."goal_milestones" TO "anon";
GRANT ALL ON TABLE "public"."goal_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."goal_progress_history" TO "anon";
GRANT ALL ON TABLE "public"."goal_progress_history" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_progress_history" TO "service_role";



GRANT ALL ON TABLE "public"."goal_reviews" TO "anon";
GRANT ALL ON TABLE "public"."goal_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."habit_completions" TO "anon";
GRANT ALL ON TABLE "public"."habit_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."habit_completions" TO "service_role";



GRANT ALL ON TABLE "public"."habit_freezes" TO "anon";
GRANT ALL ON TABLE "public"."habit_freezes" TO "authenticated";
GRANT ALL ON TABLE "public"."habit_freezes" TO "service_role";



GRANT ALL ON TABLE "public"."habit_pauses" TO "anon";
GRANT ALL ON TABLE "public"."habit_pauses" TO "authenticated";
GRANT ALL ON TABLE "public"."habit_pauses" TO "service_role";



GRANT ALL ON TABLE "public"."habit_skips" TO "anon";
GRANT ALL ON TABLE "public"."habit_skips" TO "authenticated";
GRANT ALL ON TABLE "public"."habit_skips" TO "service_role";



GRANT ALL ON TABLE "public"."habits" TO "anon";
GRANT ALL ON TABLE "public"."habits" TO "authenticated";
GRANT ALL ON TABLE "public"."habits" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."journal_events" TO "anon";
GRANT ALL ON TABLE "public"."journal_events" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_events" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."org_invitations" TO "anon";
GRANT ALL ON TABLE "public"."org_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."statuses" TO "anon";
GRANT ALL ON TABLE "public"."statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."statuses" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."task_activities" TO "anon";
GRANT ALL ON TABLE "public"."task_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."task_activities" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."task_tags" TO "anon";
GRANT ALL ON TABLE "public"."task_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."task_tags" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_circuits" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_circuits" TO "anon";
GRANT ALL ON TABLE "sport"."f1_circuits" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_constructor_standings" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_constructor_standings" TO "anon";
GRANT ALL ON TABLE "sport"."f1_constructor_standings" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_driver_standings" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_driver_standings" TO "anon";
GRANT ALL ON TABLE "sport"."f1_driver_standings" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_drivers" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_drivers" TO "anon";
GRANT ALL ON TABLE "sport"."f1_drivers" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_qualification_results" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_qualification_results" TO "anon";
GRANT ALL ON TABLE "sport"."f1_qualification_results" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_races" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_races" TO "anon";
GRANT ALL ON TABLE "sport"."f1_races" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_results" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_results" TO "anon";
GRANT ALL ON TABLE "sport"."f1_results" TO "service_role";



GRANT SELECT ON TABLE "sport"."f1_teams" TO "authenticated";
GRANT SELECT ON TABLE "sport"."f1_teams" TO "anon";
GRANT ALL ON TABLE "sport"."f1_teams" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_best_xi" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_best_xi_players" TO "authenticated";



GRANT ALL ON TABLE "sport"."football_competition_winners" TO "service_role";
GRANT SELECT ON TABLE "sport"."football_competition_winners" TO "authenticated";



GRANT SELECT ON TABLE "sport"."football_competitions" TO "anon";
GRANT SELECT ON TABLE "sport"."football_competitions" TO "authenticated";
GRANT ALL ON TABLE "sport"."football_competitions" TO "service_role";



GRANT ALL ON TABLE "sport"."football_legends" TO "authenticated";



GRANT ALL ON TABLE "sport"."football_matches" TO "service_role";
GRANT SELECT ON TABLE "sport"."football_matches" TO "anon";
GRANT SELECT ON TABLE "sport"."football_matches" TO "authenticated";



GRANT ALL ON TABLE "sport"."football_predictions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_predictions" TO "authenticated";



GRANT SELECT ON TABLE "sport"."football_standings" TO "anon";
GRANT SELECT ON TABLE "sport"."football_standings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_standings" TO "service_role";



GRANT SELECT ON TABLE "sport"."football_team_competitions" TO "anon";
GRANT SELECT ON TABLE "sport"."football_team_competitions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_team_competitions" TO "service_role";



GRANT ALL ON TABLE "sport"."football_team_honours" TO "service_role";
GRANT SELECT ON TABLE "sport"."football_team_honours" TO "authenticated";



GRANT SELECT ON TABLE "sport"."football_teams" TO "anon";
GRANT SELECT ON TABLE "sport"."football_teams" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_teams" TO "service_role";



GRANT ALL ON TABLE "sport"."football_user_competitions" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "sport"."football_user_competitions" TO "authenticated";



GRANT SELECT ON TABLE "sport"."football_user_settings" TO "authenticated";
GRANT SELECT ON TABLE "sport"."football_user_settings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_user_settings" TO "service_role";



GRANT ALL ON TABLE "sport"."football_watched_matches" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."football_watched_matches" TO "authenticated";



GRANT SELECT ON TABLE "sport"."tennis_matches" TO "authenticated";
GRANT ALL ON TABLE "sport"."tennis_matches" TO "service_role";
GRANT SELECT ON TABLE "sport"."tennis_matches" TO "anon";



GRANT SELECT ON TABLE "sport"."tennis_players" TO "anon";
GRANT SELECT ON TABLE "sport"."tennis_players" TO "authenticated";
GRANT ALL ON TABLE "sport"."tennis_players" TO "service_role";



GRANT SELECT ON TABLE "sport"."tennis_players_cache" TO "authenticated";
GRANT ALL ON TABLE "sport"."tennis_players_cache" TO "service_role";
GRANT SELECT ON TABLE "sport"."tennis_players_cache" TO "anon";



GRANT SELECT ON TABLE "sport"."tennis_rankings" TO "anon";
GRANT SELECT ON TABLE "sport"."tennis_rankings" TO "authenticated";
GRANT ALL ON TABLE "sport"."tennis_rankings" TO "service_role";



GRANT SELECT ON TABLE "sport"."tennis_tournaments" TO "anon";
GRANT SELECT ON TABLE "sport"."tennis_tournaments" TO "authenticated";
GRANT ALL ON TABLE "sport"."tennis_tournaments" TO "service_role";



GRANT ALL ON TABLE "sport"."user_favorites" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "sport"."user_favorites" TO "service_role";









GRANT ALL ON TABLE "watching"."anime_cours" TO "anon";
GRANT ALL ON TABLE "watching"."anime_cours" TO "authenticated";
GRANT ALL ON TABLE "watching"."anime_cours" TO "service_role";



GRANT ALL ON TABLE "watching"."episode_highlights" TO "anon";
GRANT ALL ON TABLE "watching"."episode_highlights" TO "authenticated";
GRANT ALL ON TABLE "watching"."episode_highlights" TO "service_role";



GRANT ALL ON TABLE "watching"."for_you_cache" TO "anon";
GRANT ALL ON TABLE "watching"."for_you_cache" TO "authenticated";
GRANT ALL ON TABLE "watching"."for_you_cache" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "watching"."media_items" TO "anon";
GRANT ALL ON TABLE "watching"."media_items" TO "authenticated";
GRANT ALL ON TABLE "watching"."media_items" TO "service_role";



GRANT ALL ON TABLE "watching"."media_list_items" TO "anon";
GRANT ALL ON TABLE "watching"."media_list_items" TO "authenticated";
GRANT ALL ON TABLE "watching"."media_list_items" TO "service_role";



GRANT ALL ON TABLE "watching"."media_lists" TO "anon";
GRANT ALL ON TABLE "watching"."media_lists" TO "authenticated";
GRANT ALL ON TABLE "watching"."media_lists" TO "service_role";



GRANT ALL ON TABLE "watching"."rewatches" TO "anon";
GRANT ALL ON TABLE "watching"."rewatches" TO "authenticated";
GRANT ALL ON TABLE "watching"."rewatches" TO "service_role";



GRANT ALL ON TABLE "watching"."theme_favorites" TO "anon";
GRANT ALL ON TABLE "watching"."theme_favorites" TO "authenticated";
GRANT ALL ON TABLE "watching"."theme_favorites" TO "service_role";



GRANT ALL ON TABLE "watching"."trending_cache" TO "anon";
GRANT ALL ON TABLE "watching"."trending_cache" TO "authenticated";
GRANT ALL ON TABLE "watching"."trending_cache" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "watching" GRANT ALL ON TABLES TO "service_role";




























