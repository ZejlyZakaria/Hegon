-- Settings — personal preferences + avatars storage
-- user_settings: per-user prefs (landing module, week start, date format, Dock visibility).
-- Per-user (not org-scoped): RLS is own-row only.

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_module text        NOT NULL DEFAULT 'dashboard',
  week_start     text        NOT NULL DEFAULT 'monday'
                              CHECK (week_start IN ('monday', 'sunday')),
  date_format    text        NOT NULL DEFAULT 'DD/MM/YYYY'
                              CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  hidden_modules text[]      NOT NULL DEFAULT '{}',  -- Dock module keys the user hid
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_own" ON public.user_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── avatars bucket (public read; each user writes only their own folder) ───────

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
