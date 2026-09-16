-- Le Musée — LA SAISON primée, pour les Emmys (owner, 2026-09-16)
--
-- Ce que le canon dit vraiment, c'est « Succession S4 a gagné en 2024 », pas « Succession ».
-- emmys.com ne donne pas la saison, mais la règle d'éligibilité des Emmys est précise : la saison
-- diffusée entre le 1er juin de l'année précédente et le 31 mai de l'année de cérémonie. La fiche
-- TMDB `tv/{id}` (déjà appelée pour l'affiche) liste les saisons avec leur date → le robot déduit
-- la saison et garde son affiche. À l'écran : l'affiche de la saison et la puce « S4 » en bas à
-- gauche, celle de la bande Seasons de la fiche.
--   season_number : NULL = pas encore regardé ; 0 = aucune saison dans la fenêtre (on ne redemande pas).

alter table watching.awards add column if not exists season_number integer;
alter table watching.awards add column if not exists season_poster_path text;
