-- Demo · Books — read-only policies + fictional library seed.
--
-- Part of the LinkedIn showcase. Uses REAL book metadata (titles, authors, Google
-- cover URLs, descriptions) so no Google Books API call is needed, but the
-- statuses are curated for a good demo: a shelf of finished+rated books, two in
-- progress, a few on the wishlist. Same demo user / own org as the other modules.
--
-- Run order (manual, from the Supabase SQL editor, after the demo account exists):
--   1. paste + run this whole file once  (creates policies + the seed function)
--   2. SELECT public.seed_demo_books('demo@example.com');   -- (re-runnable)
--
-- Revealing the module in the demo Dock is done from the owner "Demo & Sharing"
-- panel — NOT here.

-- ── 1. Read-only at the data layer ────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['books', 'book_quotes', 'book_reading_log', 'book_user_settings']
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

-- ── 2. Seed — a curated library + reading log + a few quotes ───────────────────
-- SECURITY DEFINER → bypasses the read-only policies. Idempotent: deleting the
-- demo's books cascades quotes + reading log.

CREATE OR REPLACE FUNCTION public.seed_demo_books(p_demo_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
