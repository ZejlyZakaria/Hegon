-- §3.2 Goal progress recalculation — RPC (not trigger)
-- Replaces 2 client-side round trips (SELECT tasks + UPDATE goals) with 1 DB call.
-- Decision: explicit RPC > invisible trigger ("explicite > magique"). Audit 2026-05-18 Opus pivot.

CREATE OR REPLACE FUNCTION recalc_goal_progress(p_goal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     integer;
  v_completed integer;
  v_progress  integer;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
  INTO v_total, v_completed
  FROM tasks
  WHERE goal_id = p_goal_id;

  IF v_total = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := ROUND((v_completed::numeric / v_total) * 100);
  END IF;

  UPDATE goals
  SET progress = v_progress
  WHERE id = p_goal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION recalc_goal_progress(uuid) TO authenticated;
