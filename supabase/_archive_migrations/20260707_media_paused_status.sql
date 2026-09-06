-- Watching Couche 2 — Paused (on-hold) status.
-- WHY: between "actively watching" and "dropped" there's a real third state — a
-- series you've set aside and mean to resume when time/mood is right. Without it,
-- those shows either clutter In Progress or get wrongly dropped. Mirrors `dropped`
-- (leaves In Progress, keeps its position) but with no reason — pausing is casual.

ALTER TABLE watching.media_items
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;
