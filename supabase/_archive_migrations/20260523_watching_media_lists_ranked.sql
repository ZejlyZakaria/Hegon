-- ── Add is_ranked to media_lists ──────────────────────────────────────────────
ALTER TABLE watching.media_lists ADD COLUMN IF NOT EXISTS is_ranked boolean NOT NULL DEFAULT false;
