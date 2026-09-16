-- ═══════════════════════════════════════════════════════════════════════════
-- watching.people_ranking(kind, limit, offset) — TES PERSONNES LES PLUS VUES, PAGINÉES EN SQL
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Library › People (§11) classe les acteurs / voix / réalisateurs les plus vus. Jusqu'ici ce
-- classement se calculait dans le navigateur, après avoir téléchargé le `cast_members` ENTIER de
-- chaque titre de la bibliothèque (getPeopleCounts) — des milliers de noms pour en montrer vingt.
-- Décision owner (17/09) : « See more » par 50 avec un appel base à chaque page, pas un tri front.
--
-- LA MÊME RÈGLE QUE getPeopleCounts (le rang « #3 de tes acteurs » de la page Person doit rester
-- d'accord avec cette liste, au titre près) :
--   · les titres qui comptent = temps d'écran réel : watched · in_progress · paused · dropped ;
--   · 'actors' = cast des films et séries, 'voice' = cast des animes (les seiyuu ne sont pas le
--     même axe), 'directing' = `directors`, tous types ;
--   · un « Self » / « (uncredited) » n'est pas montré sur la filmographie, donc ne compte pas
--     (cast seulement, comme getPersonBundle) ;
--   · une personne listée deux fois sur un titre compte une fois pour ce titre.
--
-- `security invoker` (le défaut) : la fonction lit media_items avec les droits de l'appelant —
-- org_isolation s'applique. `p_user` défaut = auth.uid() ; passer un autre id ne montre rien de
-- plus que ce que RLS laisse voir.

create or replace function watching.people_ranking(
  p_kind   text,
  p_limit  integer default 50,
  p_offset integer default 0,
  p_user   uuid    default auth.uid()
)
returns table (id integer, name text, profile_url text, n integer)
language sql
stable
set search_path = ''
as $$
  with credits as (
    select
      m.id                        as item_id,
      (p.value->>'id')::integer   as person_id,
      p.value->>'name'            as person_name,
      p.value->>'profile_url'     as person_profile,
      p.value->>'character'       as part
    from watching.media_items m
    cross join lateral jsonb_array_elements(
      case when p_kind = 'directing' then coalesce(m.directors, '[]'::jsonb) else m.cast_members end
    ) as p(value)
    where m.user_id = p_user
      and (m.watched or m.in_progress or m.paused or m.dropped)
      and (p_kind <> 'voice'  or m.type = 'anime')
      and (p_kind <> 'actors' or m.type <> 'anime')
      and (p.value->>'id') is not null
  ),
  kept as (
    select * from credits
    where p_kind = 'directing'
       or part is null
       or (part !~* '^(self|himself|herself|themselves)\M' and part !~* '\(uncredited\)')
  )
  select
    person_id                                   as id,
    max(person_name)                            as name,
    max(person_profile)                         as profile_url,
    count(distinct item_id)::integer            as n
  from kept
  group by person_id
  having count(distinct item_id) >= 2
  order by n desc, max(person_name) asc
  limit p_limit offset p_offset
$$;

grant execute on function watching.people_ranking(text, integer, integer, uuid) to authenticated;
grant execute on function watching.people_ranking(text, integer, integer, uuid) to service_role;

-- VÉRIFIER : select * from watching.people_ranking('actors', 5, 0, '<ton user id>');
