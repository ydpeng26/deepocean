CREATE TABLE public.diver_certificates (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency text NOT NULL CHECK (char_length(btrim(agency)) BETWEEN 1 AND 60),
  level text NOT NULL CHECK (char_length(btrim(level)) BETWEEN 1 AND 120),
  certificate_number text CHECK (char_length(certificate_number) <= 120),
  issued_on date,
  issued_at text CHECK (char_length(issued_at) <= 160),
  is_public boolean NOT NULL DEFAULT false,
  front_photo_path text CHECK (front_photo_path IS NULL OR front_photo_path LIKE user_id::text || '/%'),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diver_certificates_owner ON public.diver_certificates(user_id, created_at DESC);
CREATE TRIGGER diver_certificates_touch BEFORE UPDATE ON public.diver_certificates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.diver_certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diver_certificates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diver_certificates TO authenticated;
GRANT ALL ON public.diver_certificates TO service_role;
CREATE POLICY "certificate owner reads" ON public.diver_certificates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "certificate owner creates" ON public.diver_certificates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "certificate owner edits" ON public.diver_certificates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "certificate owner deletes" ON public.diver_certificates FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificate-fronts', 'certificate-fronts', false, 10485760, ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY "certificate photo owner reads" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'certificate-fronts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "certificate photo owner creates" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificate-fronts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "certificate photo owner edits" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'certificate-fronts' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'certificate-fronts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "certificate photo owner deletes" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'certificate-fronts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Deliberately no number, image path, owner email or other private fields.
CREATE FUNCTION public.get_public_diver_certificates(target_user_id uuid)
RETURNS TABLE(id uuid, agency text, level text, issued_on date, issued_at text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, c.agency, c.level, c.issued_on, c.issued_at
  FROM public.diver_certificates c
  WHERE auth.uid() IS NOT NULL AND c.user_id = target_user_id
    AND c.is_public AND c.deleted_at IS NULL
  ORDER BY c.issued_on DESC NULLS LAST, c.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_public_diver_certificates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_diver_certificates(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
