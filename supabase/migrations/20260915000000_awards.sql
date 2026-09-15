-- ═══════════════════════════════════════════════════════════════════════════
-- watching.award_categories + watching.awards — LE MUSÉE (Watching v4 §6)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI
-- « Ta collection rencontre le canon » : les lauréats et nommés des Oscars et des Emmys, par
-- catégorie et par année, joints à la bibliothèque par l'id TMDB. Donnée de RÉFÉRENCE (le monde,
-- pas une préférence) → pas d'org_id, lecture pour tout utilisateur authentifié, écriture par le
-- robot seulement (comme trending_cache). Design figé le 2026-09-15 (decisions.md).
--
-- SOURCE — Wikidata (SPARQL), robot `watching-awards-sync`. Ce qu'on a appris en sondant :
--   · la récompense est portée par le FILM **et** par la PERSONNE (« Best Actor → Oppenheimer » et
--     « → Cillian Murphy »), et pour Best Picture par les PRODUCTEURS → on ne garde que les lignes
--     dont l'œuvre a un id TMDB (P4947 film / P4983 série) ; la ligne « personne » (P4985) porte
--     l'œuvre en qualificatif P1686 ;
--   · `P585` (point in time) = l'année de la CÉRÉMONIE (Oppenheimer → 2024) ;
--   · des catégories ont été renommées/scindées au fil des décennies (Cinematography couleur / N&B,
--     Foreign Language → International) → une catégorie = une clé + PLUSIEURS QIDs.
--
-- LES CATÉGORIES SONT EN BASE, pas dans le code : la fonction lit ses QIDs ici, le front lit ses
-- libellés et son ordre ici. Une seule vérité, modifiable par migration.

create table if not exists watching.award_categories (
  key         text primary key,                              -- 'best_picture'
  ceremony    text not null check (ceremony in ('oscars', 'emmys')),
  label       text not null,                                 -- 'Best Picture'
  -- 'work' = le prix va à l'œuvre (Best Picture) ; 'person' = à une personne POUR une œuvre
  -- (Best Actor) — l'objet affiché reste l'œuvre, la personne est une ligne méta.
  subject     text not null check (subject in ('work', 'person')),
  rank        integer not null,                              -- ordre d'affichage (1 = le plus prestigieux)
  qids        text[] not null,                               -- les QIDs Wikidata qui portent cette catégorie
  since       integer                                        -- première cérémonie (info, pour « 12 / 96 »)
);

create table if not exists watching.awards (
  id              bigint generated always as identity primary key,
  ceremony        text not null check (ceremony in ('oscars', 'emmys')),
  category        text not null references watching.award_categories(key) on delete cascade,
  year            integer not null,                          -- année de la cérémonie
  year_inferred   boolean not null default false,            -- pas de P585 → année de sortie + 1
  won             boolean not null,
  work_qid        text not null,
  work_tmdb_id    integer not null,                          -- sans id TMDB, pas d'affiche : on n'ingère pas
  work_type       text not null check (work_type in ('film', 'serie')),
  work_title      text not null,
  -- Rempli après coup depuis TMDB (une fiche par œuvre, à l'ingestion) : 2 000 œuvres ne se
  -- résolvent pas depuis la page. NULL = pas encore enrichi (le robot y revient chaque mois).
  poster_path     text,
  work_year       integer,
  person_qid      text not null default '',                 -- '' = le prix va à l'œuvre elle-même
  person_tmdb_id  integer,
  person_name     text,
  synced_at       timestamptz not null default now()
);

-- Clé naturelle : une œuvre par catégorie et par année, une ligne par personne créditée
-- (writers, sound…). `person_qid` vaut '' et non NULL pour que l'unicité tienne (NULL ≠ NULL en
-- SQL) et que PostgREST puisse cibler la contrainte en upsert (`on_conflict=`).
alter table watching.awards add constraint awards_natural_key
  unique (ceremony, category, year, work_qid, person_qid);
create index if not exists awards_work on watching.awards (work_type, work_tmdb_id);
create index if not exists awards_person on watching.awards (person_tmdb_id) where person_tmdb_id is not null;

alter table watching.award_categories enable row level security;
alter table watching.awards enable row level security;
-- Référence globale : tout utilisateur authentifié lit (démo comprise) ; seule la service_role écrit.
create policy award_categories_read on watching.award_categories for select to authenticated using (true);
create policy awards_read on watching.awards for select to authenticated using (true);

grant select on watching.award_categories to authenticated;
grant select on watching.awards to authenticated;
grant all on watching.award_categories to service_role;
grant all on watching.awards to service_role;

-- ── Les catégories ─────────────────────────────────────────────────────────
-- Whitelist volontaire (~20 Oscars, ~17 Emmys) : pas d'honorifiques, pas de « Technical
-- Achievement », pas de courts-métrages. QIDs relevés et comptés en SPARQL le 2026-09-15.
insert into watching.award_categories (key, ceremony, label, subject, rank, qids, since) values
  ('best_picture',                 'oscars', 'Best Picture',                     'work',   1,  '{Q102427}', 1929),
  ('best_director',                'oscars', 'Best Director',                    'person', 2,  '{Q103360}', 1929),
  ('best_actor',                   'oscars', 'Best Actor',                       'person', 3,  '{Q103916}', 1929),
  ('best_actress',                 'oscars', 'Best Actress',                     'person', 4,  '{Q103618}', 1929),
  ('best_supporting_actor',        'oscars', 'Best Supporting Actor',            'person', 5,  '{Q106291}', 1937),
  ('best_supporting_actress',      'oscars', 'Best Supporting Actress',          'person', 6,  '{Q106301}', 1937),
  ('best_original_screenplay',     'oscars', 'Best Original Screenplay',         'person', 7,  '{Q41417}',  1941),
  ('best_adapted_screenplay',      'oscars', 'Best Adapted Screenplay',          'person', 8,  '{Q107258}', 1929),
  ('best_animated_feature',        'oscars', 'Best Animated Feature',            'work',   9,  '{Q106800}', 2002),
  ('best_international_feature',   'oscars', 'Best International Feature',       'work',   10, '{Q105304}', 1957),
  ('best_documentary_feature',     'oscars', 'Best Documentary Feature',         'work',   11, '{Q111332}', 1943),
  ('best_cinematography',          'oscars', 'Best Cinematography',              'person', 12, '{Q131520,Q21995136,Q21995139}', 1929),
  ('best_film_editing',            'oscars', 'Best Film Editing',                'person', 13, '{Q281939}', 1935),
  ('best_original_score',          'oscars', 'Best Original Score',              'person', 14, '{Q488651,Q4671338,Q22752868,Q22235329,Q22235305,Q22752734}', 1935),
  ('best_original_song',           'oscars', 'Best Original Song',               'person', 15, '{Q112243}', 1935),
  ('best_production_design',       'oscars', 'Best Production Design',           'person', 16, '{Q277751,Q22253131,Q22253133}', 1929),
  ('best_costume_design',          'oscars', 'Best Costume Design',              'person', 17, '{Q277536,Q22120066,Q22120095}', 1949),
  ('best_makeup_and_hairstyling',  'oscars', 'Best Makeup and Hairstyling',      'person', 18, '{Q487136}', 1982),
  ('best_visual_effects',          'oscars', 'Best Visual Effects',              'person', 19, '{Q393686,Q22917729}', 1940),
  ('best_sound',                   'oscars', 'Best Sound',                       'person', 20, '{Q830079}', 1931),

  ('outstanding_drama_series',     'emmys',  'Outstanding Drama Series',         'work',   1,  '{Q989438}',  1951),
  ('outstanding_comedy_series',    'emmys',  'Outstanding Comedy Series',        'work',   2,  '{Q2110156}', 1952),
  ('outstanding_limited_series',   'emmys',  'Outstanding Limited Series',       'work',   3,  '{Q20714679,Q13423511}', 1973),
  ('lead_actor_drama',             'emmys',  'Lead Actor in a Drama Series',     'person', 4,  '{Q989439}',  1954),
  ('lead_actress_drama',           'emmys',  'Lead Actress in a Drama Series',   'person', 5,  '{Q989445}',  1954),
  ('lead_actor_comedy',            'emmys',  'Lead Actor in a Comedy Series',    'person', 6,  '{Q989442}',  1954),
  ('lead_actress_comedy',          'emmys',  'Lead Actress in a Comedy Series',  'person', 7,  '{Q1287335}', 1954),
  ('lead_actor_limited',           'emmys',  'Lead Actor in a Limited Series',   'person', 8,  '{Q107548735,Q989453}', 1955),
  ('lead_actress_limited',         'emmys',  'Lead Actress in a Limited Series', 'person', 9,  '{Q989447}',  1955),
  ('supporting_actor_drama',       'emmys',  'Supporting Actor in a Drama',      'person', 10, '{Q1286639}', 1959),
  ('supporting_actress_drama',     'emmys',  'Supporting Actress in a Drama',    'person', 11, '{Q1285504}', 1959),
  ('supporting_actor_comedy',      'emmys',  'Supporting Actor in a Comedy',     'person', 12, '{Q1285970}', 1959),
  ('supporting_actress_comedy',    'emmys',  'Supporting Actress in a Comedy',   'person', 13, '{Q989450}',  1959),
  ('directing_drama',              'emmys',  'Directing for a Drama Series',     'person', 14, '{Q583972}',  1959),
  ('writing_drama',                'emmys',  'Writing for a Drama Series',       'person', 15, '{Q3123491}', 1959),
  ('outstanding_animated_program', 'emmys',  'Outstanding Animated Program',     'work',   16, '{Q337926}',  1979),
  ('outstanding_television_movie', 'emmys',  'Outstanding Television Movie',     'work',   17, '{Q7243506}', 1992)
on conflict (key) do update set
  ceremony = excluded.ceremony, label = excluded.label, subject = excluded.subject,
  rank = excluded.rank, qids = excluded.qids, since = excluded.since;

-- ── Les crons ──────────────────────────────────────────────────────────────
-- Mensuels, le 3 à 04:55 (Oscars) et 05:55 (Emmys) — une cérémonie par appel, ~20 requêtes SPARQL
-- chacune, sous le budget d'une invocation ; minute :55 libre, heures distinctes (règle R9).
-- Sans `since`, le robot ne relit que l'année courante et la précédente : après une cérémonie,
-- les nouvelles lignes arrivent dans le mois. Le BACKFILL complet se lance une fois, à la main :
--   select internal.call_edge('watching-awards-sync', '{"ceremony":"oscars","since":1929}');
--   select internal.call_edge('watching-awards-sync', '{"ceremony":"emmys","since":1949}');
do $awards_cron$
declare j record;
begin
  for j in
    select * from (values
      ('watching-awards-oscars-monthly', '55 4 3 * *',
       'select internal.call_edge(''watching-awards-sync'', ''{"ceremony":"oscars"}''::jsonb);'),
      ('watching-awards-emmys-monthly',  '55 5 3 * *',
       'select internal.call_edge(''watching-awards-sync'', ''{"ceremony":"emmys"}''::jsonb);')
    ) as t(jobname, schedule, command)
  loop
    if exists (select 1 from cron.job where jobname = j.jobname) then
      perform cron.unschedule(j.jobname);
    end if;
    perform cron.schedule(j.jobname, j.schedule, j.command);
  end loop;
end
$awards_cron$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFIER APRÈS APPLICATION
--   select count(*) from watching.award_categories;            -- 37
--   select jobname, schedule from cron.job where jobname like 'watching-awards-%';   -- 2 lignes
-- Puis, après le backfill :
--   select category, count(*) filter (where won) wins, count(*) noms
--     from watching.awards where ceremony = 'oscars' group by 1 order by 2 desc;
