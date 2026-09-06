-- =====================================================================
-- Football — competition PAST WINNERS (roll of honour), sourced from Wikidata
-- =====================================================================
-- À APPLIQUER À LA MAIN dans le SQL editor Supabase. Jamais `db push`.
--
-- Wikidata gives clean, accurate past winners per competition (verified: La Liga/CL winners by year all
-- correct) — keyed by ONE competition QID via P1346 (winner) on P3450 (season of) items. Only this half
-- of the "Prestige layer" is automated: TEAM palmarès is NOT (Wikidata splits league titles across
-- historical entities → wrong counts; see reference_football_data_sources / the chantier note).
--
-- wikidata_id lives on the competition (curated + verified, 13 QIDs below). The edge function
-- football_sync_wikidata reads it, queries Wikidata SPARQL, and upserts the winners here (cache — the UI
-- reads the DB, never Wikidata directly). Reference data (global, no org_id): read by any authenticated
-- user, written only by the service_role (the edge function).
-- =====================================================================

alter table sport.football_competitions add column if not exists wikidata_id text;

create table if not exists sport.football_competition_winners (
  id                 uuid primary key default gen_random_uuid(),
  competition_id     uuid not null references sport.football_competitions(id) on delete cascade,
  season_year        int  not null,                 -- season start year (e.g. 2024 for "2024–25")
  winner_name        text not null,
  winner_wikidata_id text,                          -- the winning club/nation QID (nullable)
  updated_at         timestamptz not null default now(),
  unique (competition_id, season_year)
);

create index if not exists football_competition_winners_comp_idx
  on sport.football_competition_winners (competition_id);

alter table sport.football_competition_winners enable row level security;
create policy football_competition_winners_select
  on sport.football_competition_winners for select using (true);

grant all    on sport.football_competition_winners to service_role;
grant select on sport.football_competition_winners to authenticated;

-- ── Seed the 13 competition Wikidata QIDs (each verified by label + description 2026-08-07) ──────────
update sport.football_competitions set wikidata_id = 'Q82595'  where code = 'BL1';  -- Bundesliga
update sport.football_competitions set wikidata_id = 'Q206813' where code = 'BSA';  -- Campeonato Brasileiro Série A
update sport.football_competitions set wikidata_id = 'Q19510'  where code = 'ELC';  -- EFL Championship
update sport.football_competitions set wikidata_id = 'Q184795' where code = 'CLI';  -- Copa Libertadores
update sport.football_competitions set wikidata_id = 'Q167541' where code = 'DED';  -- Eredivisie
update sport.football_competitions set wikidata_id = 'Q260858' where code = 'EC';   -- UEFA European Championship
update sport.football_competitions set wikidata_id = 'Q19317'  where code = 'WC';   -- FIFA World Cup
update sport.football_competitions set wikidata_id = 'Q13394'  where code = 'FL1';  -- Ligue 1
update sport.football_competitions set wikidata_id = 'Q9448'   where code = 'PL';   -- Premier League
update sport.football_competitions set wikidata_id = 'Q182994' where code = 'PPL';  -- Liga Portugal (Primeira Liga)
update sport.football_competitions set wikidata_id = 'Q324867' where code = 'PD';   -- La Liga
update sport.football_competitions set wikidata_id = 'Q15804'  where code = 'SA';   -- Serie A (Italy)
update sport.football_competitions set wikidata_id = 'Q18756'  where code = 'CL';   -- UEFA Champions League

-- ── Cron (create via the Supabase modal, OR run this) — MONTHLY: a roll of honour gains ≤1 row/comp/yr.
--    Signature verified single-arg (like the other football crons). Jobname convention = kebab.
-- select cron.schedule('football-wikidata-monthly', '30 4 2 * *', $$ select internal.call_edge('football_sync_wikidata') $$);
--
-- Manual one-off run now (backfill the roll of honour immediately):
--   select internal.call_edge('football_sync_wikidata');
