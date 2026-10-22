-- No existing rows or objects are rewritten/deleted. NOT VALID avoids rejecting
-- deployment because of legacy references; new writes must own their photo path.
ALTER TABLE public.marine_encounters ADD CONSTRAINT marine_photo_owned_path
  CHECK (split_part(photo_path, '/', 1) = user_id::text AND split_part(photo_path, '/', 2) <> '') NOT VALID;
ALTER TABLE public.forum_posts ADD CONSTRAINT forum_photo_owned_path
  CHECK (image_path IS NULL OR (split_part(image_path, '/', 1) = user_id::text AND split_part(image_path, '/', 2) <> '')) NOT VALID;

CREATE INDEX marine_encounters_photo_access_idx ON public.marine_encounters(photo_path, user_id) WHERE needs_help;
CREATE INDEX forum_posts_photo_access_idx ON public.forum_posts(image_path, user_id) WHERE image_path IS NOT NULL;

DROP POLICY "read visible marine photos" ON storage.objects;
CREATE POLICY "read visible marine photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marine-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.marine_encounters e
      WHERE e.photo_path = name AND e.needs_help AND e.user_id::text = (storage.foldername(name))[1])
  ));

DROP POLICY "members read forum media" ON storage.objects;
CREATE POLICY "members read forum media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'forum-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.forum_posts p
      WHERE p.image_path = name AND p.user_id::text = (storage.foldername(name))[1])
  ));

-- A permissive policy for another feature must not bypass these two buckets.
-- Owner access remains available for upload/retry and private retained objects.
CREATE POLICY "photo reference privacy boundary" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated USING (
    bucket_id NOT IN ('marine-photos', 'forum-media')
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (bucket_id = 'marine-photos' AND EXISTS (
      SELECT 1 FROM public.marine_encounters e WHERE e.photo_path = name
        AND e.needs_help AND e.user_id::text = (storage.foldername(name))[1]))
    OR (bucket_id = 'forum-media' AND EXISTS (
      SELECT 1 FROM public.forum_posts p WHERE p.image_path = name
        AND p.user_id::text = (storage.foldername(name))[1]))
  );
