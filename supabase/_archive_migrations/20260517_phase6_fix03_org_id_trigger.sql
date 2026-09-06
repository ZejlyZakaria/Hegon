-- Phase 6 — Fix 03 : trigger BEFORE INSERT pour dériver org_id
-- automatiquement à partir du parent (workspace → project → task).
-- Sans cela, un workspace_member invité (sans ligne dans memberships)
-- ne pouvait pas créer de project/task/status car le service injectait
-- org_id via getCurrentOrgId() qui levait "No organization found".

-- ── projects : org_id dérivé du workspace parent ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_project_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_org_id ON public.projects;
CREATE TRIGGER trg_set_project_org_id
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_org_id();

-- ── statuses : org_id dérivé du project parent ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_status_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_status_org_id ON public.statuses;
CREATE TRIGGER trg_set_status_org_id
  BEFORE INSERT ON public.statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_status_org_id();

-- ── tasks : org_id dérivé du project parent ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_task_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_org_id ON public.tasks;
CREATE TRIGGER trg_set_task_org_id
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_org_id();

-- ── task_tags : org_id dérivé de la task parente ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_task_tag_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id
    FROM public.tasks
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_tag_org_id ON public.task_tags;
CREATE TRIGGER trg_set_task_tag_org_id
  BEFORE INSERT ON public.task_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_tag_org_id();
