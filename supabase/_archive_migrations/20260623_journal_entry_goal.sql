-- Journal — optionally link an entry to a goal (reflect on a specific objective).
-- ON DELETE SET NULL: removing the goal just unlinks, never deletes the entry.

ALTER TABLE public.journal_entries
  ADD COLUMN goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;
