-- Add icon column to statuses
-- icon = string key mapping to a predefined SVG shape (e.g. 'circle_quarter').
-- NULL means "use the default icon for this status type".

ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS icon text NULL;
