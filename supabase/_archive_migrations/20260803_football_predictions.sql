-- =====================================================================
-- Football — phase 1c : les pronostics (predict the score before kickoff)
-- =====================================================================
-- À APPLIQUER À LA MAIN (SQL editor Supabase). Jamais `db push`.
-- PERSO (user_id + RLS). FK vers football_matches (la fiche upsert le match d'abord).
-- =====================================================================

create table if not exists sport.football_predictions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  external_match_id  integer not null references sport.football_matches(external_match_id),
  pred_home          integer not null check (pred_home >= 0 and pred_home <= 99),
  pred_away          integer not null check (pred_away >= 0 and pred_away <= 99),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, external_match_id)
);

create index if not exists football_predictions_user_idx on sport.football_predictions (user_id);

alter table sport.football_predictions enable row level security;
create policy fp_select on sport.football_predictions for select using (user_id = auth.uid());
create policy fp_insert on sport.football_predictions for insert with check (user_id = auth.uid());
create policy fp_update on sport.football_predictions for update using (user_id = auth.uid());
create policy fp_delete on sport.football_predictions for delete using (user_id = auth.uid());

grant all on sport.football_predictions to service_role;
grant select, insert, update, delete on sport.football_predictions to authenticated;
