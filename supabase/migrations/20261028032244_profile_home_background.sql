-- No new grants/buckets: existing profiles RLS and owner image policies apply.
alter table public.profiles add column if not exists background_url text;
alter table public.profiles add constraint profiles_background_owner_path
  check (background_url is null or (
    split_part(background_url, '/', 1) = id::text
    and background_url ~ '^[0-9a-f-]{36}/background/[0-9a-f-]{36}\.jpg$'
  ));
