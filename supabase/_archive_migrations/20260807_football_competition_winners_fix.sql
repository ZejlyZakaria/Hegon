-- =====================================================================
-- Football — winners fix: key by the Wikidata SEASON entity, not the start year
-- =====================================================================
-- À APPLIQUER À LA MAIN. Jamais `db push`.
--
-- BUG: season start-year is NOT unique per competition. La Liga had TWO seasons in 1929 — "1929 La
-- Liga" (Feb–Jun, won by Barcelona) and "1929–30 La Liga" (autumn, won by Athletic) — both start-year
-- 1929. The old unique key (competition_id, season_year) collapsed them, dropping one title (Barça
-- showed 28 La Liga, not 29). Fix: key by the season's Wikidata QID (always unique) and store the
-- season's own label for display ("2025/26", "1929") instead of deriving it from the year.
--
-- The table is a rebuildable cache → truncate + let football_sync_wikidata refill with the new columns.
-- =====================================================================

alter table sport.football_competition_winners
  add column if not exists season_wikidata_id text,
  add column if not exists season_label       text;

truncate sport.football_competition_winners;

alter table sport.football_competition_winners
  drop constraint if exists football_competition_winners_competition_id_season_year_key;
alter table sport.football_competition_winners
  add constraint football_competition_winners_comp_season_uk
  unique (competition_id, season_wikidata_id);
