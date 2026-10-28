-- profiles is owner-only under RLS. Never expose birth_date in a public RPC.
begin;
alter table public.profiles
  add column birth_date date,
  add column region text,
  add column age_public boolean not null default false,
  add column region_public boolean not null default false,
  add constraint profiles_birth_date_valid check (birth_date is null or
    (birth_date >= date '1900-01-01' and birth_date <= (now() at time zone 'Asia/Shanghai')::date)),
  add constraint profiles_region_length check (region is null or char_length(region) <= 80);

-- Drop without CASCADE: fail safely if an unexpected dependency exists.
drop function public.get_public_diver_profile(uuid);
create function public.get_public_diver_profile(target_user_id uuid)
returns table(id uuid, display_name text, avatar_url text, bio text, cert_level text,
  tank_count integer, created_at timestamptz, age integer, region text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.cert_level, p.tank_count, p.created_at,
    case when p.age_public and p.birth_date is not null then
      extract(year from age((now() at time zone 'Asia/Shanghai')::date, p.birth_date))::integer end,
    case when p.region_public then nullif(btrim(p.region), '') end
  from public.profiles p
  where p.id = target_user_id and account_private.member_active()
    and not exists(select 1 from account_private.deletion_jobs j where j.user_id = p.id);
$$;
revoke all on function public.get_public_diver_profile(uuid) from public, anon;
grant execute on function public.get_public_diver_profile(uuid) to authenticated;
comment on column public.profiles.birth_date is 'Owner-only birth date. Public projection returns derived age only when opted in.';
notify pgrst, 'reload schema';
commit;
