-- Existing records remain precise single dives. No historical counters change.
ALTER TABLE public.dives
  ADD COLUMN record_mode text NOT NULL DEFAULT 'precise',
  ADD COLUMN dive_count integer NOT NULL DEFAULT 1,
  ADD COLUMN date_precision text NOT NULL DEFAULT 'day',
  ADD COLUMN period_end date,
  ADD COLUMN site_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN total_duration_min integer;

CREATE FUNCTION public.valid_summary_sites(names text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(array_ndims(names), 1) = 1 AND cardinality(names) <= 200
    AND NOT EXISTS (SELECT 1 FROM unnest(names) n WHERE n IS NULL OR char_length(btrim(n)) NOT BETWEEN 1 AND 120);
$$;

ALTER TABLE public.dives ADD CONSTRAINT dives_record_valid CHECK (
  record_mode IN ('precise', 'summary') AND dive_count BETWEEN 1 AND 100000
  AND date_precision IN ('day', 'month', 'year', 'range')
  AND public.valid_summary_sites(site_names)
  AND (total_duration_min IS NULL OR total_duration_min >= 0)
  AND (
    (record_mode = 'precise' AND dive_count = 1 AND date_precision = 'day'
      AND period_end IS NULL AND cardinality(site_names) = 0 AND total_duration_min IS NULL)
    OR
    (record_mode = 'summary' AND entry_time IS NULL AND period_end IS NOT NULL
      AND dive_date >= DATE '1900-01-01' AND dive_date < DATE '10000-01-01'
      AND period_end >= dive_date AND extract(year FROM period_end) = extract(year FROM dive_date)
      AND (nullif(btrim(region), '') IS NOT NULL OR cardinality(site_names) > 0)
      AND (duration_min IS NULL OR duration_min >= 0)
      AND (max_depth IS NULL OR max_depth >= 0)
      AND (total_duration_min IS NULL OR duration_min IS NULL OR total_duration_min >= duration_min)
      AND (
        (date_precision = 'day' AND period_end = dive_date)
        OR (date_precision = 'month' AND extract(day FROM dive_date) = 1
          AND period_end = (date_trunc('month', dive_date::timestamp) + interval '1 month - 1 day')::date)
        OR (date_precision = 'year' AND extract(month FROM dive_date) = 1 AND extract(day FROM dive_date) = 1
          AND extract(month FROM period_end) = 12 AND extract(day FROM period_end) = 31)
        OR date_precision = 'range'
      ))
  )
);

CREATE OR REPLACE FUNCTION public.sync_dive_usage_counters() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid;
  old_count integer := 0; new_count integer := 0;
  old_tank integer := 0; new_tank integer := 0;
  old_ids uuid[] := '{}'; new_ids uuid[] := '{}';
  gear_id uuid; delta integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    owner_id := OLD.user_id;
    old_count := OLD.dive_count;
    old_tank := OLD.count_tank::integer * old_count;
    old_ids := OLD.used_gear_ids;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'Dive owner cannot change'; END IF;
    owner_id := NEW.user_id;
    new_count := NEW.dive_count;
    new_tank := NEW.count_tank::integer * new_count;
    new_ids := NEW.used_gear_ids;
    IF EXISTS (SELECT 1 FROM unnest(new_ids) id WHERE id IS NULL) THEN RAISE EXCEPTION 'Invalid equipment selection'; END IF;
  END IF;
  -- Serialize usage changes for an owner even when tank selection is unchanged.
  PERFORM 1 FROM public.profiles WHERE id = owner_id FOR UPDATE;
  IF NOT FOUND AND TG_OP <> 'DELETE' THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  IF old_tank <> new_tank THEN
    UPDATE public.profiles SET tank_count = greatest(0, coalesce(tank_count, 0) + new_tank - old_tank) WHERE id = owner_id;
  END IF;
  FOR gear_id IN SELECT DISTINCT id FROM unnest(old_ids || new_ids) id ORDER BY id LOOP
    IF gear_id = ANY(new_ids) AND NOT (gear_id = ANY(old_ids))
      AND NOT EXISTS (SELECT 1 FROM public.gear_items WHERE id = gear_id AND user_id = owner_id) THEN
      RAISE EXCEPTION 'Selected equipment is unavailable or belongs to another account';
    END IF;
    delta := (gear_id = ANY(new_ids))::integer * new_count - (gear_id = ANY(old_ids))::integer * old_count;
    IF delta <> 0 THEN
      UPDATE public.gear_items SET dive_count = greatest(0, coalesce(dive_count, 0) + delta)
        WHERE id = gear_id AND user_id = owner_id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
