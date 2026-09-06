# Migrations archivées — historique, PLUS JAMAIS rejouées

Ces **105 fichiers** sont l'historique des changements de schéma d'avril à août 2026. Ils sont
conservés pour la traçabilité : ils racontent *pourquoi* la base a la forme qu'elle a.

## Pourquoi ils ont été sortis de `supabase/migrations/`

La phase 0 de l'audit a mesuré que **ces 105 fichiers ne créaient que 36 des 64 tables réelles**.
Tout `Tasks`, tout `F1`, tout `Tennis` et l'essentiel de `Football` avaient été appliqués à la main,
directement dans le SQL Editor, sans jamais être écrits en migration. Ils n'étaient donc plus un
référentiel — un journal incomplet.

Pire : la table de suivi `supabase_migrations.schema_migrations` était **vide**. Un `supabase db push`
aurait tenté de les rejouer intégralement sur une base qui possédait déjà les objets — la plupart
auraient échoué, et celles contenant un `drop` ou un `truncate` auraient fait de vrais dégâts.

## Ce qui les remplace

Un **baseline** capturé depuis la base réelle le 2026-09-06 :
`supabase/migrations/20260906000000_baseline.sql` — 68 tables, l'état vrai — plus
`20260906000100_crons.sql` pour les 15 tâches planifiées, qui n'existaient elles aussi que dans la base.

À partir de là, le flux normal reprend : `supabase migration new` → écrire le SQL → `supabase db push`.

## ⛔ Ne jamais les remettre dans `supabase/migrations/`

Ils rejoueraient par-dessus le baseline. Ils sont ici pour être **lus**, pas exécutés.
