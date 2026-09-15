-- Le Musée — une source 'manual' pour les trous de la source elle-même (2026-09-16)
--
-- Audit des lauréats Oscars par année (scripts/.shots/_awyears.mjs) : tout ce qui semblait faux
-- est vrai — deux cérémonies en 1930, aucune en 1933, Janet Gaynor primée pour trois films en
-- 1929, les ex æquo de 1932 et 1969 — sauf UN trou : Haing S. Ngor, Best Supporting Actor 1985
-- (The Killing Fields), que Wikidata ne connaît que comme nommé. Une ligne saisie à la main,
-- marquée 'manual' : le robot ne la produit pas, ne l'écrase pas (upsert par clé naturelle, clé
-- distincte), et une lecture la voit comme les autres.

alter table watching.awards drop constraint if exists awards_source_check;
alter table watching.awards add constraint awards_source_check check (source in ('wikidata', 'emmys', 'manual'));

insert into watching.awards
  (ceremony, category, year, year_inferred, won, work_qid, work_tmdb_id, work_type, work_title, poster_path, work_year, person_qid, person_tmdb_id, person_name, source, match)
values
  ('oscars', 'best_supporting_actor', 1985, false, true, 'manual:the-killing-fields', 625, 'film', 'The Killing Fields', null, 1984, 'manual:haing-s-ngor', 8976, 'Haing S. Ngor', 'manual', 'id')
on conflict (ceremony, category, year, work_qid, person_qid) do nothing;

-- La nomination Wikidata du même fait (Ngor "nommé" 1985) ferait doublon avec la victoire.
delete from watching.awards
  where ceremony = 'oscars' and category = 'best_supporting_actor' and year = 1985 and won = false
    and person_name = 'Haing S. Ngor' and source = 'wikidata';
