ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 300);

CREATE TABLE IF NOT EXISTS public.gear_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bcd', 'regulator', 'computer', 'mask', 'fins', 'wetsuit', 'camera', 'other')),
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  purchased_on date,
  next_service_on date,
  serial_number text,
  dive_count integer NOT NULL DEFAULT 0 CHECK (dive_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gear owner read" ON public.gear_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gear owner insert" ON public.gear_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gear owner update" ON public.gear_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gear owner delete" ON public.gear_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS gear_items_user_id_idx ON public.gear_items(user_id, created_at DESC);

DROP TRIGGER IF EXISTS gear_items_touch_updated_at ON public.gear_items;
CREATE TRIGGER gear_items_touch_updated_at
BEFORE UPDATE ON public.gear_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gear_items TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_diver_profile(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  cert_level text,
  tank_count integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.bio, p.cert_level, p.tank_count, p.created_at
  FROM public.profiles p
  WHERE p.id = target_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_diver_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_diver_profile(uuid) TO authenticated;

CREATE POLICY "avatars authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
