-- Anime v2 — per-COUR watch years and ratings.
--
-- season_years / season_ratings are keyed by TMDB season number. For an anime the overlay re-cuts
-- into real seasons (Jujutsu S1/S2/S3), TMDB has only ONE season, so those maps can hold exactly one
-- entry — they cannot carry a year or a rating per real season. And they can't be re-keyed by cour,
-- because Stats reads season_years in TMDB coordinates.
--
-- So the overlay gets its OWN per-user maps, keyed by cour number (1,2,3…). The Watch History strip
-- reads/writes these for overlaid anime; season_years/season_ratings stay untouched (Stats safe).

alter table watching.media_items
  add column if not exists cour_years   jsonb not null default '{}'::jsonb,
  add column if not exists cour_ratings jsonb not null default '{}'::jsonb;

comment on column watching.media_items.cour_years is
  'Per-COUR watch year for an AniList-overlaid anime: { "<cour>": <year> }. Distinct from season_years (TMDB seasons), which Stats reads.';
comment on column watching.media_items.cour_ratings is
  'Per-COUR rating for an AniList-overlaid anime: { "<cour>": <rating> }.';
