-- Phase 2 — Core Modules V1
-- Migration : Books (tables, RLS, indexes)

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.books (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- Metadata
  title        text        NOT NULL,
  author       text,
  cover_url    text,
  external_id  text,
  year         int,
  genre        text[]      NOT NULL DEFAULT '{}',
  total_pages  int,
  description  text,

  -- Personal tracking
  status       text        NOT NULL DEFAULT 'want_to_read'
                           CHECK (status IN ('want_to_read', 'reading', 'read', 'abandoned', 'paused')),
  current_page int         NOT NULL DEFAULT 0,
  rating       int         CHECK (rating BETWEEN 1 AND 5),
  notes        text,
  highlights   text[]      NOT NULL DEFAULT '{}',
  favorite     boolean     NOT NULL DEFAULT false,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Cross-module connections (Phase 2)
  goal_id      uuid        REFERENCES public.goals ON DELETE SET NULL
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.books
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_books_org_id     ON public.books (org_id);
CREATE INDEX idx_books_user_id    ON public.books (user_id);
CREATE INDEX idx_books_status     ON public.books (status);
CREATE INDEX idx_books_finished_at ON public.books (finished_at DESC NULLS LAST);
CREATE INDEX idx_books_created_at ON public.books (created_at DESC);
