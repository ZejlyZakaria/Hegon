-- =====================================================================
-- Football — team enrichment (TheSportsDB images/meta + full Wikidata honours)
-- =====================================================================
-- À APPLIQUER À LA MAIN. Jamais `db push`.
--
-- The team page goes premium: a stadium/fanart hero, an "About" card, and the FULL honours (not just
-- the 13 tracked competitions). Data comes from keyless free APIs, resolved on-demand and cached:
--   • TheSportsDB (fanart, banner, description, stadium capacity) — matched by team name → thesportsdb_id
--   • Wikidata (all major trophies) — matched by QID, filtered to a curated major-competition whitelist
-- Both are filled by the /api/football/enrich-team route (server-side, keyless externals + service key).
-- =====================================================================

alter table sport.football_teams
  add column if not exists thesportsdb_id    text,
  add column if not exists fanart_url        text,
  add column if not exists banner_url        text,
  add column if not exists description       text,
  add column if not exists stadium_capacity  int,
  add column if not exists enriched_at       timestamptz;

-- Full honours (major trophies), Wikidata-sourced, cached. Separate from football_competition_winners
-- (that one is the per-season roll of honour for the 13 tracked competitions).
create table if not exists sport.football_team_honours (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references sport.football_teams(id) on delete cascade,
  competition_qid  text not null,
  competition_name text not null,
  category         text,                 -- league | domestic_cup | domestic_super | continental | world
  titles           int  not null,
  updated_at       timestamptz not null default now(),
  unique (team_id, competition_qid)
);
create index if not exists football_team_honours_team_idx on sport.football_team_honours (team_id);

alter table sport.football_team_honours enable row level security;
create policy football_team_honours_select on sport.football_team_honours for select using (true);
grant all    on sport.football_team_honours to service_role;
grant select on sport.football_team_honours to authenticated;
