-- person_upcoming.season_number — LES NOUVELLES SAISONS DES GENS QUE TU SUIS (§11, 2026-09-17)
--
-- TMDB ne date qu'une PREMIÈRE diffusion dans les crédits d'une personne : un acteur suivi dans
-- une série qui revient n'entrait jamais dans « Upcoming ». Le robot demande maintenant à chaque
-- série récurrente d'une personne suivie son prochain épisode ; si c'est un épisode 1 (une saison
-- qui commence), la série entre avec la date de la première et le numéro de saison. NULL = un
-- film ou une première diffusion, comme avant.
alter table watching.person_upcoming add column if not exists season_number integer;
