-- =====================================================================
-- Football — SEASON ROLLOVER cron (schedules the football_sync_season edge function)
-- =====================================================================
-- À APPLIQUER À LA MAIN dans le SQL editor Supabase. Jamais `db push`.
--
-- WHY: football_sync_matches only refreshes a ±window around now, so a NEW season's full calendar is
-- never bulk-loaded — only near matches trickle in. `football_sync_season` does the full-season fill of
-- sport.football_matches for followed competitions + teams. Weekly is enough (a new season is caught
-- within 7 days; also keeps fixture reschedules fresh). The read side already auto-switches to the new
-- season (getCompetitionMatches → maxSeason) — this is the only missing piece.
--
-- internal.call_edge SIGNATURE (verified 2026-08-07 against live crons): SINGLE-ARG — just the edge
--    function name, e.g. `select internal.call_edge('football_sync_matches')`. No jsonb payload.
--    Jobname convention = kebab + frequency suffix (football-teams-monthly, football-standings-6h…).
-- =====================================================================

-- Weekly, Monday 04:15 UTC (quiet hour; avoids the 00:00 competitions-monthly and 03:00 teams-monthly).
select cron.schedule(
  'football-season-weekly',
  '15 4 * * 1',
  $$ select internal.call_edge('football_sync_season') $$
);

-- Manual one-off run right now (to backfill immediately without waiting for Monday):
--   select internal.call_edge('football_sync_season');

-- Unschedule (if ever needed):
--   select cron.unschedule('football-season-weekly');
