-- Keep old single-person records untouched; null means use legacy fields.
CREATE FUNCTION public.valid_dive_companions(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN value IS NULL THEN true
    WHEN jsonb_typeof(value) <> 'array' THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(value) person
      WHERE jsonb_typeof(person) <> 'object'
        OR jsonb_typeof(person->'name') IS DISTINCT FROM 'string'
        OR char_length(btrim(person->>'name')) NOT BETWEEN 1 AND 80
        OR NOT (person ? 'role')
        OR NOT (person->'role' = 'null'::jsonb OR person->>'role' IN ('buddy','guide','instructor'))
    ) END
$$;
ALTER TABLE public.dives ADD COLUMN companions jsonb;
ALTER TABLE public.dives ADD CONSTRAINT dives_companions_valid CHECK (public.valid_dive_companions(companions));
COMMENT ON COLUMN public.dives.companions IS 'People on this dive, each with name and role. Null falls back to legacy buddy fields; [] explicitly means nobody recorded.';
