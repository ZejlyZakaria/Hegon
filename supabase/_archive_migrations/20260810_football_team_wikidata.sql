-- =====================================================================
-- Football — wikidata_id on teams → clean, deterministic honours
-- =====================================================================
-- À APPLIQUER À LA MAIN. Jamais `db push`.
--
-- We abandoned team palmarès earlier because Wikidata's AGGREGATE trophy data is messy (league titles
-- split across historical entities, friendly/youth noise). But football_competition_winners already
-- holds the clean per-season winners of the 13 tracked competitions — the MAJOR ones. Matching a team
-- to those winners BY WIKIDATA QID (not by name) is deterministic → "La Liga ×36, Champions League ×15"
-- comes out exact, scoped to the tracked competitions. This column stores that QID.
--
-- Seeded for the 7 followed teams (verified QIDs, 2026-08-07). The monthly team-sync can resolve more
-- later; nullable so an unmatched team simply shows no honours.
-- =====================================================================

alter table sport.football_teams add column if not exists wikidata_id text;

update sport.football_teams set wikidata_id = 'Q15789'   where api_external_id = '5';   -- FC Bayern München
update sport.football_teams set wikidata_id = 'Q1130849' where api_external_id = '64';  -- Liverpool FC
update sport.football_teams set wikidata_id = 'Q50602'   where api_external_id = '65';  -- Manchester City FC
update sport.football_teams set wikidata_id = 'Q8701'    where api_external_id = '78';  -- Club Atlético de Madrid
update sport.football_teams set wikidata_id = 'Q7156'    where api_external_id = '81';  -- FC Barcelona
update sport.football_teams set wikidata_id = 'Q8682'    where api_external_id = '86';  -- Real Madrid CF (football club, NOT the multi-sport Q6362982)
update sport.football_teams set wikidata_id = 'Q9617'    where api_external_id = '57';  -- Arsenal FC
