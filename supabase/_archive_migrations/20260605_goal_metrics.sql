-- Goal metrics — auto-progress driven by a cross-module ACTIVITY COUNT
-- (e.g. "Watch 50 films in 2026"). Module-agnostic by design so Books / Sport
-- plug in later with zero refactor.
--
-- Model: a goal's AUTO progress is computed from EITHER linked tasks (existing)
-- OR a metric (new) — never both. The presence of `metric_module` selects the
-- source. Manual goals are untouched. Existing auto (task) goals are untouched.

-- ── 1. Metric columns on goals ────────────────────────────────────────────────
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS metric_module text,   -- 'watching'  (later: 'books', 'sport'…)
  ADD COLUMN IF NOT EXISTS metric_key    text,   -- 'films' | 'series' | 'anime' | 'titles'
  ADD COLUMN IF NOT EXISTS metric_period text,   -- 'year' | 'all_time'
  ADD COLUMN IF NOT EXISTS metric_year   int,    -- calendar year when period = 'year'
  ADD COLUMN IF NOT EXISTS metric_target int;    -- count to reach (e.g. 50)

-- ── 2. Extend the recalc RPC — branch metric vs tasks ─────────────────────────
-- search_path now includes `watching` so we can count media_items.
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
