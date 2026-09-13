-- ═══════════════════════════════════════════════════════════════════════════
-- DÉCALAGE DES CRONS — plus jamais deux robots la même seconde
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI
-- Panne récurrente trouvée par le watchdog (12/09 12:00, 13/09 00:00 et 04:00) :
-- `football_sync_standings` → « Competitions fetch failed: Gateway Timeout » — un
-- 504 de l'API REST *Supabase* sur 13 lignes ; `watching-series-sync` mort sur un
-- select `media_items`. Plus aucune série synchronisée depuis le 12/09 20:00.
--
-- Cause probable : la collision. 12 crons sur 15 partaient à la minute :00.
-- À 00:00 et 12:00, trois fonctions edge démarraient la même seconde contre une
-- base Free (series-sync 0 */4, standings 0 */6, anime-cours 0 */6) ; le 1er du
-- mois à minuit, quatre. À confirmer dans Reports → Database (I/O, CPU).
--
-- QUOI
-- Chaque job reçoit sa propre minute. Vérifié : aucune paire (minute, heure) en
-- commun. Les cadences ne changent pas — un cron « toutes les 6 h » reste toutes
-- les 6 h, à :10 au lieu de :00. Le watchdog GitHub tourne à :20 : aucun cron n'y
-- est posé.
--
-- COMMENT
-- `cron.alter_job` ne touche qu'à l'horaire : la commande, le nom, l'état
-- restent. 15 jobs avant, 15 après → `expected-objects.json` ne bouge pas.
-- Idempotent : rejouer ne fait que réaffirmer les mêmes horaires.
--
-- ⚠️ La migration 20260906000100 (les 15 crons) recrée les jobs avec les ANCIENS
-- horaires si elle est rejouée sur une base vierge (restauration) ; celle-ci passe
-- après et les corrige. Les horaires de référence sont ICI.
-- ═══════════════════════════════════════════════════════════════════════════

do $stagger$
declare
  j record;
begin
  for j in
    select * from (values
      -- minute :00 — un seul locataire
      ('football-standings-6h',        '0 */6 * * *'),
      -- :05
      ('watching-series-sync-4h',      '5 */4 * * *'),
      -- :10
      ('watching-anime-cours-sync-6h', '10 */6 * * *'),
      -- :15 (heures distinctes)
      ('football-season-weekly',       '15 4 * * 1'),
      ('watching-trending-daily',      '15 5 * * *'),
      -- :22 (pas :20 — le watchdog)
      ('football-competitions-monthly','22 0 1 * *'),
      -- :25
      ('tennis-rankings-biweekly',     '25 10 1,15 * *'),
      -- :30
      ('football-wikidata-monthly',    '30 4 2 * *'),
      -- :35
      ('football-matches-hourly',      '35 14-23 * * *'),
      -- :40 — F1, trois moments distincts
      ('f1-race-weekend-sunday-18h',   '40 18 * * 0'),
      ('f1-race-weekend-sunday-22h',   '40 22 * * 0'),
      ('f1-race-weekend-monday-6h',    '40 6 * * 1'),
      -- :45
      ('football-teams-monthly',       '45 3 1 * *'),
      -- :50 (heures distinctes : 04h vs 08h/20h)
      ('watching-for-you-5d',          '50 4 */5 * *'),
      ('tennis-matches-daily',         '50 8,20 * * *')
    ) as t(jobname, schedule)
  loop
    if exists (select 1 from cron.job where jobname = j.jobname) then
      perform cron.alter_job(
        job_id   := (select jobid from cron.job where jobname = j.jobname),
        schedule := j.schedule
      );
    else
      raise notice 'stagger_crons: job % introuvable, ignoré', j.jobname;
    end if;
  end loop;
end
$stagger$;
