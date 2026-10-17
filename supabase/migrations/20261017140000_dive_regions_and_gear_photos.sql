ALTER TABLE public.dives
  ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS photo_path text;

-- Repair the most common region values that were previously stored as countries.
UPDATE public.dives SET country = 'Indonesia', region = COALESCE(region, 'Komodo')
WHERE lower(trim(country)) IN ('komodo', '科莫多');
UPDATE public.dives SET country = 'Indonesia', region = COALESCE(region, 'Bali')
WHERE lower(trim(country)) IN ('bali', '巴厘岛');
UPDATE public.dives SET country = 'Philippines', region = COALESCE(region, 'Moalboal')
WHERE lower(trim(country)) IN ('moalboal', '墨宝');
UPDATE public.dives SET country = 'Malaysia', region = COALESCE(region, 'Sipadan')
WHERE lower(trim(country)) IN ('sipadan', '诗巴丹');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gear-photos', 'gear-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "gear photos owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'gear-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gear photos owner insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gear-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gear photos owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'gear-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gear photos owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gear-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
