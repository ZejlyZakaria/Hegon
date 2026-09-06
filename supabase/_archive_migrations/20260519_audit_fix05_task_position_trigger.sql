-- Sprint 7 §1.3 — Race condition sur position à la création
-- Problème : SELECT MAX(position) puis INSERT position = max+1 en deux requêtes séparées.
-- Deux users qui créent simultanément → même position.
-- Fix : trigger BEFORE INSERT qui calcule max+1 atomiquement côté DB.
-- Le service ne passe plus de position → trigger gère.

-- ── Tasks ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_task_position()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.position IS NULL THEN
    SELECT COALESCE(MAX(position), 0) + 1
    INTO NEW.position
    FROM tasks
    WHERE project_id = NEW.project_id AND status_id = NEW.status_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_set_position ON tasks;
CREATE TRIGGER tasks_set_position
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_position();

-- ── Projects ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_project_position()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.position IS NULL THEN
    SELECT COALESCE(MAX(position), 0) + 1
    INTO NEW.position
    FROM projects
    WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_set_position ON projects;
CREATE TRIGGER projects_set_position
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION set_project_position();
