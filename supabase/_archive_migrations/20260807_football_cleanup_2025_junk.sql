-- =====================================================================
-- Football — clean the junk 2025 La Liga matches (test artifacts)
-- =====================================================================
-- À APPLIQUER À LA MAIN (copier-coller dans le SQL editor Supabase). Jamais `db push`.
--
-- During testing, 3 Real Madrid La Liga matches from season 2025/2026 got cached (with the 3 watched
-- + 1 prediction rows below). They are the only junk — an incomplete fragment that pollutes the
-- all-time / season stats. We KEEP the full 2025/2026 Champions League (189 real matches, used by the
-- UCL competition page), so this deletes ONLY La Liga season < 2026.
--
-- Children (FK on external_match_id) go first, then the matches.
-- =====================================================================

delete from sport.football_watched_matches
where external_match_id in (
  select external_match_id from sport.football_matches
  where season < 2026
    and competition_id = (select id from sport.football_competitions where code = 'PD')
);

delete from sport.football_predictions
where external_match_id in (
  select external_match_id from sport.football_matches
  where season < 2026
    and competition_id = (select id from sport.football_competitions where code = 'PD')
);

delete from sport.football_matches
where season < 2026
  and competition_id = (select id from sport.football_competitions where code = 'PD');
