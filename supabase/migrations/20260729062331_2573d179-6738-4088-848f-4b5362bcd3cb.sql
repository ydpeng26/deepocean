CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TYPE public.dive_type AS ENUM ('recreational', 'freediving', 'technical');
CREATE TYPE public.buddy_role AS ENUM ('instructor', 'buddy');

CREATE TABLE public.dives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country text NOT NULL,
  site_name text NOT NULL,
  dive_date date NOT NULL,
  weather text,
  surface_temp numeric(4,1),
  water_temp numeric(4,1),
  max_depth numeric(5,1),
  duration_min integer,
  dive_type public.dive_type NOT NULL DEFAULT 'recreational',
  buddy_role public.buddy_role,
  buddy_name text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dives TO authenticated;
GRANT ALL ON public.dives TO service_role;
ALTER TABLE public.dives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dives select" ON public.dives FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own dives insert" ON public.dives FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own dives update" ON public.dives FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own dives delete" ON public.dives FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX dives_user_date_idx ON public.dives (user_id, dive_date DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER dives_touch_updated_at
BEFORE UPDATE ON public.dives
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();