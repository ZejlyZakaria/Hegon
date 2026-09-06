-- Demo · Journal — read-only policies + fictional entries.
--
-- Part of the LinkedIn showcase. Same demo user / own org. The entries are written
-- in a natural, human first-person voice — a developer building HEGON while job
-- hunting. 100% INVENTED (the Journal is the most intimate module — never real
-- content). Moods + tags + a current streak + a few upcoming events.
--
-- Run order (manual, after the demo account + the journal migrations exist):
--   1. paste + run this whole file once  (policies + seed function)
--   2. SELECT public.seed_demo_journal('demo@example.com');
--
-- Reveal via the owner "Demo & Sharing" panel — not here.

-- ── 1. Read-only at the data layer ────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['journal_entries', 'journal_events']
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

-- ── 2. Seed — natural, human journal entries + a few events ────────────────────
CREATE OR REPLACE FUNCTION public.seed_demo_journal(p_demo_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
