-- Role-aware directing rankings. Creator and production credits are not directors.
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
      and (m.release_date is null or m.release_date <= current_date)
      and (m.release_date is not null or m.year is null or m.year <= extract(year from current_date))
      and (p_kind <> 'voice'  or m.type = 'anime')
      and (p_kind <> 'actors' or m.type <> 'anime')
      and (p.value->>'id') is not null
      and (p_kind <> 'directing' or p.value->>'role' = 'director'
           or (m.type = 'film' and p.value->>'role' is null))
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

