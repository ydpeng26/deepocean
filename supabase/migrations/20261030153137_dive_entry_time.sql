-- Nullable to preserve existing logs and old clients. Deploy before the frontend.
ALTER TABLE public.dives ADD COLUMN entry_time time without time zone;
ALTER TABLE public.dives ADD CONSTRAINT dives_entry_time_minute_check
  CHECK (entry_time < time '24:00' AND extract(second FROM entry_time) = 0);
COMMENT ON COLUMN public.dives.entry_time IS
  'Optional local entry time at the dive site, minute precision. No timezone conversion.';
