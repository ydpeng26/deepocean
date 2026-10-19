CREATE TABLE public.marine_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Diver',
  species_name text NOT NULL CHECK (char_length(species_name) BETWEEN 1 AND 120),
  encountered_on date NOT NULL,
  location text NOT NULL CHECK (char_length(location) BETWEEN 1 AND 200),
  photo_path text NOT NULL,
  needs_help boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marine_encounters_owner_idx ON public.marine_encounters(user_id, created_at DESC);
CREATE INDEX marine_encounters_help_idx ON public.marine_encounters(created_at DESC) WHERE needs_help;
ALTER TABLE public.marine_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or help encounters" ON public.marine_encounters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR needs_help);
CREATE POLICY "create own encounters" ON public.marine_encounters FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own encounters" ON public.marine_encounters FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own encounters" ON public.marine_encounters FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.marine_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.marine_encounters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Diver',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marine_suggestions_encounter_idx ON public.marine_suggestions(encounter_id, created_at);
ALTER TABLE public.marine_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read visible encounter suggestions" ON public.marine_suggestions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marine_encounters e WHERE e.id = encounter_id));
CREATE POLICY "suggest on open help requests" ON public.marine_suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.marine_encounters e WHERE e.id = encounter_id AND e.needs_help));
CREATE POLICY "delete own suggestions" ON public.marine_suggestions FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marine_encounters TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.marine_suggestions TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marine-photos', 'marine-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);
CREATE POLICY "upload own marine photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marine-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "read visible marine photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marine-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR EXISTS (SELECT 1 FROM public.marine_encounters e WHERE e.photo_path = name AND e.needs_help)));
CREATE POLICY "delete own marine photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marine-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
