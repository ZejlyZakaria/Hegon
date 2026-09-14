-- For You: the system's first NEGATIVE signal, and an honest "NEW".
--
-- Diagnosed 2026-09-10, built 2026-09-14 (Watching v4 §3):
--   · a dismissed title lived in localStorage only — the refresh robot never knew, re-picked it at
--     the next rotation, and every other device (or a cleared browser) had never seen it dismissed.
--   · `is_new` compared against the PREVIOUS rotation only, so a title back after three rotations
--     wore NEW again.
--
-- `for_you_dismissals` — one row per (user, type, tmdb_id) you rejected. A preference, so it
-- carries `org_id` and sits under org_isolation + the demo read-only guard like every mutable
-- Watching table. The refresh function excludes these from its candidates; the client also filters
-- live between two runs.
--
-- `for_you_cache.seen_ids` — every tmdb_id this user/type has ever been shown (newest last, capped
-- by the function). `is_new` becomes "never shown here", not "not in the last list".

create table if not exists watching.for_you_dismissals (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  org_id       uuid        not null,
  type         text        not null check (type in ('film', 'serie', 'anime')),
  tmdb_id      integer     not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, type, tmdb_id)
);

alter table watching.for_you_dismissals owner to postgres;
alter table watching.for_you_dismissals enable row level security;

create policy "org_isolation" on watching.for_you_dismissals
  using (org_id in (select my_orgs.my_orgs from public.my_orgs() my_orgs(my_orgs)))
  with check (org_id in (select my_orgs.my_orgs from public.my_orgs() my_orgs(my_orgs)));

create policy "demo_readonly_insert" on watching.for_you_dismissals as restrictive
  for insert with check (not public.is_demo_user());
create policy "demo_readonly_update" on watching.for_you_dismissals as restrictive
  for update using (not public.is_demo_user());
create policy "demo_readonly_delete" on watching.for_you_dismissals as restrictive
  for delete using (not public.is_demo_user());

grant all on table watching.for_you_dismissals to anon;
grant all on table watching.for_you_dismissals to authenticated;
grant all on table watching.for_you_dismissals to service_role;

alter table watching.for_you_cache
  add column if not exists seen_ids jsonb not null default '[]'::jsonb;
