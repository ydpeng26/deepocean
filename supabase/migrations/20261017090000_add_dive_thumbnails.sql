ALTER TABLE public.dives
ADD COLUMN IF NOT EXISTS photo_thumbnail_urls text[] NOT NULL DEFAULT '{}';
