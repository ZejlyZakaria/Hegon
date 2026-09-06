-- "Why this matters" — the motivation / north-star behind a goal. Surfaced
-- prominently on the detail page so opening a goal re-motivates you, instead of
-- being buried in the description.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS why text;
