-- ═══════════════════════════════════════════════════════════════════════════
-- Le Musée — les Emmys viennent d'emmys.com, pas de Wikidata (2026-09-15)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mesuré : Wikidata a 98/98 Best Picture mais 19 Outstanding Comedy Series sur 70 ans, et ZÉRO
-- award pour Ted Lasso — la donnée n'y a jamais été saisie. emmys.com (Television Academy) publie
-- sur chaque page de catégorie un bloc JSON-LD schema.org `ItemList` : séries, personnes, lauréat
-- ou nommé, depuis 1949. Mais sans aucun id — des noms. La jointure TMDB se fait donc par
-- recherche (titre + fenêtre d'année, nom de personne), contre-vérifiée par Wikidata quand elle
-- connaît le titre. D'où trois changements :
--   · `work_tmdb_id` devient NULLABLE — une ligne dont le titre ne se résout pas est GARDÉE (la
--     vérité de la cérémonie ne dépend pas de TMDB), comptée, sans affiche ni lien ;
--   · `source` dit d'où vient la ligne, `match` comment son id a été trouvé ('id' = confirmé par
--     Wikidata, 'name' = recherche TMDB seule, 'none' = non résolu) ;
--   · `award_categories.emmy_slug` — le motif (regex) du slug emmys.com de la catégorie, car les
--     slugs ont été renommés au fil des décennies (miniseries → limited or anthology series).

alter table watching.awards alter column work_tmdb_id drop not null;
alter table watching.awards add column if not exists source text not null default 'wikidata'
  check (source in ('wikidata', 'emmys'));
alter table watching.awards add column if not exists match text not null default 'id'
  check (match in ('id', 'name', 'none'));
alter table watching.award_categories add column if not exists emmy_slug text;

update watching.award_categories set emmy_slug = v.pattern from (values
  ('outstanding_drama_series',     '^outstanding-drama-series$'),
  ('outstanding_comedy_series',    '^outstanding-comedy-series$'),
  ('outstanding_limited_series',   '^outstanding-(limited-or-anthology-series|limited-series|miniseries|miniseries-or-movie)$'),
  ('lead_actor_drama',             '^outstanding-lead-actor-in-a-drama-series$'),
  ('lead_actress_drama',           '^outstanding-lead-actress-in-a-drama-series$'),
  ('lead_actor_comedy',            '^outstanding-lead-actor-in-a-comedy-series$'),
  ('lead_actress_comedy',          '^outstanding-lead-actress-in-a-comedy-series$'),
  ('lead_actor_limited',           '^outstanding-lead-actor-in-a-(limited|miniseries)'),
  ('lead_actress_limited',         '^outstanding-lead-actress-in-a-(limited|miniseries)'),
  ('supporting_actor_drama',       '^outstanding-supporting-actor-in-a-drama-series$'),
  ('supporting_actress_drama',     '^outstanding-supporting-actress-in-a-drama-series$'),
  ('supporting_actor_comedy',      '^outstanding-supporting-actor-in-a-comedy-series$'),
  ('supporting_actress_comedy',    '^outstanding-supporting-actress-in-a-comedy-series$'),
  ('directing_drama',              '^outstanding-directing-for-a-drama-series$'),
  ('writing_drama',                '^outstanding-writing-for-a-drama-series$'),
  ('directing_comedy',             '^outstanding-directing-for-a-comedy-series$'),
  ('writing_comedy',               '^outstanding-writing-for-a-comedy-series$'),
  ('outstanding_animated_program', '^outstanding-animated-program'),
  ('outstanding_television_movie', '^outstanding-(made-for-television-movie|television-movie)$')
) as v(key, pattern) where award_categories.key = v.key;

-- VÉRIFIER : select key, emmy_slug from watching.award_categories where ceremony = 'emmys';  -- 19, aucun null
-- Puis le backfill (local, ~15 min) : deno run -A scripts/backfill-award-emmys.ts
