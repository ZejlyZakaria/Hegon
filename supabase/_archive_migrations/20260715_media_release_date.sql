-- « Waiting for » — les films de la watchlist pas encore sortis.
--
-- On ne crée PAS une liste ni un flag : « Waiting for » est un CALCUL, pas une donnée. Un film est en
-- attente parce que sa date de sortie est dans le FUTUR — le jour où elle passe, il rejoint tout seul
-- « Want to Watch », sans trigger ni déplacement (même leçon que recently_watched).
--
-- Pour que ce calcul existe, il faut le FAIT : la date de sortie. On ne l'avait jamais stockée (seul
-- `year` l'était, trop grossier pour dire « sorti ou pas » à l'intérieur de l'année courante). Films
-- uniquement ; null pour séries/animes (leur modèle = les dates de saison).
--
-- Legacy-safe : les films déjà en watchlist n'ont pas cette colonne remplie → le code retombe sur le
-- `status` TMDB stocké (« Released » ou non). Aucun backfill obligatoire.

alter table watching.media_items
  add column if not exists release_date date;

comment on column watching.media_items.release_date is
  'Date de sortie du FILM (TMDB release_date). Null pour séries/animes et pour les vieux films (fallback sur status). Seule source du calcul « Waiting for » : release_date > aujourd''hui = pas encore sorti.';
