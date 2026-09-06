-- Phase 1 — Multi-tenancy
-- Migration 5 : remplacement des RLS policies par le pattern org_isolation

-- ============================================================
-- DROP : anciennes policies basées sur user_id
-- ============================================================

-- workspaces
DROP POLICY IF EXISTS "Users can update their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can delete their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view their own workspaces"   ON public.workspaces;
DROP POLICY IF EXISTS "Users can insert their own workspaces" ON public.workspaces;

-- projects
DROP POLICY IF EXISTS "Users can view projects in their workspaces"   ON public.projects;
DROP POLICY IF EXISTS "Users can manage projects in their workspaces" ON public.projects;

-- statuses
DROP POLICY IF EXISTS "Users can view statuses in their projects"   ON public.statuses;
DROP POLICY IF EXISTS "Users can manage statuses in their projects" ON public.statuses;

-- tags
DROP POLICY IF EXISTS "Users can manage their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view their own tags"   ON public.tags;

-- tasks
DROP POLICY IF EXISTS "Users can manage tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their projects"   ON public.tasks;

-- activity_log
DROP POLICY IF EXISTS "Users can view activity for their tasks" ON public.activity_log;

-- attachments
DROP POLICY IF EXISTS "Users can view attachments on their tasks"   ON public.attachments;
DROP POLICY IF EXISTS "Users can manage attachments on their tasks" ON public.attachments;

-- comments
DROP POLICY IF EXISTS "Users can view comments on their tasks"   ON public.comments;
DROP POLICY IF EXISTS "Users can manage comments on their tasks" ON public.comments;

-- task_dependencies
DROP POLICY IF EXISTS "Users can view dependencies for their tasks"   ON public.task_dependencies;
DROP POLICY IF EXISTS "Users can manage dependencies for their tasks" ON public.task_dependencies;

-- task_tags
DROP POLICY IF EXISTS "Users can manage task tags for their tasks" ON public.task_tags;
DROP POLICY IF EXISTS "Users can view task tags for their tasks"   ON public.task_tags;

-- media_items
DROP POLICY IF EXISTS "Users manage own media" ON watching.media_items;

-- sport — préférences
DROP POLICY IF EXISTS "Users can view their own football settings" ON sport.football_user_settings;
DROP POLICY IF EXISTS "Users manage own football settings"         ON sport.football_user_settings;
DROP POLICY IF EXISTS "Users manage own best xi"                   ON sport.football_best_xi;
DROP POLICY IF EXISTS "Users manage own best xi players"           ON sport.football_best_xi_players;
DROP POLICY IF EXISTS "Users can update own legends"               ON sport.football_legends;
DROP POLICY IF EXISTS "Users can delete own legends"               ON sport.football_legends;
DROP POLICY IF EXISTS "Users can read own legends"                 ON sport.football_legends;
DROP POLICY IF EXISTS "Users can insert own legends"               ON sport.football_legends;
DROP POLICY IF EXISTS "Users manage own favorites"                 ON sport.user_favorites;
DROP POLICY IF EXISTS "service_role_insert_user_favorites"         ON sport.user_favorites;
DROP POLICY IF EXISTS "service_role_select_user_favorites"         ON sport.user_favorites;
DROP POLICY IF EXISTS "service_role_update_user_favorites"         ON sport.user_favorites;
DROP POLICY IF EXISTS "service_role_delete_user_favorites"         ON sport.user_favorites;

-- ============================================================
-- CREATE : nouvelles policies org_isolation
-- Pattern unifié : une seule policy ALL par table
-- USING  → filtre les SELECT / UPDATE / DELETE
-- WITH CHECK → valide les INSERT / UPDATE
-- ============================================================

CREATE POLICY "org_isolation" ON public.workspaces
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.projects
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.statuses
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.tags
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.tasks
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.activity_log
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.attachments
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.comments
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.task_dependencies
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON public.task_tags
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON watching.media_items
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON sport.football_user_settings
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON sport.football_best_xi
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON sport.football_best_xi_players
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON sport.football_legends
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));

CREATE POLICY "org_isolation" ON sport.user_favorites
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));
