-- =====================================================================
-- Football — drop the dead "widget" tables (next/past matches)
-- =====================================================================
-- À APPLIQUER À LA MAIN. Jamais `db push`.
--
-- These capped tables (3 next / 3 past matches per team) were fed by two HOURLY crons and read only by
-- the old page monolith (getFootballPageData, now removed) + two dead dashboard fns. The whole page now
-- reads football_matches (the durable full calendar), so these are pure legacy. Dropping them + killing
-- their crons stops two needless hourly football-data hits.
--
-- ⚠️ AVANT / EN PLUS (à faire à la main, hors SQL) :
--   1) Désactiver les 2 crons :
--        select cron.unschedule('football-next-matches-hourly');
--        select cron.unschedule('football-past-matches-hourly');
--   2) Undeploy les 2 edge functions (dashboard Supabase → Edge Functions → delete) :
--        football_sync_next_matches, football_sync_past_matches
--   (Note: `football-matches-hourly` → football_matches RESTE, c'est la table vivante.)
--   (Note: 2 fns dashboard mortes lisent encore ces tables — jamais appelées ; nettoyage dashboard séparé.)
-- =====================================================================

drop table if exists sport.football_next_matches;
drop table if exists sport.football_past_matches;
