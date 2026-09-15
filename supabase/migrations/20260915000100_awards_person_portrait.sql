-- ═══════════════════════════════════════════════════════════════════════════
-- Le Musée, suite — le PORTRAIT pour les catégories à lauréat unique (owner, 2026-09-15)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- « Best Actor » récompense une personne, pas un film : la tuile montre son portrait, son nom, et
-- le film en ligne méta ; l'état (vu / pas vu, ta note) reste celui du film, le seul objet que la
-- bibliothèque connaît. Limité aux catégories à UN lauréat (acting + direction) : un portrait
-- unique mentirait pour un scénario à trois noms ou un mixage son à quatre.
--
--   · awards.person_profile_path — la photo TMDB (`person/{id}`), remplie par le robot comme
--     poster_path ; NULL = pas encore enrichi, '' = TMDB n'en a pas (repli sur l'affiche).
--   · award_categories.portrait — la catégorie s'affiche par le portrait.

alter table watching.awards add column if not exists person_profile_path text;
alter table watching.award_categories add column if not exists portrait boolean not null default false;

update watching.award_categories set portrait = true where key in (
  'best_director', 'best_actor', 'best_actress', 'best_supporting_actor', 'best_supporting_actress',
  'lead_actor_drama', 'lead_actress_drama', 'lead_actor_comedy', 'lead_actress_comedy',
  'lead_actor_limited', 'lead_actress_limited',
  'supporting_actor_drama', 'supporting_actress_drama', 'supporting_actor_comedy', 'supporting_actress_comedy',
  'directing_drama'
);

-- VÉRIFIER : select count(*) from watching.award_categories where portrait;   -- 16
