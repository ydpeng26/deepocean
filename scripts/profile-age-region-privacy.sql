-- Recovery-only transactional fixtures. No persisted account or existing-user edits.
begin;
create temporary table demographics_fixture(owner_id uuid, viewer_id uuid);
insert into demographics_fixture values(gen_random_uuid(), gen_random_uuid());
grant select on demographics_fixture to authenticated;
insert into auth.users(id, email, raw_user_meta_data)
select owner_id, 'age-owner-' || owner_id || '@example.invalid', '{}'::jsonb from demographics_fixture
union all select viewer_id, 'age-viewer-' || viewer_id || '@example.invalid', '{}'::jsonb from demographics_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_id::text from demographics_fixture), true);
do $$ begin
  assert (select count(*)=1 from public.profiles where id=(select owner_id from demographics_fixture));
  assert (select birth_date is null and region is null and not age_public and not region_public
    from public.profiles where id=(select owner_id from demographics_fixture));
end $$;
update public.profiles set birth_date='2000-02-29', region='Synthetic Region'
where id=(select owner_id from demographics_fixture);
select set_config('request.jwt.claim.sub', (select viewer_id::text from demographics_fixture), true);
do $$ declare result jsonb; changed integer; begin
  assert not exists(select 1 from public.profiles where id=(select owner_id from demographics_fixture)), 'RLS leaked owner row';
  update public.profiles set region='Forbidden' where id=(select owner_id from demographics_fixture);
  get diagnostics changed = row_count;
  assert changed=0, 'Cross-owner write allowed';
  select to_jsonb(p) into result from public.get_public_diver_profile((select owner_id from demographics_fixture)) p;
  assert result is not null and result->'age'='null'::jsonb and result->'region'='null'::jsonb;
  assert not result ?| array['birth_date','age_public','region_public','background_url'];
end $$;
select set_config('request.jwt.claim.sub', (select owner_id::text from demographics_fixture), true);
update public.profiles set age_public=true where id=(select owner_id from demographics_fixture);
select set_config('request.jwt.claim.sub', (select viewer_id::text from demographics_fixture), true);
do $$ begin
  assert (select age=extract(year from age((now() at time zone 'Asia/Shanghai')::date,date '2000-02-29'))::integer
    and region is null from public.get_public_diver_profile((select owner_id from demographics_fixture)));
end $$;
select set_config('request.jwt.claim.sub', (select owner_id::text from demographics_fixture), true);
update public.profiles set age_public=false, region_public=true where id=(select owner_id from demographics_fixture);
select set_config('request.jwt.claim.sub', (select viewer_id::text from demographics_fixture), true);
do $$ begin
  assert (select age is null and region='Synthetic Region' from public.get_public_diver_profile((select owner_id from demographics_fixture)));
end $$;
select set_config('request.jwt.claim.sub', (select owner_id::text from demographics_fixture), true);
update public.profiles set region_public=false where id=(select owner_id from demographics_fixture);
do $$ begin
  begin
    update public.profiles set birth_date='2999-01-01' where id=(select owner_id from demographics_fixture);
    raise exception 'Future DOB accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set region=repeat('x',81) where id=(select owner_id from demographics_fixture);
    raise exception 'Oversized region accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', (select viewer_id::text from demographics_fixture), true);
do $$ begin
  assert (select age is null and region is null from public.get_public_diver_profile((select owner_id from demographics_fixture)));
  assert not has_function_privilege('anon','public.get_public_diver_profile(uuid)','execute');
end $$;
rollback;
select 'PASS: owner-only DOB, independent opt-ins, hide again, cross-owner read/write denial, constraints and anonymous RPC denial; all fixtures rolled back' as privacy_check;
