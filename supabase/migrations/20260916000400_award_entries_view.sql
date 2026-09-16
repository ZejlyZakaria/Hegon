-- ═══════════════════════════════════════════════════════════════════════════
-- watching.award_entries — LE REPLI EN SQL (Watching v4 §6, dette du 15/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI
-- `watching.awards` garde UNE LIGNE PAR CRÉDIT (Best Sound 2024 = quatre noms, quatre lignes).
-- Toutes les surfaces montrent des TITRES : chacune commençait par replier les lignes d'un
-- (cérémonie, catégorie, année, œuvre) en une entrée avec ses personnes — en JavaScript, après
-- avoir téléchargé les lignes. Mesuré le 16/09 : la page Awards = 4 requêtes, 1 019 KB pour
-- ~2 000 lignes qui deviennent ~500 entrées. Le repli est une agrégation : il se fait ici, une
-- fois, et le fil transporte les entrées.
--
-- LA RÈGLE DU REPLI (la même que `foldEntries` en front, qu'elle remplace)
--   · clé = cérémonie | catégorie | année | gagné/nommé | œuvre (id TMDB, sinon QID) [| personne]
--   · `won` fait partie de la clé : Aaron Paul (lauréat) et Giancarlo Esposito (nommé), même série,
--     même catégorie, même année, sont DEUX nominations ; les co-scénaristes d'une nomination
--     partagent un `won` et restent une entrée à plusieurs noms ;
--   · sur les catégories PORTRAIT (jeu, réalisation), la nomination EST la personne : quatre
--     actrices nommées d'une série = quatre entrées (`award_categories.portrait`).
--
-- `security_invoker` : la vue lit avec les droits de l'appelant, donc la policy de lecture de
-- `awards` (authenticated) s'applique telle quelle ; pas de trou par la vue.

create or replace view watching.award_entries
  with (security_invoker = true) as
with keyed as (
  select
    a.*,
    -- L'œuvre du repli : l'id TMDB quand il existe (deux QIDs d'une même œuvre se rejoignent),
    -- sinon son QID (deux titres non résolus ne se rejoignent jamais).
    coalesce(a.work_type || ':' || a.work_tmdb_id::text, a.work_qid)                 as fold_work,
    case when c.portrait and a.person_qid <> '' then a.person_qid else '' end          as fold_person
  from watching.awards a
  join watching.award_categories c on c.key = a.category
)
select
  -- La clé du repli, textuelle, telle que React la consomme.
  ceremony || '|' || category || '|' || year || '|' || case when won then 'W' else 'N' end
    || '|' || fold_work || case when fold_person <> '' then '|' || fold_person else '' end      as key,
  ceremony,
  category,
  year,
  won,
  (array_agg(work_type   order by id))[1]                                                   as work_type,
  (array_agg(work_tmdb_id order by id))[1]                                                  as work_tmdb_id,
  (array_agg(work_qid    order by id))[1]                                                   as work_qid,
  (array_agg(work_title  order by id))[1]                                                   as work_title,
  max(poster_path)                                                                          as poster_path,
  min(work_year)                                                                            as work_year,
  max(season_number)                                                                        as season_number,
  max(season_poster_path)                                                                   as season_poster_path,
  -- Les personnes de l'entrée, dans l'ordre d'ingestion ; vide quand le prix va à l'œuvre.
  coalesce(
    jsonb_agg(jsonb_build_object('tmdb_id', person_tmdb_id, 'name', person_name, 'profile_path', person_profile_path) order by id)
      filter (where person_name is not null),
    '[]'::jsonb)                                                                            as people,
  -- Un ordre stable pour la pagination par Range (PostgREST plafonne à 1 000 lignes).
  min(id)                                                                                   as id
from keyed
group by ceremony, category, year, won, fold_work, fold_person;

grant select on watching.award_entries to authenticated;
grant select on watching.award_entries to service_role;
