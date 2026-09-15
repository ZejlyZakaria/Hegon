-- Le Musée — deux catégories Emmy de plus : directing + writing for a COMEDY series.
-- Le whitelist du 2026-09-15 n'avait ces deux métiers que pour le drama ; une comédie primée
-- (Widow's Bay, 2026) n'y comptait que ses acteurs. QIDs relevés le 2026-09-15.
-- Données seulement, pas d'objet : le cliquet expected-objects ne bouge que sur _migrations_through.
-- Remplir ensuite :
--   select internal.call_edge('watching-awards-sync',
--     '{"ceremony":"emmys","since":1949,"categories":["directing_comedy","writing_comedy"]}');

insert into watching.award_categories (key, ceremony, label, subject, rank, qids, since, portrait) values
  ('directing_comedy', 'emmys', 'Directing for a Comedy Series', 'person', 18, '{Q1277961}', 1959, true),
  ('writing_comedy',   'emmys', 'Writing for a Comedy Series',   'person', 19, '{Q3045762}', 1959, false)
on conflict (key) do update set
  ceremony = excluded.ceremony, label = excluded.label, subject = excluded.subject,
  rank = excluded.rank, qids = excluded.qids, since = excluded.since, portrait = excluded.portrait;
