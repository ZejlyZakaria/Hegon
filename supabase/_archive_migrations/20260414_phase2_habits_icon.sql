-- Add icon column to habits
-- Stores the icon key (e.g. 'star') from the shared ICONS registry.
-- Color is derived from the icon at render time — no need for a separate color column in this migration.

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'star';
