ALTER TABLE public.dives ADD COLUMN gas_type text CHECK (gas_type IS NULL OR char_length(btrim(gas_type)) BETWEEN 1 AND 80);
COMMENT ON COLUMN public.dives.gas_type IS 'Recorded breathing gas or mix; null means not recorded.';
