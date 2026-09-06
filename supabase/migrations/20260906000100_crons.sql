-- ═══════════════════════════════════════════════════════════════════════════
-- LES 15 CRONS DE HEGON — rapatriés dans le repo le 2026-09-06
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI CE FICHIER EXISTE
-- La phase 0 de l'audit a trouvé que 13 crons sur 14 n'existaient QUE dans la
-- base (il y en avait en réalité 15). Le repo ne pouvait donc pas reconstruire
-- HEGON : cloner + appliquer les migrations donnait une base sans aucune
-- alimentation automatique. Ce fichier ferme ce trou.
--
-- CE QUE FONT CES CRONS
-- Ils sont la moitié invisible de HEGON : l'app est une SPA cliente qui LIT la
-- base, et ces 15 tâches sont ce qui la REMPLIT, par derrière, via les edge
-- functions. Les deux systèmes ne se parlent que par des tables.
--
-- ⚠️ UN CRON NE CONTIENT JAMAIS DE CLÉ. Il appelle `internal.call_edge(fn)`
-- (schéma privé, security invoker, nom de fonction validé par regex). Le Bearer
-- que cette fonction porte est la clé PUBLIQUE `sb_publishable_` — un simple
-- laissez-passer de gateway. La fonction edge construit son propre client
-- privilégié depuis `HEGON_SECRET_KEY`, qui n'est jamais dans le SQL.
--
-- ⚠️ `net.http_post` est ASYNCHRONE. Un cron qui rapporte `succeeded` prouve
-- seulement que le SQL s'est exécuté, PAS que la function a réussi — c'est ce
-- qui a causé 40 h de panne silencieuse. La vérité est dans `net._http_response`
-- (conservé ~6 h seulement) ; `cron.job_run_details` ne montre que les
-- déclenchements, pas les résultats.
--
-- IDEMPOTENT : ce fichier peut être rejoué sans créer de doublon — chaque job
-- est déprogrammé s'il existe, puis reprogrammé.
--
-- ⚠️ Les horaires sont en UTC.
-- ═══════════════════════════════════════════════════════════════════════════

do $crons$
declare
  j record;
begin
  for j in
    select * from (values
      -- ── F1 ────────────────────────────────────────────────────────────────
      -- Les 3 mêmes appels à 3 moments : les résultats de course arrivent en
      -- différé, ce triplet est un filet, pas une erreur de configuration.
      ('f1-race-weekend-sunday-18h', '0 18 * * 0',
       E'select internal.call_edge(''f1_sync_race_results'');\n'
       'select internal.call_edge(''f1_sync_driver_standings'');\n'
       'select internal.call_edge(''f1_sync_constructor_standings'');'),

      ('f1-race-weekend-sunday-22h', '0 22 * * 0',
       E'select internal.call_edge(''f1_sync_race_results'');\n'
       'select internal.call_edge(''f1_sync_driver_standings'');\n'
       'select internal.call_edge(''f1_sync_constructor_standings'');'),

      ('f1-race-weekend-monday-6h', '0 6 * * 1',
       E'select internal.call_edge(''f1_sync_race_results'');\n'
       'select internal.call_edge(''f1_sync_driver_standings'');\n'
       'select internal.call_edge(''f1_sync_constructor_standings'');'),

      -- ── FOOTBALL ──────────────────────────────────────────────────────────
      ('football-competitions-monthly', '0 0 1 * *',
       'select internal.call_edge(''football_sync_competitions'');'),

      ('football-standings-6h', '0 */6 * * *',
       'select internal.call_edge(''football_sync_standings'');'),

      -- 10 passages/jour de 14h35 à 23h35 : la fenêtre des matchs européens.
      ('football-matches-hourly', '35 14-23 * * *',
       'select internal.call_edge(''football_sync_matches'');'),

      ('football-teams-monthly', '0 3 1 * *',
       'select internal.call_edge(''football_sync_teams'');'),

      -- Bascule de saison : recharge le calendrier COMPLET des compétitions et
      -- équipes suivies. `football_sync_matches` ne rafraîchit qu'une fenêtre
      -- de −4/+10 jours et raterait une nouvelle saison entière.
      ('football-season-weekly', '15 4 * * 1',
       'select internal.call_edge(''football_sync_season'');'),

      -- Palmarès des compétitions depuis Wikidata (SPARQL, sans clé).
      ('football-wikidata-monthly', '30 4 2 * *',
       'select internal.call_edge(''football_sync_wikidata'');'),

      -- ── TENNIS ────────────────────────────────────────────────────────────
      ('tennis-matches-daily', '0 8,20 * * *',
       'select internal.call_edge(''tennis_sync_matches'');'),

      ('tennis-rankings-biweekly', '0 10 1,15 * *',
       'select internal.call_edge(''tennis_sync_ranking'');'),

      -- ── WATCHING ──────────────────────────────────────────────────────────
      ('watching-series-sync-4h', '0 */4 * * *',
       'select internal.call_edge(''watching-series-sync'');'),

      ('watching-anime-cours-sync-6h', '0 */6 * * *',
       'select internal.call_edge(''watching-anime-cours-sync'');'),

      ('watching-trending-daily', '0 5 * * *',
       'select internal.call_edge(''watching-trending-refresh'');'),

      -- Recommandations « For You » : recalcul tous les 5 jours vers
      -- `watching.for_you_cache`.
      ('watching-for-you-5d', '0 4 */5 * *',
       'select internal.call_edge(''for-you-refresh'');')
    ) as t(jobname, schedule, command)
  loop
    if exists (select 1 from cron.job where jobname = j.jobname) then
      perform cron.unschedule(j.jobname);
    end if;
    perform cron.schedule(j.jobname, j.schedule, j.command);
  end loop;
end
$crons$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFIER APRÈS APPLICATION — doit renvoyer 15 lignes, toutes `active = true`
--   select jobname, schedule, active from cron.job order by jobname;
--
-- ⚠️ Ce que ce fichier ne couvre PAS : le trigger sur `auth.users` qui appelle
-- `notify-new-signup` (ce n'est pas un cron). Et 4 edge functions n'ont aucun
-- déclencheur : `f1_seed_drivers`, `f1_seed_initial`, `f1_enrich_last_winners`
-- (amorces à usage unique, normal) et `tennis_sync_played_matches`, qui n'a NI
-- cron NI appelant dans le code — candidate à la purge, à vérifier avant
-- suppression.
-- ═══════════════════════════════════════════════════════════════════════════
