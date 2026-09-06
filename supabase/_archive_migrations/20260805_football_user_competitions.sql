-- =====================================================================
-- Football — follow-competitions (the 2nd follow axis, alongside follow-team)
-- =====================================================================
-- À APPLIQUER À LA MAIN (copier-coller dans le SQL editor Supabase). Jamais `db push`.
--
-- Two distinct intents:
--   • follow a TEAM (user_favorites)  → "show me ITS matches, wherever they play"
--   • follow a COMPETITION (this)     → "show me THIS competition in full, even with no favourite in it"
-- A match surfaces if (team followed) OR (competition followed) — a union.
--
-- Perso table: user_id + RLS, exactly like football_watched_matches (the module's tenant isolation).
-- Uniform for every competition; the periodic nature of Euro/World Cup (only surface when an edition
-- is active/near) is SURFACING logic in the app, not schema — so nothing special here.
-- =====================================================================

create table if not exists sport.football_user_competitions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  competition_id uuid not null references sport.football_competitions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, competition_id)
);

create index if not exists football_user_competitions_user_idx on sport.football_user_competitions (user_id);

alter table sport.football_user_competitions enable row level security;
create policy fuc_select on sport.football_user_competitions for select using (user_id = auth.uid());
create policy fuc_insert on sport.football_user_competitions for insert with check (user_id = auth.uid());
create policy fuc_delete on sport.football_user_competitions for delete using (user_id = auth.uid());

-- Grants — custom schema, no default privileges for PostgREST roles (RLS governs rows, grants open the table).
grant all on sport.football_user_competitions to service_role;
grant select, insert, delete on sport.football_user_competitions to authenticated;

-- ── Optional seed — follow the 6 club competitions for one user right away (before the follow UI exists).
--    Replace the email, or drop this block and follow from the UI later.
-- insert into sport.football_user_competitions (user_id, competition_id)
-- select u.id, c.id
--   from auth.users u
--   cross join sport.football_competitions c
--  where u.email = 'zejly12@gmail.com'
--    and c.code in ('PD','PL','SA','BL1','FL1','CL')
-- on conflict (user_id, competition_id) do nothing;
