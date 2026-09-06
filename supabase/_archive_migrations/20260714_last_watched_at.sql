-- "Last watched" was structurally incapable of telling the truth.
--
-- It was derived from `season_years` — a map that is only stamped when a WHOLE SEASON ends. So
-- House of the Dragon reported "2024" (the year season 2 finished) while you had watched an
-- episode a week ago. No amount of computation fixes that: the information simply did not exist
-- anywhere in the database. It had to be CAPTURED, not derived.
--
-- Stamped on every FORWARD move only — the +1, the stepper, mark-as-watched. Stepping backwards
-- is a correction, not a viewing, and must never claim you watched something today.
--
-- Left NULL for existing rows on purpose: we have no honest value for them. The UI falls back to
-- the last year of a season you've actually REACHED. Inventing a date would be exactly the kind
-- of confident lie this whole model exists to stop telling.

alter table watching.media_items
  add column if not exists last_watched_at timestamptz;

comment on column watching.media_items.last_watched_at is
  'When you last moved FORWARD through this title (episode/season advance, or marked watched). Never set by a correction. Null = never captured; fall back to the season years you have reached.';
