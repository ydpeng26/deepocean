-- New private feedback only. Existing records, auth rules and buckets are untouched.
-- Filename aligned to the version returned by the recovery migration service.
CREATE TABLE public.website_feedback (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('suggestion', 'issue', 'other')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000 AND body ~ '[^[:space:]]'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_feedback_owner_created_idx ON public.website_feedback(user_id, created_at DESC);
ALTER TABLE public.website_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.website_feedback TO authenticated;
GRANT INSERT (id, user_id, category, body) ON public.website_feedback TO authenticated;
GRANT ALL ON public.website_feedback TO service_role;
CREATE POLICY "read own feedback" ON public.website_feedback FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "submit own feedback" ON public.website_feedback FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Invoker rights retain RLS. A per-owner transaction lock serializes competing
-- submissions; clients cannot backdate created_at to bypass these limits.
CREATE FUNCTION public.guard_website_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'feedback_owner_required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 39021));
  IF EXISTS (SELECT 1 FROM public.website_feedback WHERE id = NEW.id AND user_id = NEW.user_id) THEN
    RETURN NEW; -- Primary key still rejects duplicate inserts; it never overwrites.
  END IF;
  IF EXISTS (SELECT 1 FROM public.website_feedback
      WHERE user_id = NEW.user_id AND created_at > pg_catalog.clock_timestamp() - interval '1 minute')
    OR (SELECT count(*) FROM public.website_feedback
      WHERE user_id = NEW.user_id AND created_at > pg_catalog.clock_timestamp() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION 'feedback_rate_limit' USING ERRCODE = 'P0001';
  END IF;
  NEW.created_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_website_feedback() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER website_feedback_guard BEFORE INSERT ON public.website_feedback
  FOR EACH ROW EXECUTE FUNCTION public.guard_website_feedback();
