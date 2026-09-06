-- Status type column + is_completed auto-derivation
-- Adds a `type` field to statuses that determines the circle icon style.
-- is_completed is now auto-derived from type via trigger.

-- ── 1. Add type column ────────────────────────────────────────────────────────
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'todo'
  CHECK (type IN ('backlog', 'todo', 'in_progress', 'done', 'cancelled'));

-- ── 2. Migrate existing rows (infer type from name) ───────────────────────────
UPDATE public.statuses SET type =
  CASE
    WHEN lower(trim(name)) = 'backlog'                        THEN 'backlog'
    WHEN lower(trim(name)) IN ('to do', 'todo')               THEN 'todo'
    WHEN lower(trim(name)) = 'in progress'                    THEN 'in_progress'
    WHEN lower(trim(name)) IN ('in review', 'review')         THEN 'in_progress'
    WHEN lower(trim(name)) IN ('qa', 'testing', 'test')       THEN 'in_progress'
    WHEN lower(trim(name)) IN ('done', 'completed')           THEN 'done'
    WHEN lower(trim(name)) IN ('cancelled', 'canceled')       THEN 'cancelled'
    WHEN is_completed = true                                  THEN 'done'
    ELSE 'todo'
  END;

-- ── 3. Trigger: auto-derive is_completed from type ───────────────────────────
CREATE OR REPLACE FUNCTION public.sync_status_is_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_completed := NEW.type IN ('done', 'cancelled');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_status_is_completed ON public.statuses;
CREATE TRIGGER trg_sync_status_is_completed
  BEFORE INSERT OR UPDATE OF type ON public.statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_status_is_completed();

-- ── 4. Sync existing rows with new trigger logic ──────────────────────────────
UPDATE public.statuses SET is_completed = (type IN ('done', 'cancelled'));
