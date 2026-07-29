CREATE POLICY "dive photos select own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dive-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "dive photos insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dive-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "dive photos update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'dive-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "dive photos delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dive-photos' AND auth.uid()::text = (storage.foldername(name))[1]);