-- Journal — optionally snapshot "what you did that day" (habits/films/pages) onto
-- the entry, so past entries permanently show their cross-module context (the live
-- query only knows "today"). Stored as a small list of { type, label }.

ALTER TABLE public.journal_entries
  ADD COLUMN context jsonb;
