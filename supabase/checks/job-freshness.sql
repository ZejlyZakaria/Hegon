-- ═══════════════════════════════════════════════════════════════════════════
-- LE CHIEN DE GARDE DES 15 CRONS — livrable en code de la phase 2
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI CE FICHIER EXISTE
-- La pire panne connue de HEGON a duré 40 heures et personne ne l'a vue. La
-- cause est mécanique : `net.http_post` est ASYNCHRONE, donc un cron qui
-- rapporte `succeeded` prouve seulement que le SQL s'est exécuté — PAS que la
-- fonction edge a réussi. Les 20 edge functions n'ont aucune ligne de Sentry
-- (vérifié le 2026-09-09) ; elles écrivent 55 `console.error` dans des logs que
-- personne n'ouvre. Ce fichier est l'œil qui manquait.
--
-- CE QU'IL RENVOIE
-- Zéro ligne = tout va bien. Chaque ligne renvoyée est une alerte.
-- Le workflow `.github/workflows/watchdog.yml` échoue si la sortie n'est pas vide.
--
-- ⚠️ POURQUOI TOUTES LES 6 HEURES, ET PAS UNE FOIS PAR JOUR
-- `net._http_response` — la SEULE source qui dise si la fonction edge a vraiment
-- répondu — n'est conservée que ~6 h. Un contrôle quotidien en raterait 18 sur 24.
-- La cadence n'est pas un réglage de confort : c'est ce qui rend la section B
-- exhaustive.
--
-- ⚠️ POURQUOI LA SECTION C NE COUVRE PAS LES 15 JOBS
-- Football, F1 et Tennis ont des INTERSAISONS. Un contrôle de fraîcheur sur
-- `f1_driver_standings` hurlerait tout l'hiver, et un garde qui crie au loup
-- finit désactivé — c'est exactement ce qui a disqualifié `db diff --linked`.
-- La section C ne surveille donc que les tables SANS saison. Les tables
-- saisonnières restent couvertes par les sections A et B, qui, elles, ne
-- dépendent d'aucun calendrier.
-- ═══════════════════════════════════════════════════════════════════════════

\pset tuples_only off
\pset format aligned

-- ── A · Un cron a échoué au niveau SQL ─────────────────────────────────────
-- Attrape : fonction `internal.call_edge` absente, nom de fonction rejeté par
-- la regex, extension `pg_net` en panne, base indisponible.
select
  'A · CRON EN ÉCHEC'                                as alerte,
  j.jobname                                          as objet,
  d.status                                           as detail,
  coalesce(left(d.return_message, 120), '')          as message,
  to_char(d.start_time, 'YYYY-MM-DD HH24:MI')        as quand
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where d.start_time > now() - interval '6 hours'
  and d.status is distinct from 'succeeded'

union all

-- ── B · La DERNIÈRE réponse d'une fonction edge est une erreur ─────────────
-- ⭐ C'EST LA SECTION QUI AURAIT VU LES 40 HEURES. Le cron était `succeeded`
-- pendant que la fonction renvoyait une erreur — l'écart exact entre « le SQL
-- est parti » et « le travail a été fait ».
--
-- Réécrite le 2026-09-12 après la première vraie alerte (500 Gateway Timeout
-- de football_sync_standings, cron de 12:00), qui a révélé deux défauts :
--   1. `net._http_response` ne garde pas l'URL → « fonction non identifiée ».
--      Corrigé par `internal.call_log`, écrit par `call_edge` à chaque appel
--      (migration 20260912000000).
--   2. Toute réponse non-2xx des 6 dernières heures alertait, même si la
--      fonction avait réussi depuis → un timeout passager par semaine et le
--      garde crie au loup. On ne regarde plus que la DERNIÈRE réponse de
--      chaque fonction : l'état courant, pas l'historique.
-- Nuance assumée : pour un cron à 6 h, un échec isolé alerte quand même une
-- fois (c'est sa seule réponse dans la fenêtre). C'est voulu — un 500 sur les
-- classements mérite d'être vu une fois, pas six.
select
  'B · FONCTION EDGE EN ERREUR'                      as alerte,
  last.fn                                            as objet,
  coalesce(last.status_code::text, 'pas de réponse') as detail,
  coalesce(left(last.error_msg, 120), left(last.content, 120), '') as message,
  to_char(last.created, 'YYYY-MM-DD HH24:MI')        as quand
from (
  select distinct on (l.fn)
         l.fn, r.status_code, r.error_msg, r.content, r.created, r.timed_out
  from internal.call_log l
  join net._http_response r on r.id = l.request_id
  where l.called_at > now() - interval '6 hours'
  order by l.fn, r.created desc
) last
where last.status_code is null or last.status_code >= 400 or last.timed_out

union all

-- ── C · La donnée n'a pas bougé alors qu'elle aurait dû ───────────────────
-- Le contrôle par le RÉSULTAT, pas par le mécanisme : peu importe ce que le
-- cron rapporte, la table qu'il alimente doit avoir bougé. C'est la seule
-- mesure durable (aucune rétention de 6 h) et la seule qui attrape un cron qui
-- réussit en écrivant zéro ligne.
--
-- Seuils = 2 × la cadence, volontairement généreux : un garde qui hurle pour
-- rien finit désactivé.
select * from (
  select
    'C · DONNÉE PÉRIMÉE'                             as alerte,
    t.objet,
    round(extract(epoch from (now() - t.dernier)) / 3600)::text || ' h'  as detail,
    'seuil ' || t.seuil_h || ' h · cron ' || t.job    as message,
    to_char(t.dernier, 'YYYY-MM-DD HH24:MI')         as quand
  from (
    -- TMDB : aucune saison, la série tourne toute l'année. Cron toutes les 4 h.
    select 'watching.media_items'      as objet, 'watching-series-sync-4h'      as job,
           8   as seuil_h, (select max(last_synced_at) from watching.media_items) as dernier
    union all
    -- Tendances TMDB, quotidien.
    select 'watching.trending_cache',  'watching-trending-daily',
           48,  (select max(refreshed_at) from watching.trending_cache)
    union all
    -- ⛔ `watching.anime_cours` a été RETIRÉ de cette section le 2026-09-12 — c'était
    -- la PREMIÈRE alerte réelle du watchdog, et c'était une FAUSSE ALERTE (3 runs
    -- rouges d'affilée, #8 #9 #10, sans aucun changement de code).
    --
    -- La cause est un défaut de PRINCIPE, pas de seuil : `watching-anime-cours-sync`
    -- est une synchro idempotente avec une sortie anticipée « nothing stale » qui
    -- N'ÉCRIT RIEN. Elle ne re-résout un anime EN COURS que toutes les 12 h, et un
    -- anime TERMINÉ que toutes les SEMAINES (`FINISHED_STALE_MS = 7 j`). Quand
    -- aucun des 75 n'est dû, `max(resolved_at)` reste figé — légitimement, jusqu'à
    -- 7 jours. Un seuil de 12 h (2× la cadence du cron) était donc incompatible avec
    -- le design de la fonction elle-même : garanti rouge dès que tous les animes
    -- sont à jour, c'est-à-dire précisément quand tout va bien.
    --
    -- ⭐ LA RÈGLE QUE ÇA ÉTABLIT POUR TOUTE CETTE SECTION :
    --    « le job a tourné » et « la donnée a changé » sont DEUX signaux différents.
    --    La section C ne mesure que le second. Elle ne convient donc qu'aux jobs qui
    --    ÉCRIVENT À CHAQUE PASSAGE — `series-sync` (estampille son lot à chaque run),
    --    `trending`, `for_you` (caches réécrits par nature). Une synchro avec un
    --    chemin « rien à faire » n'a PAS sa place ici : sa vie se mesure en A et B
    --    (le cron s'est déclenché, la fonction a répondu 200) — vérifié silencieux
    --    pendant les 3 runs rouges, donc le robot était vivant.
    --
    -- ⇒ Pour rendre ce job observable en C un jour : lui faire écrire un
    --    « heartbeat » (dernier passage, écrit MÊME quand il n'y a rien à faire)
    --    et lire cet horodatage-là, pas `resolved_at`. Demande une migration.
    -- Recommandations, tous les 5 jours.
    select 'watching.for_you_cache',   'watching-for-you-5d',
           240, (select max(computed_at) from watching.for_you_cache)
    -- ⛔ `sport.football_competitions` a été RETIRÉ de cette section le 2026-09-09.
    -- Sa colonne `updated_at` est un `default now()` — et le schéma ne contient
    -- AUCUN trigger (0 sur 68 tables), tandis que `football_sync_competitions`
    -- ne l'écrit jamais explicitement (vérifié). La colonne est donc figée à la
    -- date d'insertion : la surveiller produirait une alerte permanente, c'est-à-dire
    -- un garde qu'on finirait par désactiver.
    -- ⇒ Le succès du cron mensuel `football-competitions-monthly` n'est PAS
    --    observable par le résultat aujourd'hui. Il reste couvert par A et B.
    --    Pour le rendre observable : faire écrire `updated_at = now()` par l'upsert.
  ) t
  where t.dernier is null
     or t.dernier < now() - (t.seuil_h || ' hours')::interval
) c

order by 1, 5 desc;
