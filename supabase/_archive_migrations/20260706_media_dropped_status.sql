-- Watching Couche 2 — Dropped status + reason.
-- WHY: a series you abandon stays stuck in `in_progress` forever. This adds a real
-- "dropped" state (the series leaves In Progress but keeps its position) plus the
-- captured reason you stopped — the first brick of the personal-capture layer.

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS dropped     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drop_reason text;
