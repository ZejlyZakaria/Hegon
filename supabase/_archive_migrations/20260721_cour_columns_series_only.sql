-- A FILM HAS NO COURS.
--
-- `cour_years` / `cour_ratings` (20260716_media_cour_years.sql) exist for exactly one shape: an anime
-- TMDB lumps into a single flat season while AniList splits it into cours, where `season_years` —
-- indexed by TMDB season — cannot express "the second of three blocks TMDB calls one".
--
-- A film has one of everything. Those maps on a film are not a smaller truth, they are a category
-- error: the row would carry coordinates in a space it does not live in, and no screen would ever
-- render them. Nothing prevented it — plain jsonb columns, writable by every door.
--
-- The app refuses it first (media.schema.ts, `refuseCoursOnFilm`). This is the backstop for a write
-- that never passes through that schema: a script, the SQL editor, a future edge function.
--
-- NULL and '{}' both stay legal — "nothing here" is true of a film and is what every existing row
-- already says, so this constraint is inert on today's data.

alter table watching.media_items
  add constraint media_items_cour_columns_series_only
  check (
    type <> 'film'
    or (
      (cour_years   is null or cour_years   = '{}'::jsonb)
      and
      (cour_ratings is null or cour_ratings = '{}'::jsonb)
    )
  );

comment on constraint media_items_cour_columns_series_only on watching.media_items is
  'cour_years/cour_ratings are cour-indexed (AniList overlay) and meaningless for a film. Mirrors refuseCoursOnFilm() in media.schema.ts.';
