-- ═══════════════════════════════════════════════════════════════════════════
-- watching.person_upcoming + cron watching-people-weekly — LES SORTIES DES GENS QUE TU SUIS (§11)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- cron → table → app (R3/R6). Le robot `watching-people-sync` lit l'union des suivis de tous les
-- utilisateurs, demande à TMDB les crédits combinés de chaque personne, garde ce qui sort (date ≥
-- aujourd'hui − 30 j : le mois qui suit une sortie la garde visible « out now ») et réécrit la
-- tranche de la personne ici. L'app lit cette table jointe à SES suivis — jamais TMDB par visage.
--
-- Fait du monde, pas une préférence : pas d'org_id, lecture pour tout authentifié, écriture par
-- le robot seul (comme trending_cache, awards). Une ligne par (personne, type, titre).
--
-- Cadence : hebdomadaire — une sortie se sait des mois à l'avance, une semaine de retard ne
-- coûte rien. Et un suivi tout neuf déclenche le robot pour CETTE personne depuis l'app (payload
-- `{"person": id}`), pour que ses projets s'affichent tout de suite.
--
-- Créneau vérifié contre les 19 crons (R9) : mardi 05:35 — rien à :35 avant 14 h (football-matches
-- 14-23 h), trending à 05:15 (quelques secondes), series-sync à :05, anime à :10, watchdog à :20.

create table if not exists watching.person_upcoming (
  person_tmdb_id  integer     not null,
  media_type      text        not null check (media_type in ('movie', 'tv')),
  tmdb_id         integer     not null,
  title           text        not null,
  poster_path     text,                            -- chemin TMDB ("/abc.jpg")
  release_date    date,                            -- release_date (film) / first_air_date (série)
  role            text,                            -- le personnage (cast) ou le poste (crew)
  department      text        not null,            -- 'Acting' | 'Directing' | 'Writing'
  synced_at       timestamptz not null default now(),
  primary key (person_tmdb_id, media_type, tmdb_id)
);

alter table watching.person_upcoming enable row level security;
create policy person_upcoming_read on watching.person_upcoming for select to authenticated using (true);
grant select on watching.person_upcoming to authenticated;
grant all on watching.person_upcoming to service_role;

do $people_cron$
begin
  if exists (select 1 from cron.job where jobname = 'watching-people-weekly') then
    perform cron.unschedule('watching-people-weekly');
  end if;
  perform cron.schedule(
    'watching-people-weekly',
    '35 5 * * 2',
    'select internal.call_edge(''watching-people-sync'', ''{}''::jsonb);'
  );
end
$people_cron$;

-- VÉRIFIER : select jobname, schedule from cron.job where jobname = 'watching-people-weekly';  -- 1 ligne
