-- Books V2 — Quotes & Highlights
-- Migration : book_quotes (dedicated table, RLS, indexes)
-- Replaces the flat books.highlights[] with first-class quote objects
-- (page, personal note, favorite, ordering, future "Quotes wall").

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.book_quotes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  book_id     uuid        NOT NULL REFERENCES public.books ON DELETE CASCADE,

  text        text        NOT NULL,
  page        int,
  note        text,                                  -- personal annotation on the quote
  favorite    boolean     NOT NULL DEFAULT false,
  position    int         NOT NULL DEFAULT 0,        -- manual ordering within a book

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER book_quotes_updated_at
  BEFORE UPDATE ON public.book_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.book_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.book_quotes
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_book_quotes_book_id  ON public.book_quotes (book_id, position);
CREATE INDEX idx_book_quotes_org_id   ON public.book_quotes (org_id);
CREATE INDEX idx_book_quotes_favorite ON public.book_quotes (org_id) WHERE favorite = true;
