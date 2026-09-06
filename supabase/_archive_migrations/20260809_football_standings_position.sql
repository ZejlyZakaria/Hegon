-- =====================================================================
-- Football — store the OFFICIAL rank in football_standings
-- =====================================================================
-- À APPLIQUER À LA MAIN. Jamais `db push`.
--
-- The UI now reads the official table (football_standings) instead of computing points itself — the
-- computed table couldn't know point deductions (Juventus −15…) or per-league tiebreakers (La Liga /
-- Serie A rank on head-to-head, not goal difference). `points` already carried the deductions; what was
-- missing is the official POSITION. This column stores football-data's `row.position` so the table is
-- ordered exactly right. Backfilled on the next football_sync_standings run.
-- =====================================================================

alter table sport.football_standings add column if not exists position int;
