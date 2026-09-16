-- ═══════════════════════════════════════════════════════════════════════════
-- watching.person_follows — SUIVRE UNE PERSONNE (Watching v4 §11)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Décidé le 14/09, précisé le 16/09 (owner) : suivre est une action sur la PERSONNE — un « + »
-- sur le bord d'un visage dans Cast & Crew, le même sur le portrait de la page Person — pas de
-- « personne principale » (le modèle foot main + favorites ne s'applique pas : une personne
-- traverse films et séries). Une liste plate, un suivi = la personne entière ; le rôle qu'elle
-- tient sur chaque projet à venir se lit sur le projet, pas sur le suivi.
--
-- Une PRÉFÉRENCE (la tienne) → `org_id`, org_isolation, garde démo lecture seule — comme
-- `for_you_dismissals`. Le nom et le portrait sont dénormalisés ici pour que le rail « Following »
-- se dessine sans un appel TMDB par visage ; la vérité reste TMDB (le robot des sorties les
-- rafraîchit à chaque passage).

create table if not exists watching.person_follows (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  org_id          uuid        not null,
  person_tmdb_id  integer     not null,
  name            text        not null,
  profile_url     text,                            -- TMDB w185 URL, comme cast_members
  known_for       text,                            -- 'Acting' | 'Directing' | … (TMDB known_for_department)
  followed_at     timestamptz not null default now(),
  primary key (user_id, person_tmdb_id)
);

alter table watching.person_follows owner to postgres;
alter table watching.person_follows enable row level security;

create policy "org_isolation" on watching.person_follows
  using (org_id in (select my_orgs.my_orgs from public.my_orgs() my_orgs(my_orgs)))
  with check (org_id in (select my_orgs.my_orgs from public.my_orgs() my_orgs(my_orgs)));

create policy "demo_readonly_insert" on watching.person_follows as restrictive
  for insert with check (not public.is_demo_user());
create policy "demo_readonly_update" on watching.person_follows as restrictive
  for update using (not public.is_demo_user());
create policy "demo_readonly_delete" on watching.person_follows as restrictive
  for delete using (not public.is_demo_user());

grant all on table watching.person_follows to anon;
grant all on table watching.person_follows to authenticated;
grant all on table watching.person_follows to service_role;
