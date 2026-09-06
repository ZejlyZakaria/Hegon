-- Books → Goals metric. Extends the goal recalc RPC with a `books` branch so a
-- goal like "Read 24 books in 2026" auto-fills as books are marked read. Mirrors
-- the `watching` branch added in 20260605_goal_metrics.sql. `books` lives in the
-- public schema (already on the search_path) → no schema change needed.
--
-- Fully backward-compatible: watching / task / manual goals are untouched.

DROP FUNCTION IF EXISTS recalc_goal_progress(uuid);

CREATE FUNCTION recalc_goal_progress(p_goal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, watching
AS $$
DECLARE
  v_mode      text;
  v_user      uuid;
  v_mod       text;
  v_key       text;
  v_period    text;
  v_year      int;
  v_target    int;
  v_total     integer;
  v_completed integer;
  v_count     integer;
  v_progress  integer;
BEGIN
  SELECT progress_mode, user_id, metric_module, metric_key, metric_period, metric_year, metric_target
    INTO v_mode, v_user, v_mod, v_key, v_period, v_year, v_target
    FROM goals WHERE id = p_goal_id;

  IF v_mode IS NULL OR v_mode <> 'auto' THEN
    RETURN -1;  -- manual mode or goal deleted → caller skips
  END IF;

  -- ── Metric-driven (cross-module count) ──────────────────────────────────────
  IF v_mod IS NOT NULL THEN
    IF v_mod = 'watching' THEN
      SELECT COUNT(*) INTO v_count
        FROM watching.media_items m
        WHERE m.user_id = v_user
          AND m.watched = true
          AND m.is_reference IS NOT TRUE
          AND (v_key = 'titles' OR m.type = CASE v_key
                 WHEN 'films'  THEN 'film'
                 WHEN 'series' THEN 'serie'
                 WHEN 'anime'  THEN 'anime'
               END)
          AND (v_period <> 'year'
               OR (m.watched_at IS NOT NULL AND EXTRACT(YEAR FROM m.watched_at) = v_year));

    ELSIF v_mod = 'books' THEN
      SELECT COUNT(*) INTO v_count
        FROM books b
        WHERE b.user_id = v_user
          AND b.status = 'read'
          AND (v_period <> 'year'
               OR (b.finished_at IS NOT NULL AND EXTRACT(YEAR FROM b.finished_at) = v_year));

    ELSE
      v_count := 0;  -- unknown module (future-proof) → no progress
    END IF;

    IF v_target IS NULL OR v_target <= 0 THEN
      v_progress := 0;
    ELSE
      v_progress := LEAST(ROUND((v_count::numeric / v_target) * 100), 100);
    END IF;

    UPDATE goals SET progress = v_progress WHERE id = p_goal_id;
    RETURN v_progress;
  END IF;

  -- ── Task-driven (existing behaviour, unchanged) ─────────────────────────────
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
