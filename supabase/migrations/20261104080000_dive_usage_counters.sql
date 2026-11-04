-- Existing manual totals remain the baseline; only new opt-in deltas are applied.
ALTER TABLE public.dives ADD COLUMN count_tank boolean NOT NULL DEFAULT false;
ALTER TABLE public.dives ADD COLUMN used_gear_ids uuid[] NOT NULL DEFAULT '{}';

CREATE FUNCTION public.sync_dive_usage_counters() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid;
  old_tank integer := 0;
  new_tank integer := 0;
  old_ids uuid[] := '{}';
  new_ids uuid[] := '{}';
  gear_id uuid;
  delta integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    owner_id := OLD.user_id;
    old_tank := OLD.count_tank::integer;
    old_ids := OLD.used_gear_ids;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Dive owner cannot change';
    END IF;
    owner_id := NEW.user_id;
    new_tank := NEW.count_tank::integer;
    new_ids := NEW.used_gear_ids;
    IF EXISTS (SELECT 1 FROM unnest(new_ids) id WHERE id IS NULL) THEN
      RAISE EXCEPTION 'Invalid equipment selection';
    END IF;
  END IF;
  -- Lock profile first, then equipment in stable UUID order for concurrent logs.
  IF old_tank <> new_tank THEN
    UPDATE public.profiles SET tank_count = greatest(0, coalesce(tank_count,0) + new_tank - old_tank)
      WHERE id = owner_id;
    IF NOT FOUND AND TG_OP <> 'DELETE' THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  END IF;
  FOR gear_id IN SELECT DISTINCT id FROM unnest(old_ids || new_ids) id ORDER BY id LOOP
    delta := (gear_id = ANY(new_ids))::integer - (gear_id = ANY(old_ids))::integer;
    -- Removed equipment may remain on historical logs; only newly selected IDs must exist.
    IF delta = 1 AND NOT EXISTS (SELECT 1 FROM public.gear_items WHERE id = gear_id AND user_id = owner_id) THEN
      RAISE EXCEPTION 'Selected equipment is unavailable or belongs to another account';
    END IF;
    IF delta <> 0 THEN
      UPDATE public.gear_items SET dive_count = greatest(0, dive_count + delta)
        WHERE id = gear_id AND user_id = owner_id;
      IF NOT FOUND AND delta = 1 THEN RAISE EXCEPTION 'Selected equipment unavailable'; END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER dive_usage_counters AFTER INSERT OR UPDATE OR DELETE ON public.dives
FOR EACH ROW EXECUTE FUNCTION public.sync_dive_usage_counters();
