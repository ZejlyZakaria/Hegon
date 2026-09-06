-- =====================================================================
-- Football — phase 1a : le socle durable + le Fan Log
-- =====================================================================
-- À APPLIQUER À LA MAIN (copier-coller dans le SQL editor Supabase).
-- Jamais `db push` (schema_migrations est vide → rejouerait tout).
--
-- 1) football_matches   — RÉFÉRENCE (pas d'org_id), une ligne par match RÉEL,
--    NE PURGE JAMAIS. Remplace le cap "3 derniers / 3 prochains". Source de :
--    calendrier/résultats complets, fiche match, bracket UCL (via `stage`),
--    et de tout le Fan Log / Wrapped (on ne note pas un match effacé).
-- 2) football_watched_matches — PERSO (user_id + RLS). Le Fan Log.
-- =====================================================================

-- ── 1. football_matches ──────────────────────────────────────────────
create table if not exists sport.football_matches (
  id                     uuid primary key default gen_random_uuid(),
  external_match_id      integer not null unique,        -- id football-data du match
  competition_id         uuid references sport.football_competitions(id),
  season                 integer,                        -- année de début de saison (2025 = 2025/26)
  utc_date               timestamptz not null,
  status                 text not null,                  -- SCHEDULED/TIMED/IN_PLAY/PAUSED/FINISHED
  matchday               integer,
  stage                  text,                           -- REGULAR_SEASON, LEAGUE_STAGE, LAST_16, QUARTER_FINALS, SEMI_FINALS, FINAL…
  "group"                text,                           -- GROUP_E (nullable)
  venue                  text,
  attendance             integer,
  home_team_external_id  text not null,
  away_team_external_id  text not null,
  home_team_name         text not null,
  away_team_name         text not null,
  home_team_id           uuid references sport.football_teams(id),  -- résolu quand connu
  away_team_id           uuid references sport.football_teams(id),
  home_score             integer,                        -- full time
  away_score             integer,
  home_score_ht          integer,                        -- mi-temps
  away_score_ht          integer,
  winner                 text,                           -- HOME_TEAM/AWAY_TEAM/DRAW
  last_updated           timestamptz,                    -- lastUpdated football-data
  fetched_at             timestamptz not null default now(),
  created_at             timestamptz not null default now()
);

create index if not exists football_matches_comp_date_idx on sport.football_matches (competition_id, utc_date);
create index if not exists football_matches_home_ext_idx   on sport.football_matches (home_team_external_id);
create index if not exists football_matches_away_ext_idx   on sport.football_matches (away_team_external_id);
create index if not exists football_matches_status_idx     on sport.football_matches (status);
-- Le bracket : tous les matchs d'une compète par phase.
create index if not exists football_matches_comp_stage_idx on sport.football_matches (competition_id, season, stage);

-- Référence partagée : lecture ouverte (données non personnelles) ; écriture via service role (cron/edge).
alter table sport.football_matches enable row level security;
create policy football_matches_read on sport.football_matches for select using (true);

-- ── 2. football_watched_matches (Fan Log) ────────────────────────────
create table if not exists sport.football_watched_matches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  external_match_id  integer not null references sport.football_matches(external_match_id),
  watched            boolean not null default true,      -- existence ≈ vu ; le flag permet de dé-cocher sans perdre note/rating
  watched_where      text check (watched_where in ('tv','stadium','live')),
  rating             numeric(3,1) check (rating >= 0 and rating <= 10),
  note               text,
  watched_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, external_match_id)
);

create index if not exists football_watched_matches_user_idx on sport.football_watched_matches (user_id);

alter table sport.football_watched_matches enable row level security;
create policy fwm_select on sport.football_watched_matches for select using (user_id = auth.uid());
create policy fwm_insert on sport.football_watched_matches for insert with check (user_id = auth.uid());
create policy fwm_update on sport.football_watched_matches for update using (user_id = auth.uid());
create policy fwm_delete on sport.football_watched_matches for delete using (user_id = auth.uid());

-- ── 3. Grants — une table d'un schéma CUSTOM n'a aucun privilège par défaut pour les rôles
--    PostgREST. Sans ça : "permission denied for table" (même pour le service_role de la route).
--    RLS gouverne les LIGNES ; ces grants ouvrent la TABLE. Les deux sont nécessaires.
grant usage on schema sport to anon, authenticated, service_role;
grant all    on sport.football_matches          to service_role;
grant all    on sport.football_watched_matches  to service_role;
grant select on sport.football_matches          to anon, authenticated;
grant select, insert, update, delete on sport.football_watched_matches to authenticated;
