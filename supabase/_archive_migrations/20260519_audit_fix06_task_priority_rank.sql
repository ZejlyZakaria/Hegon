-- Sprint 7 §1.5 — priority_rank GENERATED STORED
-- Problème : .order("due_date") en premier → une tâche CRITICAL sans due_date
-- tombe après les 50 premiers résultats et n'atteint jamais pickPriorityTask.
-- Piège évité : .order("priority") direct trie alphabétiquement (critical < high < low < medium).
-- Fix : colonne GENERATED STORED qui mappe le texte en rang numérique → triable + indexable.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS priority_rank smallint
  GENERATED ALWAYS AS (
    CASE priority
      WHEN 'critical' THEN 0
      WHEN 'high'     THEN 1
      WHEN 'medium'   THEN 2
      WHEN 'low'      THEN 3
      ELSE                 4
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tasks_priority_rank ON tasks(priority_rank);
