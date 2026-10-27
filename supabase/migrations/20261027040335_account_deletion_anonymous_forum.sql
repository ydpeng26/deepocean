-- Private, resumable deletion receipts. No client can start or complete a job.
create schema if not exists account_private;
revoke all on schema account_private from public, anon;
grant usage on schema account_private to authenticated, service_role;
create table account_private.deletion_jobs (
  id uuid primary key,
  user_id uuid unique,
  status text not null default 'pending' check (status in ('pending','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status='pending' and user_id is not null) or (status='completed' and user_id is null))
);
alter table account_private.deletion_jobs enable row level security;
revoke all on account_private.deletion_jobs from public, anon, authenticated;
grant all on account_private.deletion_jobs to service_role;

-- A refresh/signout alone does not revoke an already issued JWT. Block member
-- data access immediately on deletion start and after the Auth row is gone.
create function account_private.member_active() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and exists(select 1 from auth.users u where u.id=(select auth.uid()))
    and not exists(select 1 from account_private.deletion_jobs j where j.user_id=(select auth.uid()));
$$;
revoke all on function account_private.member_active() from public, anon;
grant execute on function account_private.member_active() to authenticated, service_role;
-- Legacy SECURITY DEFINER write RPCs bypass RLS. A row trigger also checks the
-- original verified JWT role, including writes made from those old RPCs.
create function account_private.require_active_writer() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (auth.jwt()->>'role')='authenticated' and not account_private.member_active() then
    raise exception 'account_unavailable';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function account_private.require_active_writer() from public,anon,authenticated;
do $$ declare target text; begin
  foreach target in array array['profiles','dives','dive_create_sync_receipts','diver_dive_counters',
    'diver_certifications','dive_ocean_encounters','gear_items','marine_encounters','marine_suggestions',
    'diver_certificates','forum_posts','forum_comments','forum_likes','forum_bookmarks','forum_follows',
    'forum_blocks','forum_reports','website_feedback'] loop
    execute format('create policy "active account boundary" on public.%I as restrictive for all to authenticated using ((select account_private.member_active())) with check ((select account_private.member_active()))',target);
    execute format('create trigger account_state_guard before insert or update or delete on public.%I for each row execute function account_private.require_active_writer()',target);
  end loop;
end $$;
create policy "active account boundary" on storage.objects as restrictive for all to authenticated
using ((select account_private.member_active())) with check ((select account_private.member_active()));
create trigger account_state_guard before insert or update or delete on storage.objects
for each row execute function account_private.require_active_writer();

-- Public discussion survives independently; null authors are never claimable.
alter table public.forum_posts alter column user_id drop not null;
alter table public.forum_comments alter column user_id drop not null;
alter table public.forum_posts drop constraint forum_posts_user_id_fkey;
alter table public.forum_comments drop constraint forum_comments_user_id_fkey;
alter table public.forum_posts add constraint forum_posts_user_id_fkey foreign key(user_id) references public.profiles(id) on delete set null;
alter table public.forum_comments add constraint forum_comments_user_id_fkey foreign key(user_id) references public.profiles(id) on delete set null;

create or replace function public.set_forum_post_author_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
declare author public.profiles%rowtype; begin
  if new.user_id is null then
    new.author_name:='已注销用户'; new.author_badge:='DIVER';
  else
    select * into author from public.profiles where id=new.user_id;
    new.author_name:=coalesce(nullif(trim(author.display_name),''),'Diver');
    new.author_badge:=coalesce(nullif(trim(author.cert_level),''),'DIVER');
  end if;
  return new;
end $$;
create or replace function public.set_forum_comment_author_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
declare author text; begin
  if new.user_id is null then new.author_name:='已注销用户';
  else
    select display_name into author from public.profiles where id=new.user_id;
    new.author_name:=coalesce(nullif(trim(author),''),'Diver');
  end if;
  return new;
end $$;
revoke all on function public.set_forum_post_author_snapshot() from public, anon, authenticated;
revoke all on function public.set_forum_comment_author_snapshot() from public, anon, authenticated;

-- Only a fixed server-side worker can call these operations. Storage bytes must
-- be removed via Storage API, never by deleting storage.objects with SQL.
create function account_private.deletion_step(p_user uuid,p_request uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job account_private.deletion_jobs%rowtype; objects jsonb;
begin
  if p_user is null or p_request is null then raise exception 'invalid_request'; end if;
  if p_action='begin' then
    perform 1 from auth.users where id=p_user for update;
    if not found then raise exception 'account_missing'; end if;
    insert into account_private.deletion_jobs(id,user_id) values(p_request,p_user)
      on conflict(user_id) do nothing;
  end if;
  select * into job from account_private.deletion_jobs where user_id=p_user and (p_action='status' or id=p_request) for update;
  if not found and p_action='status' then return jsonb_build_object('id',p_request,'status','none'); end if;
  if not found then raise exception 'request_mismatch'; end if;
  if p_action='begin' then
    -- Private posts cannot become public as a side effect of anonymization.
    delete from public.forum_posts where user_id=p_user and visibility='private';
    update public.forum_posts set user_id=null,author_name='已注销用户',author_badge='DIVER',
      image_path=null,linked_dive_id=null,source_encounter_id=null,location=null
      where user_id=p_user;
    update public.forum_comments set user_id=null,author_name='已注销用户' where user_id=p_user;
  elsif p_action='files' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]'::jsonb)
      into objects from (
        select o.bucket_id,o.name from storage.objects o
        where o.owner_id=p_user::text or
          (o.bucket_id in ('avatars','dive-photos','gear-photos','certificate-fronts','marine-photos','forum-media')
           and split_part(o.name,'/',1)=p_user::text)
        order by o.bucket_id,o.name limit 100
      ) owned;
    return jsonb_build_object('id',job.id,'status',job.status,'files',objects);
  elsif p_action='finish' then
    if exists(select 1 from auth.users where id=p_user) or exists(
      select 1 from storage.objects o where o.owner_id=p_user::text or
       (o.bucket_id in ('avatars','dive-photos','gear-photos','certificate-fronts','marine-photos','forum-media') and split_part(o.name,'/',1)=p_user::text)
    ) then raise exception 'cleanup_incomplete'; end if;
    update account_private.deletion_jobs set user_id=null,status='completed',completed_at=now() where id=job.id;
    return jsonb_build_object('id',job.id,'status','completed');
  elsif p_action<>'status' then raise exception 'invalid_action';
  end if;
  return jsonb_build_object('id',job.id,'status',job.status);
end $$;
revoke all on function account_private.deletion_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function account_private.deletion_step(uuid,uuid,text) to service_role;
create function public.account_deletion_step(p_user uuid,p_request uuid,p_action text) returns jsonb
language sql security invoker set search_path='' as $$
  select account_private.deletion_step(p_user,p_request,p_action);
$$;
revoke all on function public.account_deletion_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.account_deletion_step(uuid,uuid,text) to service_role;
