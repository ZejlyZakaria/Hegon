-- =====================================================================
-- Football — competition branding for the 7 priority competitions
-- =====================================================================
-- À APPLIQUER À LA MAIN (copier-coller dans le SQL editor Supabase). Jamais `db push`.
--
-- Sets logo_url (our recolored WHITE svg, for the dark UI) + brand_color (the glow tint) for the 7
-- competitions we own artwork for. The other 6 keep logo_url NULL → the strip/modal fall back to
-- emblem_url (football-data PNG). Colours are brand-official; we may brighten the darker ones after
-- eyeballing the glow.
-- =====================================================================

update sport.football_competitions set brand_color = '#3d195b', logo_url = '/assets/football/leagues-white-logos/premier-league.svg'   where code = 'PL';
update sport.football_competitions set brand_color = '#ff4b44', logo_url = '/assets/football/leagues-white-logos/la-liga.svg'          where code = 'PD';
update sport.football_competitions set brand_color = '#12326b', logo_url = '/assets/football/leagues-white-logos/serie-a.svg'          where code = 'SA';
update sport.football_competitions set brand_color = '#123a8f', logo_url = '/assets/football/leagues-white-logos/ligue-1.svg'          where code = 'FL1';
update sport.football_competitions set brand_color = '#d20515', logo_url = '/assets/football/leagues-white-logos/bundesliga.svg'       where code = 'BL1';
update sport.football_competitions set brand_color = '#0a1e5e', logo_url = '/assets/football/leagues-white-logos/champions-league.svg' where code = 'CL';
update sport.football_competitions set brand_color = '#c9a24a', logo_url = '/assets/football/leagues-white-logos/world-cup.svg'        where code = 'WC';
