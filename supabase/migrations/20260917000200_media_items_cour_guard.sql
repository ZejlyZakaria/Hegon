-- media_items : cour_years / cour_ratings n'ont de sens que sur un ANIME (2026-09-17, bloc autonomie)
--
-- Le baseline garde `media_items_cour_columns_series_only` : les films sont gardés, pas les
-- séries — or un découpage en cours n'existe que pour l'overlay anime, et la lentille MediaView
-- le lirait sur une série. Trou noté au backlog Watching (« contrainte type-conditionnelle
-- manquante »). État réel avant : 774 lignes non-anime portent `{}` (le défaut), aucune valeur
-- réelle. La nouvelle contrainte tolère le vide et interdit le reste ; l'ancienne, plus faible,
-- tombe (une seule vérité).
alter table watching.media_items drop constraint if exists media_items_cour_columns_series_only;
alter table watching.media_items
  add constraint media_items_cour_only_anime
  check (
    type = 'anime'
    or (coalesce(cour_years, '{}'::jsonb) = '{}'::jsonb and coalesce(cour_ratings, '{}'::jsonb) = '{}'::jsonb)
  ) not valid;
-- `not valid` puis validate : la vérification des lignes existantes se fait sans verrou exclusif long.
alter table watching.media_items validate constraint media_items_cour_only_anime;
