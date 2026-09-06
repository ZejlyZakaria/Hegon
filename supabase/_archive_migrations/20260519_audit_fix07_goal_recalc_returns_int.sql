-- Audit Opus re-review §3.2 — RPC recalc_goal_progress signature
-- v1 (fix03) : RETURNS void + check mode auto en JS (1 fetch supplémentaire si cache froid)
-- v2 (ici)  : RETURNS INT (nouveau progress ou -1 si mode != auto) + check mode dans SQL
--             → skip le getGoal() côté JS, 1 round-trip économisé sur cache froid
--
-- NOTE : Postgres n'autorise pas le changement de return type via CREATE OR REPLACE,
-- d'où le DROP préalable. Sans risque (function, pas table — zéro data loss).

DROP FUNCTION IF EXISTS recalc_goal_progress(uuid);

CREATE FUNCTION recalc_goal_progress(p_goal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_mode     text;
  v_total    integer;
  v_completed integer;
  v_progress integer;
BEGIN
  SELECT progress_mode INTO v_mode FROM goals WHERE id = p_goal_id;
  IF v_mode IS NULL OR v_mode <> 'auto' THEN
    RETURN -1;  -- caller sait : skip (manual mode ou goal supprimé)
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
    INTO v_total, v_completed
    FROM tasks WHERE goal_id = p_goal_id;

  IF v_total = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := ROUND((v_completed::numeric / v_total) * 100);
  END IF;

  UPDATE goals SET progress = v_progress WHERE id = p_goal_id;
  RETURN v_progress;
END;
$$;

GRANT EXECUTE ON FUNCTION recalc_goal_progress(uuid) TO authenticated;
