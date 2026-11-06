ALTER TABLE public.dives ADD COLUMN weight_value numeric(6,2);
ALTER TABLE public.dives ADD COLUMN weight_unit text;
ALTER TABLE public.dives ADD CONSTRAINT dives_weight_valid CHECK (
  (weight_value IS NULL AND weight_unit IS NULL) OR
  (weight_value IS NOT NULL AND weight_unit IS NOT NULL AND weight_value BETWEEN 0 AND 9999.99 AND weight_unit IN ('kg','lb'))
);
