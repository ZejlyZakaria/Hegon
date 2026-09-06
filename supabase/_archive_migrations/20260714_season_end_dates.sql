-- WHEN A SEASON *ENDED* — the other half of a date the app only ever knew the start of.
--
-- `season_air_dates` holds the day each season STARTED. Everywhere we ask "what is the earliest
-- year you could have watched this season?", we answered with that — and it's wrong for any
-- season that straddles New Year. A season that premiered in December 2026 and finished in
-- February 2027 was watchable "from 2026" as far as the year pickers were concerned, though you
-- could not possibly have seen the end of it before 2027.
--
-- It also settles a disagreement. The add modal wanted this date badly enough to go and FETCH it
-- from TMDB, one season at a time, on every open — while the season strip, having no such
-- appetite, quietly used the start date instead. Two surfaces, two answers to one question. The
-- modal has an excuse (it is dating a title that has no row yet, so it has nothing to read); the
-- strip had none. Now the sync fills the column — it is already walking every season episode by
-- episode, it has the date in its hand and was throwing it away — and everything that HAS a row
-- floors its year pickers on the same number.
--
-- Nullable per entry: TMDB genuinely doesn't know the end date of a season still coming out, and
-- an unknown date must never be dressed up as a known one.

alter table watching.media_items
  add column if not exists season_end_dates jsonb not null default '[]'::jsonb;

comment on column watching.media_items.season_end_dates is
  'Air date of the LAST AIRED episode of each season (null while a season is still coming out). Floors every "year watched" picker. Filled by the series sync.';
