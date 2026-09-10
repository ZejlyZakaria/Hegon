-- ═══════════════════════════════════════════════════════════════════════════
-- GARDE ANTI-DÉRIVE DU SCHÉMA — le cliquet de la règle R10
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI CE FICHIER EXISTE
-- « Tout changement de schéma passe par une migration » est la règle qui protège
-- la reconstructibilité reconquise en phase 1. C'est aussi l'ancienne habitude —
-- modifier à la main dans l'éditeur SQL — qui avait produit 28 tables sans
-- migration. Sans garde, la règle ne tient que par la discipline.
--
-- ⚠️ POURQUOI PAS `supabase db diff --linked`
-- Testé le 2026-09-06 : il sort un diff massif et bruité pour des objets tous
-- présents dans le baseline. En cliquet, il serait rouge en permanence, donc
-- désactivé au bout d'une semaine.
--
-- ⚠️ LE PIÈGE ÉVITÉ ICI (vérifié le 2026-09-09)
-- Le baseline contient 138 `create index`, la base réelle en déclare ~250.
-- L'écart, ce sont les index IMPLICITES des clés primaires et des contraintes
-- `unique`. Comparer le FICHIER à la BASE rendrait le garde rouge dès le premier
-- jour — le piège même qu'on cherche à éviter. Ce garde compte donc UNIQUEMENT
-- dans la base, et compare à des valeurs de référence versionnées dans le repo
-- (`expected-objects.json`).
--
-- ⭐ POURQUOI LA LIGNE `colonnes` EST LA PLUS IMPORTANTE
-- Compter tables / policies / fonctions / index ne détecte PAS une colonne
-- ajoutée à la main — or c'est exactement le geste que R10 interdit. Sans la
-- mesure au niveau colonne, le garde serait aveugle à son propre cas d'usage.
--
-- USAGE
--   psql "$DB_URL" -f supabase/checks/schema-drift.sql
-- Sortie : une ligne par type d'objet, à comparer à `expected-objects.json`.
-- ═══════════════════════════════════════════════════════════════════════════

\pset tuples_only on
\pset format unaligned
\pset fieldsep ' '

select 'tables'   as objet, count(*)::text from pg_tables
  where schemaname in ('public', 'watching', 'sport')
union all
select 'colonnes', count(*)::text from information_schema.columns
  where table_schema in ('public', 'watching', 'sport')
union all
select 'policies', count(*)::text from pg_policies
  where schemaname in ('public', 'watching', 'sport')
union all
select 'fonctions', count(*)::text from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'watching', 'sport', 'internal')
union all
select 'index', count(*)::text from pg_indexes
  where schemaname in ('public', 'watching', 'sport')
union all
select 'crons', count(*)::text from cron.job where active
order by 1;
