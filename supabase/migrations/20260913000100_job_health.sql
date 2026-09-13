-- ═══════════════════════════════════════════════════════════════════════════
-- internal.job_health — la mémoire du watchdog entre deux passages
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI
-- La section B du watchdog alertait au PREMIER échec d'une fonction edge. Un cron à
-- 6 h qui rate une fois, c'est 12 h de données au pire — pas une alerte ; et un
-- garde qui sonne pour un 504 passager finit désactivé (leçon `db diff`). Mais
-- `net._http_response` ne vit que ~6 h : le watchdog ne peut pas « se souvenir »
-- de l'échec précédent sans une table à lui.
--
-- QUOI
-- Une ligne par fonction : combien d'échecs consécutifs, quel dernier statut,
-- quand. Le watchdog (job-health.sql) la met à jour à chaque passage depuis
-- call_log × _http_response, puis la section B n'alerte qu'à partir de
-- `consecutive_failures >= 2`. Un échec isolé s'imprime en information.
--
-- `last_request_id` : le même passage rejoué deux fois (workflow_dispatch à la
-- main) ne doit pas compter deux fois le même échec — on ne met à jour que si la
-- dernière requête vue est nouvelle.
--
-- Hors garde anti-dérive (schéma `internal`, non compté). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists internal.job_health (
  fn                   text        primary key,
  consecutive_failures integer     not null default 0,
  last_status          text        not null,          -- 'ok' | 'error'
  last_detail          text,                          -- code HTTP ou message, pour lire l'alerte
  last_request_id      bigint      not null,
  last_at              timestamptz not null,
  updated_at           timestamptz not null default now()
);

alter table internal.job_health enable row level security;
