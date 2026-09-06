-- Phase 6 — Fix 06 : empêcher qu'une task référence un status_id
-- appartenant à un autre project. Sans ce check, un membre malveillant
-- pouvait casser l'intégrité (status d'un projet auquel il n'a pas accès).

CREATE OR REPLACE FUNCTION public.check_task_status_same_project()
RETURNS trigger
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  status_project uuid;
BEGIN
  IF NEW.status_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT project_id INTO status_project
  FROM public.statuses
  WHERE id = NEW.status_id;

  IF status_project IS NULL OR status_project <> NEW.project_id THEN
    RAISE EXCEPTION 'status_id % does not belong to project %', NEW.status_id, NEW.project_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_task_status_same_project ON public.tasks;
CREATE TRIGGER trg_check_task_status_same_project
  BEFORE INSERT OR UPDATE OF status_id, project_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_status_same_project();
