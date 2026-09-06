-- Goal → goal links. A goal can "contribute to" a bigger goal (its parent), e.g.
-- "Lancer sur LinkedIn" → "Construire HEGON" → "Décrocher un CDI". Deliberately NO
-- progress roll-up: the link is "contributes to / strategy for", shown as context
-- and navigation only — finishing the child doesn't auto-complete the parent.
-- ON DELETE SET NULL so deleting a parent just unlinks its children.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS parent_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_parent_goal_id ON public.goals (parent_goal_id);
