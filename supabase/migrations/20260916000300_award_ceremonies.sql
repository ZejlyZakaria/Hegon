-- Le Musée — LES CÉRÉMONIES elles-mêmes (édition, date), pour « in 23 days » (owner, 2026-09-16)
--
-- Wikidata connaît chaque cérémonie comme un item : « 98th Academy Awards » (P31 = Q16913666,
-- P585 = 2026-03-15, P393 = 98), « 78th Primetime Emmy Awards » (P31 = Q115915866, P585 =
-- 2026-09-14). Le robot les relève à chaque passage (une requête, une seconde) : la date de la
-- prochaine cérémonie se lit, elle ne se saisit pas. Référence globale, lecture authentifiée.
--
-- Ce que la page en fait : dès que des NOMMÉS existent pour une cérémonie dont la date est future,
-- la section « This year » s'affiche en tête de la page Awards avec le compte à rebours ; le
-- lendemain de la cérémonie, elle disparaît et les lauréats coulent dans les catégories.

create table if not exists watching.award_ceremonies (
  ceremony   text not null check (ceremony in ('oscars', 'emmys')),
  year       integer not null,          -- année de la cérémonie, la clé que porte watching.awards
  edition    integer,                   -- 98
  held_on    date,                      -- P585
  qid        text,
  synced_at  timestamptz not null default now(),
  primary key (ceremony, year)
);

alter table watching.award_ceremonies enable row level security;
create policy award_ceremonies_read on watching.award_ceremonies for select to authenticated using (true);
grant select on watching.award_ceremonies to authenticated;
grant all on watching.award_ceremonies to service_role;

-- VÉRIFIER après un passage du robot : select * from watching.award_ceremonies order by year desc limit 4;
