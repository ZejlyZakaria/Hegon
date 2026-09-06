-- `posters` storage bucket — custom images uploaded by the user:
--   • Watching custom posters   (modules/watching/service.ts)
--   • Book covers               (modules/books/service.ts → user_id/book-covers/…)
--   • Home wallpapers           (modules/dashboard-os/service.ts → user_id/wallpapers/…)
-- The code already wrote to this bucket but it was never created → "Bucket not
-- found". Same shape as the `avatars` bucket: public read, each user writes only
-- inside their own top-level folder (user_id/…).

INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "posters_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'posters');

CREATE POLICY "posters_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'posters' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "posters_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'posters' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "posters_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'posters' AND (storage.foldername(name))[1] = auth.uid()::text
  );
