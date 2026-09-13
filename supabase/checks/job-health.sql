-- ═══════════════════════════════════════════════════════════════════════════
-- MISE À JOUR DE internal.job_health — à lancer AVANT job-freshness.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Pour chaque fonction appelée dans les 6 dernières heures, on prend sa DERNIÈRE
-- réponse (call_log × _http_response) et on met la ligne à jour :
--   - réponse 2xx           → consecutive_failures = 0, last_status = 'ok'
--   - réponse ≥ 400 / null  → consecutive_failures + 1 (ou 1 si la ligne était 'ok')
-- Une requête déjà vue (même request_id) ne compte pas deux fois.
--
-- Sortie : les échecs ISOLÉS (1er échec), en INFORMATION — le workflow les
-- affiche et ne s'arrête pas. Les échecs répétés, c'est job-freshness.sql (B).
-- ═══════════════════════════════════════════════════════════════════════════

\pset tuples_only off
\pset format aligned

with last_response as (
  select distinct on (l.fn)
         l.fn, l.request_id, r.status_code, r.timed_out, r.error_msg, r.content, r.created
  from internal.call_log l
  join net._http_response r on r.id = l.request_id
  where l.called_at > now() - interval '6 hours'
  order by l.fn, r.created desc
),
classified as (
  select fn, request_id, created,
         (status_code is null or status_code >= 400 or timed_out) as failed,
         coalesce(status_code::text, 'pas de réponse')
           || case when error_msg is not null then ' · ' || left(error_msg, 100)
                   when status_code >= 400 then ' · ' || left(content, 100)
                   else '' end as detail
  from last_response
)
insert into internal.job_health (fn, consecutive_failures, last_status, last_detail, last_request_id, last_at, updated_at)
select c.fn,
       case when c.failed then 1 else 0 end,
       case when c.failed then 'error' else 'ok' end,
       c.detail, c.request_id, c.created, now()
from classified c
on conflict (fn) do update
set consecutive_failures = case
      when excluded.last_status = 'ok' then 0
      else internal.job_health.consecutive_failures + 1
    end,
    last_status     = excluded.last_status,
    last_detail     = excluded.last_detail,
    last_request_id = excluded.last_request_id,
    last_at         = excluded.last_at,
    updated_at      = now()
where internal.job_health.last_request_id is distinct from excluded.last_request_id;

-- ── Information : les premiers échecs (pas encore une alerte) ──────────────
select
  'ℹ️  1er échec — surveillé, pas alerté'         as info,
  fn                                              as objet,
  last_detail                                     as detail,
  to_char(last_at, 'YYYY-MM-DD HH24:MI')          as quand
from internal.job_health
where last_status = 'error' and consecutive_failures = 1
order by last_at desc;

-- ── Information : durée réelle de la dernière exécution de chaque fonction ──
-- Réserve owner (13/09) sur le décalage des crons : `football-standings-6h` part à
-- :00 et `watching-series-sync-4h` à :05 — standings doit donc FINIR en moins de
-- 5 min, sinon les deux se chevauchent quand même à 00:00 et 12:00. On imprime la
-- durée (appel → réponse) pour le savoir dès le premier passage. Pas une alerte.
select
  'ℹ️  durée du dernier appel'                       as info,
  l.fn                                               as objet,
  to_char(r.created - l.called_at, 'MI:SS')          as duree_min_sec,
  to_char(l.called_at, 'YYYY-MM-DD HH24:MI')         as lance_a
from internal.call_log l
join net._http_response r on r.id = l.request_id
where l.called_at > now() - interval '6 hours'
  and l.request_id in (
    select distinct on (fn) request_id from internal.call_log
    where called_at > now() - interval '6 hours'
    order by fn, called_at desc
  )
order by r.created - l.called_at desc;
