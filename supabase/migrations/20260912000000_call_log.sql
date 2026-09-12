-- ═══════════════════════════════════════════════════════════════════════════
-- internal.call_log — le journal des appels aux edge functions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI
-- Première vraie alerte du watchdog, 2026-09-12 16:00 : « B · FONCTION EDGE EN
-- ERREUR — (fonction non identifiée) — 500 Gateway Timeout ». Il a fallu
-- retrouver le coupable (football_sync_standings, cron de 12:00) en cherchant le
-- texte de l'erreur dans le code. Cause : `net._http_response` garde le statut,
-- le corps et l'heure d'une réponse, mais PAS l'URL appelée. On savait qu'une
-- fonction avait échoué, pas laquelle.
--
-- CE QUE ÇA CHANGE
-- `internal.call_edge` écrit désormais (request_id, fn) à chaque appel. Le
-- watchdog joint `net._http_response.id = call_log.request_id` et peut :
--   1. NOMMER la fonction en erreur ;
--   2. ne signaler que si sa DERNIÈRE réponse est une erreur — un timeout
--      passager suivi d'un succès n'alerte plus (un garde qui crie au loup
--      finit désactivé).
--
-- RÉTENTION : la fonction purge elle-même au-delà de 7 jours (le watchdog
-- regarde 6 h ; une semaine laisse de quoi enquêter à la main). Pas de cron
-- supplémentaire.
--
-- HORS DU GARDE ANTI-DÉRIVE, volontairement : `schema-drift.sql` ne compte
-- que public / watching / sport. `internal` est de la plomberie ;
-- `expected-objects.json` ne bouge pas.
--
-- IDEMPOTENT : rejouable sans dégât.
-- ⚠️ La procédure de restauration (supabase/backup/RESTORE.md §6c) doit
-- re-pointer CETTE version de la fonction, pas l'ancienne.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists internal.call_log (
  request_id bigint primary key,
  fn         text        not null,
  called_at  timestamptz not null default now()
);

create index if not exists call_log_called_at_idx on internal.call_log (called_at);

-- `internal` n'est pas exposé par PostgREST ; RLS activée quand même, par
-- cohérence avec les 68 autres tables (aucune policy = aucun accès API).
alter table internal.call_log enable row level security;

CREATE OR REPLACE FUNCTION "internal"."call_edge"("fn" "text", "payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  gateway_key constant text := 'sb_publishable_Fs1GCChzoqGOal70bXGEIA_qbWyhJsQ';
  req_id bigint;
begin
  if fn !~ '^[a-z0-9_-]+$' then
    raise exception 'call_edge: invalid function name %', fn;
  end if;

  select net.http_post(
    url := 'https://femvhonlpafdajyamvcu.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || gateway_key
    ),
    body := payload,
    timeout_milliseconds := 300000
  ) into req_id;

  -- Journal : `net._http_response` ne garde pas l'URL, on garde le nom ici.
  insert into internal.call_log (request_id, fn) values (req_id, fn);

  -- Auto-nettoyage, 7 jours.
  delete from internal.call_log where called_at < now() - interval '7 days';

  return req_id;
end;
$_$;
