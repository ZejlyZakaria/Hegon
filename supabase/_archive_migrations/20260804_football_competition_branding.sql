-- Football competition branding — brand colour + curated mark-only logo.
-- Powers the match card (Goals "Counting toward", football page, match fiche). The card is pure CSS:
--   brand_color → the ONLY colour — a soft glow at the top of the card (the "--competition-color"),
--                 plus small accents (footer icon). No background image (dropped on purpose: a CSS
--                 gradient is weightless vs a ~1 MB PNG per competition — perf first).
--   logo_url    → the MARK-ONLY league logo (public/assets/football/leagues/{slug}.svg), already
--                 recoloured white / white+grey in the file, so it renders as-is.
--
-- Naming: one slug per competition — laliga · premier-league · serie-a · bundesliga ·
-- champions-league · ligue-1. A competition with no brand_color falls back to the emerald default,
-- so nothing ever breaks. Separate from emblem_url (football-data's, cron-maintained) — do not conflate.

alter table sport.football_competitions
  add column if not exists brand_color text,
  add column if not exists logo_url    text;

-- ── LaLiga (football-data code 'PD') — the piloted competition, fully wired ──────────────────────
update sport.football_competitions
  set brand_color = '#ff4b44',
      logo_url    = '/assets/football/leagues/laliga.svg'
  where code = 'PD';

-- ── Templates for the other followable competitions ──────────────────────────────────────────────
-- Marks already sit in public/assets/football/leagues/ (serie-a & bundesliga to be re-fetched as the
-- --no-text-white variant). Uncomment each once its background is generated. brand_color values are
-- readable dark-ground accents — tweak to taste.

-- Premier League (PL)
-- update sport.football_competitions set
--   brand_color = '#8b5cf6',
--   logo_url    = '/assets/football/leagues/premier-league.svg',
--   bg_url      = '/assets/football/card_bg/premier-league.webp'
--   where code = 'PL';

-- Serie A (SA)
-- update sport.football_competitions set
--   brand_color = '#3b82f6',
--   logo_url    = '/assets/football/leagues/serie-a.svg',
--   bg_url      = '/assets/football/card_bg/serie-a.webp'
--   where code = 'SA';

-- Bundesliga (BL1)
-- update sport.football_competitions set
--   brand_color = '#ef4444',
--   logo_url    = '/assets/football/leagues/bundesliga.svg',
--   bg_url      = '/assets/football/card_bg/bundesliga.webp'
--   where code = 'BL1';

-- Champions League (CL)  — logo already white
-- update sport.football_competitions set
--   brand_color = '#2b6fe0',
--   logo_url    = '/assets/football/leagues/champions-league.svg',
--   bg_url      = '/assets/football/card_bg/champions-league.webp'
--   where code = 'CL';

-- Ligue 1 (FL1)  — mark not added yet; drop leagues/ligue-1.svg then fill this in.
-- update sport.football_competitions set
--   brand_color = '#dbe442',
--   logo_url    = '/assets/football/leagues/ligue-1.svg',
--   bg_url      = '/assets/football/card_bg/ligue-1.webp'
--   where code = 'FL1';
