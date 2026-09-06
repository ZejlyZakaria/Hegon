-- Watching/Books → Habits connection.
-- A habit can be auto-completed by activity in another module: when you log a
-- film (or, later, read a book), the linked habit's period auto-ticks.
--   source_module: 'watching' | 'books' | null  (null = manual habit, unchanged)
--   source_key:    optional type filter, e.g. 'film' | 'serie' | 'anime' | null (= any)
-- Reuses habit_completions (no new table). RLS on `habits` already applies.

alter table public.habits
  add column if not exists source_module text,
  add column if not exists source_key    text;
