-- Books — Reading Log
-- Migration: book_reading_log + log_book_reading() RPC + backfill.
--
-- WHY: the reading streak, the weekly activity dots, "pages this month" and the
-- Stats "pages read" were all reverse-engineered from a single books.updated_at
-- timestamp per book — which is impossible to do correctly (reading ONE book
-- across 3 days only ever yields 1 distinct date; any edit bumps updated_at).
-- This table records one row per (book, local day) with the pages read that day,
-- so every time-based metric becomes a simple, correct aggregation.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.book_reading_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  book_id     uuid        NOT NULL REFERENCES public.books ON DELETE CASCADE,

  date        date        NOT NULL,            -- the LOCAL calendar day the reading happened
  pages_read  int         NOT NULL DEFAULT 0,  -- pages read that day for that book (accumulates via upsert)

  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (book_id, date)                       -- one row per book per day
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.book_reading_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.book_reading_log
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_book_reading_log_org_date ON public.book_reading_log (org_id, date);
CREATE INDEX idx_book_reading_log_book      ON public.book_reading_log (book_id);

-- ============================================================
-- RPC — atomic "add N pages read for this book today".
-- SECURITY INVOKER (default): RLS still applies. org_id/user_id are derived from
-- the book row (only visible if it's the caller's own org), so a foreign book_id
-- simply no-ops. Negative deltas are clamped to 0 (page corrections never log).
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_book_reading(p_book_id uuid, p_date date, p_pages int)
RETURNS void
LANGUAGE plpgsql
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

-- ============================================================
-- BACKFILL — seed history so streak/stats aren't empty on day one.
-- One row per already-finished book at its finish date, crediting its full page
-- count. (Pre-log history only had a single finished_at per book anyway.)
-- ============================================================

INSERT INTO public.book_reading_log (org_id, user_id, book_id, date, pages_read)
SELECT org_id, user_id, id, finished_at::date, COALESCE(total_pages, 0)
FROM public.books
WHERE status = 'read'
  AND finished_at IS NOT NULL
  AND COALESCE(total_pages, 0) > 0
ON CONFLICT (book_id, date) DO NOTHING;

-- Also credit pages already read in IN-PROGRESS books (attributed to the start
-- day), so "pages read" reflects current reading immediately instead of starting
-- from zero after this migration.
INSERT INTO public.book_reading_log (org_id, user_id, book_id, date, pages_read)
SELECT org_id, user_id, id, COALESCE(started_at::date, created_at::date), current_page
FROM public.books
WHERE status = 'reading'
  AND current_page > 0
ON CONFLICT (book_id, date) DO NOTHING;
