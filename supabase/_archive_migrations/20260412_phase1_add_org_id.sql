-- Phase 1 — Multi-tenancy
-- Migration 2 : ajout org_id sur les tables existantes

-- NOTE : org_id ajouté en nullable pour l'instant.
-- Il sera backfillé puis passé NOT NULL dans la migration 4
-- après création du trigger auto-org et de l'org de Zakaria.

-- ============================================================
-- SCHEMA : public
-- ============================================================
ALTER TABLE public.workspaces        ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.projects          ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.statuses          ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.tags              ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.tasks             ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.activity_log      ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.attachments       ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.comments          ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.task_dependencies ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.task_tags         ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

CREATE INDEX idx_workspaces_org_id        ON public.workspaces        (org_id);
CREATE INDEX idx_projects_org_id          ON public.projects          (org_id);
CREATE INDEX idx_statuses_org_id          ON public.statuses          (org_id);
CREATE INDEX idx_tags_org_id              ON public.tags              (org_id);
CREATE INDEX idx_tasks_org_id             ON public.tasks             (org_id);
CREATE INDEX idx_activity_log_org_id      ON public.activity_log      (org_id);
CREATE INDEX idx_attachments_org_id       ON public.attachments       (org_id);
CREATE INDEX idx_comments_org_id          ON public.comments          (org_id);
CREATE INDEX idx_task_dependencies_org_id ON public.task_dependencies (org_id);
CREATE INDEX idx_task_tags_org_id         ON public.task_tags         (org_id);

-- ============================================================
-- SCHEMA : watching
-- ============================================================
ALTER TABLE watching.media_items ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

CREATE INDEX idx_media_items_org_id ON watching.media_items (org_id);

-- ============================================================
-- SCHEMA : sport (tables de préférences uniquement)
-- Référence partagée (pas d'org_id) : football_past_matches,
-- football_standings, football_team_competitions,
-- tennis_players_cache et toutes les tables F1/tennis/football
-- de données globales.
-- ============================================================
ALTER TABLE sport.football_user_settings  ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE sport.football_best_xi        ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE sport.football_best_xi_players ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE sport.football_legends        ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE sport.user_favorites          ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

CREATE INDEX idx_football_user_settings_org_id   ON sport.football_user_settings   (org_id);
CREATE INDEX idx_football_best_xi_org_id         ON sport.football_best_xi         (org_id);
CREATE INDEX idx_football_best_xi_players_org_id ON sport.football_best_xi_players (org_id);
CREATE INDEX idx_football_legends_org_id         ON sport.football_legends         (org_id);
CREATE INDEX idx_user_favorites_org_id           ON sport.user_favorites           (org_id);
