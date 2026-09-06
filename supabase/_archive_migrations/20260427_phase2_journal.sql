-- Phase 2 — Core Modules V1
-- Migration : Journal (tables, RLS, indexes)

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.journal_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  entry_date   date        NOT NULL DEFAULT CURRENT_DATE,
  title        text,
  content      text        NOT NULL DEFAULT '',
  mood         text        CHECK (mood IN ('calm', 'good', 'neutral', 'tired', 'rough')),
  tags         text[]      NOT NULL DEFAULT '{}',
  word_count   int         GENERATED ALWAYS AS (
    CASE
      WHEN trim(content) = '' THEN 0
      ELSE array_length(regexp_split_to_array(trim(content), '\s+'), 1)
    END
  ) STORED,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.journal_entries
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_journal_entries_org_id     ON public.journal_entries (org_id);
CREATE INDEX idx_journal_entries_user_id    ON public.journal_entries (user_id);
CREATE INDEX idx_journal_entries_entry_date ON public.journal_entries (entry_date DESC);
CREATE INDEX idx_journal_entries_mood       ON public.journal_entries (mood);
